import { db } from "@/lib/db";
import { generateDataset, persistParticipantDataset } from "@/server/synthetic-data";
import { PARTICIPANT_SPECS, DATASETS } from "@/server/demo-specs";
import { audit } from "@/server/audit";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/datasets — dataset registry: METADATA ONLY (spec §15, §19, §20). */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const domain = url.searchParams.get("domain") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const ownerId = url.searchParams.get("ownerId") ?? undefined;
    const q = url.searchParams.get("q")?.toLowerCase() ?? undefined;

    const datasets = await db.dataset.findMany({
      where: {
        ...(domain && domain !== "all" ? { domain } : {}),
        ...(status && status !== "all" ? { status } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(q ? { name: { contains: q } } : {}),
      },
      include: { owner: { select: { id: true, name: true, slug: true, industry: true } } },
      orderBy: { createdAt: "asc" },
    });

    return ok({
      datasets: datasets.map((d) => ({
        id: d.id, name: d.name, owner: d.owner, industry: d.industry, domain: d.domain,
        sampleCount: d.sampleCount, featureCount: d.featureCount, targetName: d.targetName,
        privacyClassification: d.privacyClassification, status: d.status,
        lastRoundNumber: d.lastRoundNumber, metadataHash: d.metadataHash,
        isDemo: d.isDemo, createdAt: d.createdAt,
        // NOTE: storagePath is the PARTICIPANT-LOCAL path — raw data is not centrally accessible
      })),
      notice: "Raw data never leaves the data owner. The registry stores metadata only.",
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}

/** POST /api/datasets — generate a NEW synthetic dataset inside a participant environment (spec §29). */
export async function POST(req: Request) {
  return withAuth(async ({ user }) => {
    const body = await readJson<{ organizationId?: string; samples?: number; name?: string }>(req);
    if (!body.organizationId) return fail("organizationId is required");

    const org = await db.organization.findUnique({ where: { id: body.organizationId } });
    if (!org) return fail("Organization not found", 404);

    const existing = await db.dataset.findFirst({ where: { ownerId: org.id } });
    if (existing) return fail("Organization already has a local dataset environment", 409);

    const baseSpec = PARTICIPANT_SPECS[org.slug] ?? PARTICIPANT_SPECS["hospital-a"];
    const samples = Math.min(3000, Math.max(200, body.samples ?? baseSpec.samples));
    const spec = {
      ...baseSpec,
      samples,
      seed: baseSpec.seed + Math.floor(Math.random() * 1000),
    };
    const ds = generateDataset(spec);
    const path = persistParticipantDataset(org.slug, org.name, ds);

    const meta = DATASETS[org.slug] ?? { name: `${org.name} Synthetic Records`, privacyClassification: "CONFIDENTIAL" };
    const record = await db.dataset.create({
      data: {
        name: body.name ?? meta.name,
        ownerId: org.id,
        industry: org.industry,
        domain: spec.domain,
        sampleCount: ds.sampleCount,
        featureCount: ds.featureCount,
        targetName: ds.targetName,
        privacyClassification: meta.privacyClassification,
        status: "LOCAL_ONLY",
        storagePath: path,
        metadataHash: ds.metadataHash,
        isDemo: true,
      },
    });

    await audit({
      actor: user.email, actorRole: user.role, organization: org.name,
      eventType: "DATASET_GENERATED", resource: record.name,
      metadata: { samples: ds.sampleCount, localPath: `data/participants/${org.slug}/` },
    });

    return ok({
      dataset: {
        id: record.id, name: record.name, sampleCount: ds.sampleCount,
        featureCount: ds.featureCount, storagePath: `data/participants/${org.slug}/data.csv`,
      },
    }, 201);
  }, ["ADMIN", "ML_OPERATOR"]);
}
