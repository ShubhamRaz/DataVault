import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace — AI model marketplace (spec §18, §53).
 * Listings are MODELS and collaboration opportunities — never raw datasets.
 */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const industry = url.searchParams.get("industry") ?? undefined;
    const privacyMethod = url.searchParams.get("privacyMethod") ?? undefined;
    const accessPolicy = url.searchParams.get("accessPolicy") ?? undefined;
    const q = url.searchParams.get("q")?.toLowerCase() ?? undefined;
    const maxPrice = url.searchParams.get("maxPrice");

    const listings = await db.marketplaceListing.findMany({
      where: {
        ...(industry && industry !== "all" ? { industry } : {}),
        ...(privacyMethod && privacyMethod !== "all" ? { privacyMethod } : {}),
        ...(accessPolicy && accessPolicy !== "all" ? { accessPolicy } : {}),
        ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }, { useCase: { contains: q } }] } : {}),
        ...(maxPrice ? { price: { lte: Number(maxPrice) } } : {}),
      },
      include: {
        model: { select: { id: true, slug: true, taskType: true, currentAccuracy: true, currentVersion: true, baselineAccuracy: true } },
        accessRequests: { include: { organization: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({
      listings: listings.map((l) => ({
        id: l.id, modelId: l.modelId, title: l.title, description: l.description,
        useCase: l.useCase, industry: l.industry, performance: l.performance,
        privacyMethod: l.privacyMethod, trainingRounds: l.trainingRounds,
        price: l.price, accessPolicy: l.accessPolicy, status: l.status,
        participants: l.participantOrgs ? JSON.parse(l.participantOrgs) : [],
        model: l.model,
        accessRequests: l.accessRequests.map((ar) => ({
          id: ar.id, organization: ar.organization.name, status: ar.status,
          message: ar.message, createdAt: ar.createdAt,
        })),
        createdAt: l.createdAt,
      })),
      principle: "DataVault lists federated models and AI collaboration opportunities — never raw personal datasets. Collaborate on AI without transferring raw data.",
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}

/** POST /api/marketplace — publish a listing for a federated model. */
export async function POST(req: Request) {
  return withAuth(async ({ user }) => {
    const body = await readJson<{
      modelId?: string; title?: string; description?: string; price?: number;
      accessPolicy?: string; privacyMethod?: string;
    }>(req);

    if (!body.modelId) return fail("modelId is required");
    const model = await db.model.findUnique({ where: { id: body.modelId } });
    if (!model) return fail("Model not found", 404);

    const existing = await db.marketplaceListing.findUnique({ where: { modelId: model.id } });
    if (existing) return fail("This model already has a marketplace listing", 409);

    const participants = await db.participant.findMany({
      where: { modelId: model.id },
      include: { organization: { select: { name: true } } },
    });
    const rounds = await db.federatedRound.count({ where: { modelId: model.id, status: "COMPLETED" } });

    const listing = await db.marketplaceListing.create({
      data: {
        modelId: model.id,
        title: body.title ?? model.name,
        description: body.description ?? model.description ?? "",
        useCase: model.useCase,
        industry: model.industry,
        performance: model.currentAccuracy,
        privacyMethod: body.privacyMethod ?? "SECURE_AGGREGATION",
        trainingRounds: rounds,
        price: Math.max(0, body.price ?? 0),
        accessPolicy: ["OPEN", "REQUEST_ACCESS", "INVITE_ONLY"].includes(body.accessPolicy ?? "") ? body.accessPolicy! : "REQUEST_ACCESS",
        participantOrgs: JSON.stringify(participants.map((p) => p.organization.name)),
        status: "ACTIVE",
      },
    });

    await audit({
      actor: user.email, actorRole: user.role,
      eventType: "MODEL_CREATED", resource: `listing:${listing.title}`,
      metadata: { listingId: listing.id, modelId: model.id, price: listing.price },
    });
    await db.notification.create({
      data: {
        type: "SYSTEM",
        title: "New marketplace model available",
        message: `"${listing.title}" is now listed on the DataVault marketplace (${listing.price} DATA).`,
      },
    });

    return ok({ listing: { id: listing.id, title: listing.title } }, 201);
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR"]);
}
