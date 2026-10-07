import { db } from "@/lib/db";
import { ok, fail, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/models/[id] — model detail (spec §12): versions, participants, metrics, privacy, proofs. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const model = await db.model.findUnique({
      where: { id },
      include: {
        participants: { include: { organization: { include: { wallet: true } } } },
        listing: true,
      },
    });
    if (!model) return fail("Model not found", 404);

    const versions = await db.modelVersion.findMany({
      where: { modelId: id },
      orderBy: { roundNumber: "asc" },
      select: { id: true, version: true, roundNumber: true, accuracy: true, metrics: true, modelHash: true, participantCount: true, privacyMode: true, createdAt: true },
    });

    const rounds = await db.federatedRound.findMany({
      where: { modelId: id },
      orderBy: { roundNumber: "desc" },
      take: 30,
      select: {
        id: true, roundNumber: true, status: true, metricsBefore: true, metricsAfter: true,
        improvement: true, durationMs: true, encryptedUpdates: true, error: true,
        startedAt: true, completedAt: true, aggregateMetrics: true,
      },
    });

    const contributions = await db.contribution.findMany({
      where: { round: { modelId: id } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        organizationName: true, roundNumber: true, sampleCount: true, normalizedScore: true,
        rawScore: true, qualityScore: true, improvementScore: true, participationScore: true, createdAt: true,
      },
    });

    const privacyEvents = await db.privacyEvent.findMany({
      where: { modelName: model.name },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const blockchainTxs = await db.blockchainTransaction.findMany({
      where: { modelName: model.name },
      orderBy: { timestamp: "desc" },
      take: 30,
    });

    const auditTrail = await db.auditLog.findMany({
      where: { resource: { contains: model.name } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const metrics = model.latestMetrics ? JSON.parse(model.latestMetrics) : {};

    return ok({
      model: {
        id: model.id, name: model.name, slug: model.slug, useCase: model.useCase,
        industry: model.industry, taskType: model.taskType, framework: model.framework,
        status: model.status, privacyMode: model.privacyMode, description: model.description,
        version: model.currentVersion, accuracyBefore: model.baselineAccuracy,
        accuracyAfter: model.currentAccuracy, metrics, modelHash: model.modelHash,
        featureNames: model.featureNames ? JSON.parse(model.featureNames) : [],
        createdAt: model.createdAt,
        listing: model.listing,
      },
      participants: model.participants.map((p) => ({
        id: p.id, status: p.status, roundsParticipated: p.roundsParticipated,
        lifetimeScore: p.lifetimeScore, lastRoundAt: p.lastRoundAt,
        organization: {
          id: p.organization.id, name: p.organization.name, slug: p.organization.slug,
          walletAddress: p.organization.wallet?.address ?? null,
        },
      })),
      versions: versions.map((v) => ({
        ...v,
        metrics: v.metrics ? JSON.parse(v.metrics) : {},
      })),
      rounds: rounds.map((r) => ({
        ...r,
        aggregateMetrics: r.aggregateMetrics ? JSON.parse(r.aggregateMetrics) : null,
      })),
      contributions,
      privacyEvents,
      blockchainTxs,
      auditTrail,
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
