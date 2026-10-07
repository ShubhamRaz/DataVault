import { db } from "@/lib/db";
import { ok, fail, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/marketplace/[id] — listing detail (spec §18). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const listing = await db.marketplaceListing.findUnique({
      where: { id },
      include: {
        model: {
          include: {
            participants: { include: { organization: { include: { wallet: true } } } },
            versions: { orderBy: { roundNumber: "desc" }, take: 5, select: { version: true, accuracy: true, roundNumber: true, modelHash: true, createdAt: true } },
          },
        },
        accessRequests: { include: { organization: { select: { name: true, slug: true } } } },
      },
    });
    if (!listing) return fail("Listing not found", 404);

    const rounds = await db.federatedRound.findMany({
      where: { modelId: listing.modelId, status: "COMPLETED" },
      orderBy: { roundNumber: "desc" }, take: 10,
      select: { roundNumber: true, metricsAfter: true, improvement: true, encryptedUpdates: true, completedAt: true },
    });

    return ok({
      listing: {
        id: listing.id, modelId: listing.modelId, title: listing.title, description: listing.description,
        useCase: listing.useCase, industry: listing.industry, performance: listing.performance,
        privacyMethod: listing.privacyMethod, trainingRounds: listing.trainingRounds,
        price: listing.price, accessPolicy: listing.accessPolicy, status: listing.status,
        participants: listing.participantOrgs ? JSON.parse(listing.participantOrgs) : [],
        createdAt: listing.createdAt,
      },
      model: {
        id: listing.model.id, name: listing.model.name, slug: listing.model.slug,
        taskType: listing.model.taskType, currentAccuracy: listing.model.currentAccuracy,
        baselineAccuracy: listing.model.baselineAccuracy, version: listing.model.currentVersion,
        metrics: listing.model.latestMetrics ? JSON.parse(listing.model.latestMetrics) : {},
        privacyMode: listing.model.privacyMode, modelHash: listing.model.modelHash,
        versions: listing.model.versions,
        participants: listing.model.participants.map((p) => ({
          name: p.organization.name, slug: p.organization.slug,
          walletAddress: p.organization.wallet?.address ?? null,
          lifetimeScore: p.lifetimeScore, roundsParticipated: p.roundsParticipated,
        })),
      },
      rounds,
      accessRequests: listing.accessRequests.map((ar) => ({
        id: ar.id, organization: ar.organization.name, status: ar.status,
        message: ar.message, createdAt: ar.createdAt,
      })),
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
