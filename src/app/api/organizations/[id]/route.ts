import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/organizations/[id] — detail with activity tabs (spec §11). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const org = await db.organization.findUnique({
      where: { id },
      include: { wallet: true, users: { select: { id: true, name: true, email: true, role: true, lastLoginAt: true } }, datasets: true },
    });
    if (!org) return fail("Organization not found", 404);

    const participants = await db.participant.findMany({
      where: { organizationId: org.id },
      include: { model: { select: { id: true, name: true, slug: true, currentAccuracy: true, taskType: true, currentVersion: true } } },
      orderBy: { createdAt: "asc" },
    });

    const contributions = await db.contribution.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, roundNumber: true, sampleCount: true, normalizedScore: true, rawScore: true, qualityScore: true, improvementScore: true, participationScore: true, createdAt: true, round: { select: { modelName: true } } },
    });

    const rewards = await db.reward.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, roundNumber: true, amount: true, status: true, score: true, txHash: true, createdAt: true, claimedAt: true, round: { select: { modelName: true } } },
    });

    const privacyEvents = await db.privacyEvent.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const auditEvents = await db.auditLog.findMany({
      where: { organization: org.name },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const trainingRuns = await db.trainingRun.count({ where: { participant: { organizationId: org.id } } });

    return ok({
      organization: {
        ...org,
        walletAddress: org.wallet?.address ?? null,
        walletBalance: org.wallet ?? null,
        trainingRuns,
      },
      participants: participants.map((p) => ({
        id: p.id, status: p.status, roundsParticipated: p.roundsParticipated, lifetimeScore: p.lifetimeScore,
        lastRoundAt: p.lastRoundAt, model: p.model,
      })),
      contributions,
      rewards,
      privacyEvents,
      auditEvents,
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}

/** PATCH — admin approves/suspends organization. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async ({ user }) => {
    const body = await readJson<{ status?: string; verification?: string }>(req);
    const org = await db.organization.findUnique({ where: { id } });
    if (!org) return fail("Organization not found", 404);

    const data: Record<string, string> = {};
    if (body.status && ["PENDING", "ACTIVE", "SUSPENDED"].includes(body.status)) data.status = body.status;
    if (body.verification && ["UNVERIFIED", "VERIFIED"].includes(body.verification)) data.verification = body.verification;
    if (Object.keys(data).length === 0) return fail("Nothing to update");

    const updated = await db.organization.update({ where: { id }, data });
    await audit({
      actor: user.email, actorRole: user.role, organization: org.name,
      eventType: "ORGANIZATION_APPROVED", resource: org.slug, metadata: data,
    });
    return ok({ organization: { id: updated.id, status: updated.status, verification: updated.verification } });
  }, ["ADMIN"]);
}
