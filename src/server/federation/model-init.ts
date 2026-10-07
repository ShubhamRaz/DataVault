/**
 * DataVault — Global model initialization (spec §14, §51).
 * Creates the federated model registry entry, v1.0 global model, federated
 * standardizer (aggregate feature statistics — metadata, never raw records),
 * and the SILO BASELINE: each participant trains a local-only model and it is
 * cross-evaluated across the network → "before federation" accuracy.
 */
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { MLPModel, fitStandardizer, trainLocal } from "../ml/mlp";
import { ParticipantNode, participantFromDisk } from "./participant-node";
import { PARTICIPANT_SPECS } from "../demo-specs";
import { audit } from "../audit";
import { blockchain, deriveWalletAddress } from "../blockchain/ledger";

export interface CreateModelInput {
  name: string;
  slug: string;
  useCase: string;
  industry: string;
  taskType: "CLASSIFICATION" | "REGRESSION";
  description: string;
  participantSlugs: string[];
  actor: string;
  actorRole?: string;
  privacyMode?: "DEMO" | "ENCRYPTION";
}

export async function createGlobalModel(input: CreateModelInput) {
  const participants = input.participantSlugs.map((slug) =>
    participantFromDisk(slug, slug, PARTICIPANT_SPECS[slug] ?? PARTICIPANT_SPECS["hospital-a"])
  );

  // 1. Federated standardizer = sample-weighted average of participant feature stats.
  //    Feature statistics are metadata — no raw records are exchanged.
  const stats = participants.map((p) => p.localFeatureStats());
  const totalN = stats.reduce((s, x) => s + x.n, 0) || 1;
  const inputDim = stats[0].mean.length;
  const mean = new Float64Array(inputDim);
  const std = new Float64Array(inputDim);
  for (const s of stats) {
    const w = s.n / totalN;
    for (let j = 0; j < inputDim; j++) {
      mean[j] += s.mean[j] * w;
      std[j] += s.std[j] * w;
    }
  }

  // 2. Initial global model v1.0 (random init + federated standardizer)
  const model = new MLPModel({
    inputDim,
    hiddenDim: 16,
    task: input.taskType,
    lr: 0.08, batchSize: 32, epochs: 4, l2: 0.0005, seed: 42,
  });
  model.setStandardizer({ mean, std });
  const weightsJson = model.serialize();
  const modelHash = `0x${createHash("sha256").update(`${weightsJson}::v1.0::init`).digest("hex")}`;

  const dbModel = await db.model.create({
    data: {
      name: input.name,
      slug: input.slug,
      useCase: input.useCase,
      industry: input.industry,
      taskType: input.taskType,
      framework: "Custom MLP (TS engine) / PyTorch (ml-service)",
      status: "ACTIVE",
      privacyMode: input.privacyMode ?? "DEMO",
      description: input.description,
      currentVersion: "v1.0",
      featureNames: JSON.stringify(participants[0].dataset.featureNames),
      modelHash,
      createdById: input.actor,
      latestMetrics: JSON.stringify({}),
    },
  });
  await db.modelVersion.create({
    data: {
      modelId: dbModel.id, version: "v1.0", roundNumber: 0,
      accuracy: 0, metrics: JSON.stringify({ note: "initial random-init global model" }),
      modelHash, participantCount: participants.length,
      privacyMode: input.privacyMode ?? "DEMO", weights: weightsJson,
    },
  });

  // 3. Actual accuracy of the initial random-init global model (v1.0), evaluated locally at every participant
  const allTestN = participants.reduce((s, p) => s + p.splits.test.X.length, 0);
  let initialAccuracy = 0;
  for (const p of participants) {
    const ev = p.evaluateOnLocalTest(model);
    initialAccuracy += ev.primary * (ev.n / (allTestN || 1));
  }

  // 4. SILO BASELINE — local-only models cross-evaluated across the network.
  //    This is the honest "before federation" number: how well would models
  //    trained in isolation serve the whole network?
  const siloModels = participants.map((p) => {
    const m = new MLPModel({
      inputDim, hiddenDim: 16, task: input.taskType,
      lr: 0.08, batchSize: 32, epochs: 25, l2: 0.0005, seed: 777 + p.dataset.sampleCount,
    });
    m.setStandardizer({ mean, std });
    trainLocal(m, p.splits.train.X, p.splits.train.y);
    return m;
  });

  const siloDetail: { organization: string; localAccuracy: number; crossAccuracy: number }[] = [];
  for (let i = 0; i < participants.length; i++) {
    const own = participants[i].evaluateOnLocalTest(siloModels[i]).primary;
    let crossSum = 0;
    for (let j = 0; j < participants.length; j++) {
      const ev = participants[j].evaluateOnLocalTest(siloModels[i]);
      crossSum += ev.primary * (ev.n / (allTestN || 1));
    }
    siloDetail.push({ organization: participants[i].name, localAccuracy: round(own, 4), crossAccuracy: round(crossSum, 4) });
  }
  // average across silo models (each equally weighted as the "isolated org" scenario)
  const baseline = round(
    siloDetail.reduce((s, d) => s + d.crossAccuracy, 0) / (siloDetail.length || 1),
    4
  );

  await db.model.update({
    where: { id: dbModel.id },
    data: {
      baselineAccuracy: baseline,
      currentAccuracy: round(initialAccuracy, 4),
      latestMetrics: JSON.stringify({ initialAccuracy: round(initialAccuracy, 4), siloBaseline: baseline, siloDetail }),
    },
  });
  await db.modelVersion.updateMany({
    where: { modelId: dbModel.id, version: "v1.0" },
    data: { accuracy: round(initialAccuracy, 4), metrics: JSON.stringify({ initialAccuracy: round(initialAccuracy, 4), siloBaseline: baseline, siloDetail }) },
  });

  // 4. Register participants + datasets on the registry
  for (const slug of input.participantSlugs) {
    const org = await db.organization.findUnique({ where: { slug } });
    if (!org) continue;
    await db.participant.create({
      data: { organizationId: org.id, modelId: dbModel.id, status: "ACTIVE", datasetId: null },
    });
  }

  // 5. Anchor the model creation proof on the ledger
  const { blockNumber } = await blockchain.appendBlock(
    input.participantSlugs.map((slug) => ({
      fromAddress: "0x00000000000000000000000000000000000da0a",
      toAddress: deriveWalletAddress(slug),
      action: "REGISTER_PARTICIPANT" as const,
      amount: 0,
      modelName: input.name,
      participantName: slug,
      metadata: { modelHash },
    }))
  );

  await audit({
    actor: input.actor, actorRole: input.actorRole, eventType: "MODEL_CREATED",
    resource: input.name,
    metadata: { modelId: dbModel.id, participants: input.participantSlugs, baseline, blockNumber },
  });

  return { model: dbModel, baseline: round(baseline, 4), siloDetail, modelHash, blockNumber };
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
