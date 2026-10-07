import { db } from "@/lib/db";
import { ok, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/contributions — transparent contribution ledger (spec §36). */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const modelId = url.searchParams.get("modelId") ?? undefined;
    const orgId = url.searchParams.get("organizationId") ?? undefined;
    const take = Math.min(300, Number(url.searchParams.get("take") ?? 150));

    const contributions = await db.contribution.findMany({
      where: {
        ...(modelId ? { round: { modelId } } : {}),
        ...(orgId ? { organizationId: orgId } : {}),
      },
      include: {
        round: { select: { modelName: true, metricsAfter: true } },
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return ok({
      contributions: contributions.map((c) => ({
        id: c.id, organization: c.organization.name, roundNumber: c.roundNumber,
        model: c.round.modelName, roundAccuracy: c.round.metricsAfter,
        sampleCount: c.sampleCount, rawScore: c.rawScore, normalizedScore: c.normalizedScore,
        sampleShare: c.sampleShare, qualityScore: c.qualityScore,
        improvementScore: c.improvementScore, participationScore: c.participationScore,
        lifetimeScore: c.lifetimeScore, createdAt: c.createdAt,
      })),
      formula: {
        raw: "raw_score = 0.35·sample_share + 0.25·training_quality + 0.25·model_improvement + 0.15·participation_consistency",
        normalized: "normalized_score = raw_score / Σ raw_scores (per round)",
        lifetime: "lifetime_score = Σ normalized_score across rounds",
        reward: "reward = ROUND_REWARD_POOL (1000 DATA) × normalized_score",
      },
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
