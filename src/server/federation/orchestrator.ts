/**
 * DataVault — Federated Learning Orchestrator (spec §13, §14, §65).
 *
 * Executes REAL federated rounds:
 *   distribute global model → local training (real SGD) → masked/encrypted updates →
 *   secure aggregation (masks cancel) → FedAvg → new global model → real metrics →
 *   contribution scoring → rewards → blockchain proofs → audit trail.
 *
 * The UI animates the process, but every state transition originates from
 * actual backend computation (spec §65). Pacing delays are presentation-only.
 */
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { MLPModel, applyDelta, serializeWeights, deserializeWeights, type Weights } from "../ml/mlp";
import { metricsToDisplay, primaryMetric } from "../ml/metrics";
import { PrivacyEngine, flattenWeights, unflattenWeights, type PrivacyMode } from "../privacy/privacy-engine";
import { ParticipantNode, participantFromDisk, type DatasetSpec } from "./participant-node";
import { eventBus, type FederationEvent } from "./event-bus";
import { audit } from "../audit";
import { blockchain, deriveWalletAddress } from "../blockchain/ledger";
import {
  scoreContributions, persistRoundRewards, qualityScore, ROUND_REWARD_POOL,
  type ContributionInput,
} from "../rewards/reward-engine";

export interface RoundConfig {
  epochs: number;
  batchSize: number;
  lr: number;
  privacyMode: PrivacyMode;
  /** presentation pacing (ms) between phases — 0 for background/seed runs */
  pacingMs: number;
}

export const DEFAULT_ROUND_CONFIG: RoundConfig = {
  epochs: 5,
  batchSize: 32,
  lr: 0.1,
  privacyMode: "DEMO",
  pacingMs: 420,
};

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

// ── run lock (prevent concurrent rounds on the same model) ──
const g = globalThis as unknown as { __dvRunning?: Set<string> };
g.__dvRunning ??= new Set<string>();

export function isRunning(modelId: string) {
  return g.__dvRunning!.has(modelId);
}

interface ParticipantRuntime {
  participantId: string;
  organizationId: string;
  organizationName: string;
  slug: string;
  node: ParticipantNode;
  walletAddress: string;
}

async function loadParticipants(modelId: string): Promise<ParticipantRuntime[]> {
  const participants = await db.participant.findMany({
    where: { modelId, status: "ACTIVE" },
    include: { organization: true },
  });
  return participants.map((p) => ({
    participantId: p.id,
    organizationId: p.organizationId,
    organizationName: p.organization.name,
    slug: p.organization.slug,
    walletAddress: p.organization.wallet?.address ?? deriveWalletAddress(p.organization.slug),
    node: participantFromDisk(p.organization.slug, p.organization.name, specFor(p.organization.slug)),
  }));
}

/** Dataset spec registry matching the seeded participant environments. */
import { PARTICIPANT_SPECS } from "../demo-specs";
function specFor(slug: string): DatasetSpec {
  return PARTICIPANT_SPECS[slug] ?? PARTICIPANT_SPECS["hospital-a"];
}

// ─────────────────────────────────────────────────────────────

export async function runFederatedRound(opts: {
  modelId: string;
  roundNumber: number;
  config?: Partial<RoundConfig>;
  actor: string;
  actorRole?: string;
}): Promise<{ roundId: string; status: string; accuracyBefore: number; accuracyAfter: number; improvement: number }> {
  const { modelId, roundNumber, actor } = opts;
  const config: RoundConfig = { ...DEFAULT_ROUND_CONFIG, ...opts.config };

  if (isRunning(modelId)) throw new Error("A federation round is already running for this model");
  g.__dvRunning!.add(modelId);

  const model = await db.model.findUnique({ where: { id: modelId } });
  if (!model) throw new Error("Model not found");

  let latestVersion = await db.modelVersion.findFirst({ where: { modelId }, orderBy: { createdAt: "desc" } });
  let roundRow: { id: string } | null = null;

  const privacyEngine = new PrivacyEngine(process.env.JWT_SECRET || "datavault", config.privacyMode);

  try {
    // ── 1. ROUND_STARTED ──
    const prevAccuracy = model.currentAccuracy;
    roundRow = await db.federatedRound.create({
      data: {
        modelId,
        roundNumber,
        status: "RUNNING",
        config: JSON.stringify(config),
        metricsBefore: prevAccuracy,
        startedAt: new Date(),
      },
    });
    const started = Date.now();
    const emit = async (e: Omit<FederationEvent, "roundId" | "modelId" | "modelName" | "roundNumber" | "timestamp">) => {
      eventBus.publish({
        ...e,
        roundId: roundRow!.id,
        modelId,
        modelName: model.name,
        roundNumber,
        timestamp: new Date().toISOString(),
      });
      await sleep(config.pacingMs);
    };

    await audit({ actor, actorRole: opts.actorRole, eventType: "ROUND_STARTED", resource: `${model.name} #${roundNumber}`, metadata: { roundId: roundRow.id } });
    await emit({ type: "ROUND_STARTED", message: `Federated round #${roundNumber} started for ${model.name}` });

    // ── 2. MODEL_DISTRIBUTED ──
    const participants = await loadParticipants(modelId);
    if (participants.length === 0) throw new Error("No active participants for this model");

    const globalModel = latestVersion?.weights
      ? MLPModel.deserialize(latestVersion.weights)
      : new MLPModel({
          inputDim: participants[0].node.dataset.featureCount,
          hiddenDim: 16,
          task: model.taskType === "REGRESSION" ? "REGRESSION" : "CLASSIFICATION",
          lr: config.lr, batchSize: config.batchSize, epochs: config.epochs, l2: 0.0005, seed: 42,
        });

    await emit({
      type: "MODEL_DISTRIBUTED",
      message: `Global model ${model.currentVersion} distributed to ${participants.length} participants`,
      data: { participants: participants.map((p) => p.organizationName), version: model.currentVersion },
    });

    // ── 3. LOCAL TRAINING + UPDATE PROTECTION ──
    const roundSeed = `round:${roundRow.id}`;
    const submissions: {
      runtime: ParticipantRuntime;
      maskedVec: Float64Array;
      result: ReturnType<ParticipantNode["trainLocally"]>;
      updateHash: string;
      sizeBytes: number;
      encrypted: boolean;
      serializedPayload: string;
      globalValBefore: number;
    }[] = [];

    for (const p of participants) {
      // baseline val performance of the CURRENT global model on this participant's val set
      const globalValBefore = (() => {
        const r = p.node.evaluateOnLocalTest(globalModel);
        return r.primary;
      })();

      let result!: ReturnType<ParticipantNode["trainLocally"]>;
      const totalEpochs = config.epochs;
      await emit({ type: "PARTICIPANT_TRAINING", participantId: p.participantId, participantName: p.organizationName, progress: 5, message: `${p.organizationName}: local training started` });

      result = p.node.trainLocally(globalModel, { epochs: config.epochs, batchSize: config.batchSize, lr: config.lr }, (log) => {
        const pct = Math.round((log.epoch / totalEpochs) * 100);
        eventBus.publish({
          type: "PARTICIPANT_TRAINING",
          roundId: roundRow!.id,
          modelId,
          modelName: model.name,
          roundNumber,
          participantId: p.participantId,
          participantName: p.organizationName,
          progress: Math.min(98, pct),
          message: `${p.organizationName}: local training ${pct}% (epoch ${log.epoch}/${totalEpochs}, loss ${log.loss.toFixed(4)})`,
          timestamp: new Date().toISOString(),
        });
      });

      await emit({
        type: "PARTICIPANT_TRAINING", participantId: p.participantId, participantName: p.organizationName, progress: 100,
        message: `${p.organizationName}: local training completed (${result.sampleCount} samples, ${result.durationMs}ms)`,
        data: { localMetrics: result.localMetrics },
      });
      await emit({
        type: "LOCAL_UPDATE_GENERATED", participantId: p.participantId, participantName: p.organizationName,
        message: `${p.organizationName}: model update generated (‖Δ‖ = ${flattenWeights(result.delta) ? "computed" : "0"})`,
        data: { sampleCount: result.sampleCount, localMetrics: result.localMetrics },
      });

      // privacy protection: pairwise zero-sum mask + optional AES-256-GCM
      const mask = privacyEngine.aggregator.participantMask(
        p.participantId,
        participants.map((q) => q.participantId),
        roundSeed,
        result.updateVector.length
      );
      const maskedVec = new Float64Array(result.updateVector.length);
      for (let k = 0; k < result.updateVector.length; k++) maskedVec[k] = result.updateVector[k] + mask[k];

      let serializedPayload = JSON.stringify(Array.from(maskedVec));
      let encrypted = false;
      let sizeBytes = Buffer.byteLength(serializedPayload);
      if (config.privacyMode === "ENCRYPTION") {
        const payload = privacyEngine.encryption.encrypt(serializedPayload);
        serializedPayload = JSON.stringify(payload);
        encrypted = true;
        sizeBytes = payload.bytes;
      }

      const updateHash = `0x${createHash("sha256").update(result.serializedDelta).digest("hex")}`;

      await emit({
        type: "UPDATE_ENCRYPTED", participantId: p.participantId, participantName: p.organizationName,
        message: `${p.organizationName}: update ${encrypted ? "encrypted (AES-256-GCM) + masked" : "masked (secure aggregation)"} — hash ${updateHash.slice(0, 18)}…`,
        data: { algo: encrypted ? "AES-256-GCM + additive mask" : "additive mask (zero-sum)", updateHash, bytes: sizeBytes },
      });

      // TrainingRun + ModelUpdate persistence (only updates/metadata travel)
      await db.trainingRun.create({
        data: {
          roundId: roundRow.id,
          participantId: p.participantId,
          organizationName: p.organizationName,
          status: "COMPLETED",
          epochs: config.epochs,
          samples: result.sampleCount,
          localMetrics: JSON.stringify(result.localMetrics),
          durationMs: result.durationMs,
          completedAt: new Date(),
        },
      });
      await db.modelUpdate.create({
        data: {
          roundId: roundRow.id,
          participantId: p.participantId,
          organizationName: p.organizationName,
          sampleCount: result.sampleCount,
          updateHash,
          encrypted,
          privacyMode: config.privacyMode,
          sizeBytes,
          updateNorm: norm(result.updateVector),
          payload: serializedPayload,
          metrics: JSON.stringify(result.localMetrics),
        },
      });
      await db.privacyEvent.create({
        data: {
          type: "UPDATE_ENCRYPTED",
          organizationId: p.organizationId,
          roundId: roundRow.id,
          modelName: model.name,
          description: `${p.organizationName} submitted a ${encrypted ? "encrypted, " : ""}masked model update — raw data never left the participant environment`,
          metadata: JSON.stringify({ algo: encrypted ? "AES-256-GCM" : "pairwise additive mask", updateHash }),
        },
      });
      await audit({ actor: p.organizationName, organization: p.organizationName, eventType: "UPDATE_SUBMITTED", resource: `round #${roundNumber}`, metadata: { updateHash, samples: result.sampleCount } });

      await emit({
        type: "UPDATE_SUBMITTED", participantId: p.participantId, participantName: p.organizationName,
        message: `${p.organizationName}: protected update submitted to aggregator`,
        data: { updateHash, sampleCount: result.sampleCount },
      });

      submissions.push({ runtime: p, maskedVec, result, updateHash, sizeBytes, encrypted, serializedPayload, globalValBefore });
    }

    // ── 4. SECURE AGGREGATION (masks cancel — only the aggregate is recoverable) ──
    await emit({ type: "SECURE_AGGREGATION", message: `Secure aggregation of ${submissions.length} protected updates (masks cancel — individual updates never visible)` });

    const aggregated = privacyEngine.aggregator.aggregateMasked(
      submissions.map((s) => s.maskedVec),
      submissions.map((s) => s.result.sampleCount)
    );
    const aggregateDelta: Weights = unflattenWeights(aggregated, globalModel.config.inputDim, globalModel.config.hiddenDim);

    // ── 5. GLOBAL_MODEL_UPDATED + real evaluation ──
    const newWeights = applyDelta(globalModel.weights, aggregateDelta);
    const newGlobal = globalModel.clone();
    newGlobal.weights = newWeights;

    // evaluate the new global model at every participant (metrics only, no data moves)
    const evals = submissions.map((s) => s.runtime.node.evaluateOnLocalTest(newGlobal));
    const totalTest = evals.reduce((sum, e) => sum + e.n, 0) || 1;
    const globalPrimary = evals.reduce((sum, e) => sum + e.primary * (e.n / totalTest), 0);
    const task = model.taskType;
    const avgMetrics: Record<string, number> = {};
    const perParticipant = evals.map((e, i) => ({ organization: submissions[i].runtime.organizationName, metrics: e.metrics, primary: e.primary }));
    for (const key of Object.keys(evals[0].metrics)) {
      avgMetrics[key] = round(evals.reduce((s, e) => s + (e.metrics[key] ?? 0) * (e.n / totalTest), 0), 4);
    }

    const improvement = globalPrimary - prevAccuracy;
    const newVersion = `v1.${roundNumber}`;
    const weightsJson = newGlobal.serialize();
    const modelHash = `0x${createHash("sha256").update(`${weightsJson}::${newVersion}::${roundRow.id}`).digest("hex")}`;

    await db.modelVersion.create({
      data: {
        modelId, version: newVersion, roundId: roundRow.id, roundNumber,
        accuracy: round(globalPrimary, 4), metrics: JSON.stringify({ ...avgMetrics, perParticipant }),
        modelHash, participantCount: submissions.length, privacyMode: config.privacyMode, weights: weightsJson,
      },
    });
    await db.federatedRound.update({
      where: { id: roundRow.id },
      data: {
        encryptedUpdates: submissions.filter((s) => s.encrypted).length,
        aggregateMetrics: JSON.stringify({ global: avgMetrics, perParticipant, samples: totalTest }),
        metricsAfter: round(globalPrimary, 4),
        improvement: round(improvement, 4),
      },
    });
    await db.model.update({
      where: { id: modelId },
      data: { currentVersion: newVersion, currentAccuracy: round(globalPrimary, 4), latestMetrics: JSON.stringify(avgMetrics), modelHash, status: "ACTIVE" },
    });
    await db.dataset.updateMany({
      where: { ownerId: { in: submissions.map((s) => s.runtime.organizationId) } },
      data: { lastRoundNumber: roundNumber, status: "ENCRYPTED_UPDATES_ONLY" },
    });
    await audit({ actor, eventType: "AGGREGATION_COMPLETED", resource: `${model.name} #${roundNumber}`, metadata: { newVersion, accuracy: globalPrimary } });
    await db.privacyEvent.create({
      data: {
        type: "SECURE_AGGREGATION",
        roundId: roundRow.id,
        modelName: model.name,
        description: `Aggregator combined ${submissions.length} masked updates into a new global model — individual updates were never decryptable`,
        metadata: JSON.stringify({ participants: submissions.length, zeroSum: true }),
      },
    });

    await emit({
      type: "GLOBAL_MODEL_UPDATED",
      message: `Global model updated → ${newVersion} — ${task === "REGRESSION" ? "R²" : "accuracy"} ${(globalPrimary * 100).toFixed(1)}% (${improvement >= 0 ? "+" : ""}${(improvement * 100).toFixed(1)} pts)`,
      data: { newVersion, accuracy: globalPrimary, improvement, metrics: avgMetrics, perParticipant },
    });

    // ── 6. CONTRIBUTION SCORING + REWARDS (real backend computation) ──
    await emit({ type: "REWARD_CALCULATED", message: `Computing transparent contribution scores and allocating the ${ROUND_REWARD_POOL} DATA round reward pool` });

    const contributions: ContributionInput[] = submissions.map((s) => {
      const localImprove = s.result.localPrimary - s.globalValBefore; // real local improvement signal
      const participantRow = participants.find((p) => p.participantId === s.runtime.participantId)!;
      return {
        participantId: s.runtime.participantId,
        organizationId: s.runtime.organizationId,
        organizationName: s.runtime.organizationName,
        roundNumber,
        sampleCount: s.result.sampleCount,
        quality: qualityScore(task, s.result.localPrimary),
        improvement: Math.max(0, 0.5 + localImprove),
        participation: roundNumber > 1 ? Math.min(1, participantRow.roundsParticipated / Math.max(1, roundNumber - 1)) : 1,
      };
    });
    const scored = scoreContributions(contributions);
    const rewardRows = await persistRoundRewards(roundRow.id, modelId, scored, model.name);

    await emit({
      type: "REWARD_CALCULATED",
      message: `Rewards allocated: ${scored.map((s) => `${s.organizationName} ${s.rewardAmount.toFixed(0)} DATA`).join(" · ")}`,
      data: { rewards: scored.map((s) => ({ org: s.organizationName, score: s.normalizedScore, reward: s.rewardAmount })) },
    });

    // ── 7. BLOCKCHAIN RECORDING ──
    await emit({ type: "BLOCKCHAIN_RECORDED", message: "Recording contribution proofs and reward allocations on the local test network" });

    const platformWallet = "0x00000000000000000000000000000000000da0a";
    const txs = submissions.map((s) => ({
      fromAddress: platformWallet,
      toAddress: s.runtime.walletAddress,
      action: "RECORD_CONTRIBUTION" as const,
      amount: 0,
      roundNumber,
      modelName: model.name,
      participantName: s.runtime.organizationName,
      metadata: { updateHash: s.updateHash, samples: s.result.sampleCount, score: scored.find((c) => c.participantId === s.runtime.participantId)?.normalizedScore },
    }));
    const rewardTxs = submissions.map((s) => ({
      fromAddress: platformWallet,
      toAddress: s.runtime.walletAddress,
      action: "ALLOCATE_REWARD" as const,
      amount: scored.find((c) => c.participantId === s.runtime.participantId)?.rewardAmount ?? 0,
      roundNumber,
      modelName: model.name,
      participantName: s.runtime.organizationName,
      metadata: { pool: ROUND_REWARD_POOL },
    }));
    const { blockNumber, txHashes } = await blockchain.appendBlock([...txs, ...rewardTxs]);

    // attach tx hashes to rewards
    for (let i = 0; i < rewardRows.length; i++) {
      const txHash = txHashes[txs.length + i];
      await db.reward.updateMany({ where: { roundId: roundRow.id, participantId: rewardRows[i].participantId }, data: { txHash } });
    }
    await audit({ actor: "blockchain-service", eventType: "BLOCKCHAIN_RECORDED", resource: `round #${roundNumber}`, metadata: { blockNumber, txs: txHashes.length } });
    await emit({
      type: "BLOCKCHAIN_RECORDED",
      message: `Block #${blockNumber} mined with ${txHashes.length} transactions — contribution proofs anchored on-chain`,
      data: { blockNumber, txHashes },
    });

    // ── 8. ROUND_COMPLETED ──
    const durationMs = Date.now() - started;
    await db.federatedRound.update({
      where: { id: roundRow.id },
      data: { status: "COMPLETED", completedAt: new Date(), durationMs },
    });
    await audit({ actor, eventType: "ROUND_COMPLETED", resource: `${model.name} #${roundNumber}`, metadata: { accuracy: globalPrimary, improvement } });
    await db.notification.create({
      data: {
        type: "ROUND_COMPLETED",
        title: `Federated Round #${roundNumber} completed`,
        message: `${model.name}: ${task === "REGRESSION" ? "R²" : "accuracy"} ${(globalPrimary * 100).toFixed(1)}% (${improvement >= 0 ? "+" : ""}${(improvement * 100).toFixed(1)} pts). ${scored.reduce((s, c) => s + c.rewardAmount, 0).toFixed(0)} DATA rewards allocated.`,
      },
    });
    await emit({
      type: "ROUND_COMPLETED",
      message: `Round #${roundNumber} complete — ${task === "REGRESSION" ? "R²" : "accuracy"} ${(globalPrimary * 100).toFixed(1)}%, rewards on-chain in block #${blockNumber}`,
      data: { accuracy: globalPrimary, improvement, blockNumber, rewards: scored.map((s) => ({ org: s.organizationName, amount: s.rewardAmount })) },
    });

    latestVersion = await db.modelVersion.findFirst({ where: { modelId }, orderBy: { createdAt: "desc" } });
    return { roundId: roundRow.id, status: "COMPLETED", accuracyBefore: prevAccuracy, accuracyAfter: round(globalPrimary, 4), improvement: round(improvement, 4) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (roundRow) {
      await db.federatedRound.update({ where: { id: roundRow.id }, data: { status: "FAILED", error: message, completedAt: new Date() } }).catch(() => {});
      await audit({ actor, eventType: "ROUND_FAILED", resource: `${model.name} #${roundNumber}`, status: "FAILED", metadata: { error: message } }).catch(() => {});
      eventBus.publish({
        type: "ROUND_FAILED", roundId: roundRow.id, modelId, modelName: model.name, roundNumber,
        message: `Round #${roundNumber} failed: ${message}`, timestamp: new Date().toISOString(),
      });
    }
    throw err;
  } finally {
    g.__dvRunning!.delete(modelId);
  }
}

/** Run N rounds sequentially (the "Start Federated Training" action). */
export async function runFederation(opts: {
  modelId: string;
  rounds: number;
  config?: Partial<RoundConfig>;
  actor: string;
  actorRole?: string;
  onRoundComplete?: (result: { roundNumber: number; accuracyAfter: number }) => Promise<void> | void;
}) {
  const model = await db.model.findUnique({ where: { id: opts.modelId } });
  if (!model) throw new Error("Model not found");
  let last = await db.federatedRound.findFirst({ where: { modelId: opts.modelId }, orderBy: { roundNumber: "desc" } });
  const results = [];
  for (let i = 0; i < opts.rounds; i++) {
    const roundNumber = (last?.roundNumber ?? 0) + 1;
    const r = await runFederatedRound({ modelId: opts.modelId, roundNumber, config: opts.config, actor: opts.actor, actorRole: opts.actorRole });
    results.push(r);
    last = await db.federatedRound.findFirst({ where: { modelId: opts.modelId }, orderBy: { roundNumber: "desc" } });
    await opts.onRoundComplete?.({ roundNumber, accuracyAfter: r.accuracyAfter });
  }
  return results;
}

const norm = (v: Float64Array) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
