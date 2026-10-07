import { db } from "@/lib/db";
import { ok, withAuth } from "@/server/api-helpers";
import { eventBus } from "@/server/federation/event-bus";

export const dynamic = "force-dynamic";

/** GET /api/federation/status — live run state + participant network snapshot. */
export async function GET() {
  return withAuth(async () => {
    const models = await db.model.findMany({
      include: { participants: { include: { organization: { include: { wallet: true } } } } },
      orderBy: { createdAt: "asc" },
    });

    const networks = models.map((m) => ({
      modelId: m.id,
      modelName: m.name,
      taskType: m.taskType,
      industry: m.industry,
      version: m.currentVersion,
      currentAccuracy: m.currentAccuracy,
      baselineAccuracy: m.baselineAccuracy,
      privacyMode: m.privacyMode,
      status: m.status,
      participants: m.participants.map((p) => ({
        id: p.id,
        name: p.organization.name,
        slug: p.organization.slug,
        status: p.status,
        walletAddress: p.organization.wallet?.address ?? null,
        lifetimeScore: p.lifetimeScore,
        roundsParticipated: p.roundsParticipated,
      })),
    }));

    const lastRound = await db.federatedRound.findFirst({ orderBy: { createdAt: "desc" } });
    return ok({
      networks,
      lastRound,
      recentEvents: eventBus.history.slice(-12),
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
