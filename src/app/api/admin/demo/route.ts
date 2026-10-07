import { db } from "@/lib/db";
import { initializeDemoNetwork, resetDemo } from "@/server/seed";
import { audit } from "@/server/audit";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/demo — Demo Controls (spec §56). REAL backend actions:
 *   { action: "initialize" }  → full demo network init (orgs, datasets, models, real rounds)
 *   { action: "reset" }       → wipe everything
 *   { action: "regenerate" }  → regenerate synthetic datasets for participants
 */
export async function POST(req: Request) {
  return withAuth(async ({ user }) => {
    const body = await readJson<{ action?: string }>(req);
    const action = body.action ?? "";

    if (action === "initialize") {
      const result = await initializeDemoNetwork({ actor: user.email });
      await audit({ actor: user.email, actorRole: user.role, eventType: "DEMO_INITIALIZED", metadata: { ms: result.ms } });
      return ok({
        action,
        message: "Demo network initialized: 9 organizations, 10 users, 9 synthetic datasets, 3 federated models, historical rounds (real training runs), wallets, local blockchain.",
        ...result,
      });
    }

    if (action === "reset") {
      await resetDemo();
      await audit({ actor: user.email, actorRole: user.role, eventType: "DEMO_RESET", status: "SUCCESS" });
      return ok({ action, message: "Demo data wiped. Use 'Initialize Demo Network' to rebuild." });
    }

    if (action === "regenerate") {
      // regenerate synthetic datasets for orgs that lost theirs
      const orgs = await db.organization.findMany({ where: { slug: { not: "datavault-core" } } });
      const { PARTICIPANT_SPECS, DATASETS } = await import("@/server/demo-specs");
      const { generateDataset, persistParticipantDataset } = await import("@/server/synthetic-data");
      let regenerated = 0;
      for (const org of orgs) {
        const existing = await db.dataset.findFirst({ where: { ownerId: org.id } });
        if (existing) continue;
        const spec = PARTICIPANT_SPECS[org.slug];
        if (!spec) continue;
        const ds = generateDataset({ ...spec, seed: spec.seed + Math.floor(Math.random() * 999) });
        const path = persistParticipantDataset(org.slug, org.name, ds);
        const meta = DATASETS[org.slug] ?? { name: `${org.name} Synthetic Records`, privacyClassification: "CONFIDENTIAL" };
        await db.dataset.create({
          data: {
            name: meta.name, ownerId: org.id, industry: org.industry, domain: spec.domain,
            sampleCount: ds.sampleCount, featureCount: ds.featureCount, targetName: ds.targetName,
            privacyClassification: meta.privacyClassification, status: "LOCAL_ONLY",
            storagePath: path, metadataHash: ds.metadataHash, isDemo: true,
          },
        });
        await audit({ actor: user.email, eventType: "DATASET_GENERATED", organization: org.name, resource: meta.name, metadata: { samples: ds.sampleCount } });
        regenerated++;
      }
      return ok({ action, message: `Regenerated ${regenerated} synthetic dataset environments.`, regenerated });
    }

    return fail("Unknown action. Use: initialize | reset | regenerate");
  }, ["ADMIN"]);
}

/** GET /api/admin/demo — current demo state. */
export async function GET() {
  return withAuth(async () => {
    const [flag, runLogs] = await Promise.all([
      db.systemSetting.findUnique({ where: { key: "demo_initialized" } }),
      db.demoRunLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    const counts = {
      organizations: await db.organization.count(),
      users: await db.user.count(),
      datasets: await db.dataset.count(),
      models: await db.model.count(),
      rounds: await db.federatedRound.count(),
      rewards: await db.reward.count(),
      blocks: await db.blockchainBlock.count(),
    };
    return ok({ initialized: !!flag, initializedAt: flag?.value ?? null, counts, runLogs });
  }, ["ADMIN"]);
}
