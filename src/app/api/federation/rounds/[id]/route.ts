import { db } from "@/lib/db";
import { ok, fail, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/federation/rounds/[id] — full round detail (spec §13). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const round = await db.federatedRound.findUnique({
      where: { id },
      include: { model: { select: { id: true, name: true, taskType: true, industry: true } } },
    });
    if (!round) return fail("Round not found", 404);

    const runs = await db.trainingRun.findMany({ where: { roundId: id }, orderBy: { startedAt: "asc" } });
    const updates = await db.modelUpdate.findMany({
      where: { roundId: id },
      select: { id: true, organizationName: true, sampleCount: true, updateHash: true, encrypted: true, privacyMode: true, sizeBytes: true, updateNorm: true, metrics: true, submittedAt: true },
    });
    const contributions = await db.contribution.findMany({ where: { roundId: id } });
    const rewards = await db.reward.findMany({ where: { roundId: id } });
    const privacyEvents = await db.privacyEvent.findMany({ where: { roundId: id } });

    return ok({
      round: {
        ...round,
        config: round.config ? JSON.parse(round.config) : null,
        aggregateMetrics: round.aggregateMetrics ? JSON.parse(round.aggregateMetrics) : null,
      },
      trainingRuns: runs.map((r) => ({ ...r, localMetrics: r.localMetrics ? JSON.parse(r.localMetrics) : null })),
      updates: updates.map((u) => ({ ...u, metrics: u.metrics ? JSON.parse(u.metrics) : null })),
      contributions,
      rewards,
      privacyEvents,
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
