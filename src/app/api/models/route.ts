import { db } from "@/lib/db";
import { createGlobalModel } from "@/server/federation/model-init";
import { audit } from "@/server/audit";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/models — model registry with filters (spec §12, §46). */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const industry = url.searchParams.get("industry") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const taskType = url.searchParams.get("taskType") ?? undefined;
    const q = url.searchParams.get("q")?.toLowerCase() ?? undefined;

    const models = await db.model.findMany({
      where: {
        ...(industry && industry !== "all" ? { industry } : {}),
        ...(status && status !== "all" ? { status } : {}),
        ...(taskType && taskType !== "all" ? { taskType } : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { useCase: { contains: q } }] } : {}),
      },
      include: { participants: { include: { organization: { select: { name: true, slug: true } } } }, listing: true },
      orderBy: { createdAt: "asc" },
    });

    const enriched = [];
    for (const m of models) {
      const [rounds, versionCount] = await Promise.all([
        db.federatedRound.count({ where: { modelId: m.id, status: "COMPLETED" } }),
        db.modelVersion.count({ where: { modelId: m.id } }),
      ]);
      enriched.push({
        id: m.id, name: m.name, slug: m.slug, useCase: m.useCase, industry: m.industry,
        taskType: m.taskType, framework: m.framework, status: m.status, privacyMode: m.privacyMode,
        description: m.description, version: m.currentVersion,
        accuracyBefore: m.baselineAccuracy, accuracyAfter: m.currentAccuracy,
        metrics: m.latestMetrics ? JSON.parse(m.latestMetrics) : {},
        participants: m.participants.map((p) => p.organization.name),
        participantCount: m.participants.length,
        trainingRounds: rounds, versionCount, modelHash: m.modelHash,
        listing: m.listing ? { id: m.listing.id, price: m.listing.price, status: m.listing.status } : null,
        createdAt: m.createdAt,
      });
    }
    return ok({ models: enriched });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}

/** POST /api/models — create a new global model (spec §29, §51). */
export async function POST(req: Request) {
  return withAuth(async ({ user }) => {
    const body = await readJson<{
      name?: string; useCase?: string; industry?: string; taskType?: string;
      description?: string; participantOrgIds?: string[];
    }>(req);

    const name = body.name?.trim();
    if (!name || name.length < 3) return fail("Model name is required (min 3 chars)");
    if (!body.useCase) return fail("Use case is required");
    if (!body.industry) return fail("Industry is required");
    if (!body.participantOrgIds || body.participantOrgIds.length < 2) {
      return fail("At least 2 participant organizations are required for federation");
    }

    const orgs = await db.organization.findMany({ where: { id: { in: body.participantOrgIds } } });
    if (orgs.length < 2) return fail("Participant organizations not found", 404);

    // require datasets: each participant needs a local dataset environment
    for (const org of orgs) {
      const dataset = await db.dataset.findFirst({ where: { ownerId: org.id } });
      if (!dataset) {
        return fail(`${org.name} has no local dataset — generate synthetic data for it first`, 400);
      }
    }

    const taskType = body.taskType === "REGRESSION" ? "REGRESSION" : "CLASSIFICATION";
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 5)}`;

    const result = await createGlobalModel({
      name, slug, useCase: body.useCase, industry: body.industry, taskType,
      description: body.description ?? "",
      participantSlugs: orgs.map((o) => o.slug),
      actor: user.email, actorRole: user.role,
    });

    return ok({
      model: {
        id: result.model.id, name, slug, version: "v1.0",
        baseline: result.baseline, siloDetail: result.siloDetail, modelHash: result.modelHash,
        blockNumber: result.blockNumber,
      },
    }, 201);
  }, ["ADMIN", "ML_OPERATOR"]);
}

void audit;
