/**
 * DataVault — Contribution scoring & reward engine (spec §36, §37).
 *
 * Transparent formula (displayed in the UI help dialog):
 *   raw_score = 0.35·sample_share + 0.25·quality + 0.25·improvement + 0.15·participation
 *   normalized_score = raw_score / Σ raw_scores
 *   participant_reward = ROUND_REWARD_POOL × normalized_score
 *
 * All values are computed by the backend from real training telemetry —
 * nothing is hardcoded per-user (spec §37).
 */
import { db } from "@/lib/db";

export const ROUND_REWARD_POOL = 1000; // DATA tokens per round

export interface ContributionInput {
  participantId: string;
  organizationId: string;
  organizationName: string;
  roundNumber: number;
  sampleCount: number;
  /** local validation quality in [0,1] (e.g. 1 − normalized loss, or accuracy) */
  quality: number;
  /** how aligned this participant's update was with the global improvement direction */
  improvement: number;
  /** participation consistency: rounds attended / rounds so far */
  participation: number;
}

export interface ScoredContribution extends ContributionInput {
  rawScore: number;
  normalizedScore: number;
  sampleShare: number;
  qualityScore: number;
  improvementScore: number;
  participationScore: number;
  rewardAmount: number;
}

export function scoreContributions(inputs: ContributionInput[]): ScoredContribution[] {
  const totalSamples = inputs.reduce((s, i) => s + i.sampleCount, 0) || 1;
  const totalRaw = inputs.reduce((s, i) => s + rawScoreOf(i, totalSamples), 0) || 1e-9;

  return inputs.map((i) => {
    const raw = rawScoreOf(i, totalSamples);
    const normalized = raw / totalRaw;
    return {
      ...i,
      rawScore: raw,
      normalizedScore: normalized,
      sampleShare: totalSamples ? i.sampleCount / totalSamples : 0,
      qualityScore: clamp01(i.quality),
      improvementScore: clamp01(i.improvement),
      participationScore: clamp01(i.participation),
      rewardAmount: Math.round(ROUND_REWARD_POOL * normalized * 100) / 100,
    };
  });
}

function rawScoreOf(i: ContributionInput, totalSamples: number): number {
  const sampleShare = totalSamples ? i.sampleCount / totalSamples : 0;
  const quality = clamp01(i.quality);
  const improvement = clamp01(i.improvement);
  const participation = clamp01(i.participation);
  return 0.35 * sampleShare + 0.25 * quality + 0.25 * improvement + 0.15 * participation;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v || 0));

/**
 * Improvement score: cosine alignment between the participant's update vector
 * and the final aggregate improvement direction — a real, computable measure
 * of "how much did this update pull the global model toward improvement".
 */
export function improvementScore(updateVec: Float64Array, aggregateVec: Float64Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < updateVec.length; i++) {
    dot += updateVec[i] * aggregateVec[i];
    na += updateVec[i] ** 2;
    nb += aggregateVec[i] ** 2;
  }
  if (na === 0 || nb === 0) return 0.5;
  const cos = dot / (Math.sqrt(na) * Math.sqrt(nb)); // [-1, 1]
  return (cos + 1) / 2; // map to [0, 1]
}

/** Quality score: local validation quality (accuracy or R² normalized). */
export function qualityScore(taskType: string, localMetric: number): number {
  return clamp01(taskType === "REGRESSION" ? Math.max(0, localMetric) : localMetric);
}

/** Persist contributions + rewards and update org lifetime stats. */
export async function persistRoundRewards(roundId: string, modelId: string, scored: ScoredContribution[], modelName: string) {
  const results: { participantId: string; organizationId: string; amount: number; txHash: string; normalizedScore: number }[] = [];
  for (const c of scored) {
    const participant = await db.participant.findFirst({ where: { id: c.participantId } });
    const lifetime = (participant?.lifetimeScore ?? 0) + c.normalizedScore;

    await db.contribution.create({
      data: {
        roundId,
        participantId: c.participantId,
        organizationId: c.organizationId,
        roundNumber: c.roundNumber,
        sampleCount: c.sampleCount,
        rawScore: round(c.rawScore, 6),
        normalizedScore: round(c.normalizedScore, 6),
        sampleShare: round(c.sampleShare, 6),
        qualityScore: round(c.qualityScore, 6),
        improvementScore: round(c.improvement, 6),
        participationScore: round(c.participation, 6),
        lifetimeScore: round(lifetime, 6),
      },
    });

    await db.reward.create({
      data: {
        roundId,
        participantId: c.participantId,
        organizationId: c.organizationId,
        roundNumber: c.roundNumber,
        amount: c.rewardAmount,
        status: "AVAILABLE",
        score: round(c.normalizedScore, 6),
      },
    });

    await db.participant.update({
      where: { id: c.participantId },
      data: { lifetimeScore: round(lifetime, 6), roundsParticipated: { increment: 1 }, lastRoundAt: new Date() },
    });

    const wallet = await db.wallet.findFirst({ where: { org: { id: c.organizationId } } });
    if (wallet) {
      await db.wallet.update({
        where: { id: wallet.id },
        data: {
          pending: round(wallet.pending + c.rewardAmount, 2),
          totalEarned: round(wallet.totalEarned + c.rewardAmount, 2),
        },
      });
    }

    results.push({ participantId: c.participantId, organizationId: c.organizationId, amount: c.rewardAmount, txHash: "", normalizedScore: c.normalizedScore });
    void modelName;
  }
  return results;
}

const round = (v: number, d: number) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : 0);
