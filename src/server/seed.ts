/**
 * DataVault — Demo network initialization & seed (spec §30, §31).
 * Everything is generated: synthetic orgs, users, datasets (raw CSVs persisted
 * ONLY in participant folders), models, marketplace listings — and the demo
 * HISTORY is produced by REAL federated training runs (no fake statistics).
 */
import { rmSync, existsSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { ORGS, PARTICIPANT_SPECS, MODELS, DEMO_USERS, DATASETS } from "./demo-specs";
import { generateDataset, persistParticipantDataset, hashDataset } from "./synthetic-data";
import { createGlobalModel } from "./federation/model-init";
import { runFederatedRound } from "./federation/orchestrator";
import { deriveWalletAddress } from "./blockchain/ledger";
import { audit } from "./audit";
import { hashPassword } from "./password";

const g = globalThis as unknown as { __dvSeeding?: Promise<void> | null };

/** Wipe all demo data (DB + participant data folders). */
export async function resetDemo() {
  const tablenames = [
    "AccessRequest", "MarketplaceListing", "AuditLog", "BlockchainTransaction", "BlockchainBlock",
    "Reward", "Contribution", "PrivacyEvent", "ModelUpdate", "TrainingRun", "FederatedRound",
    "ModelVersion", "Participant", "Model", "Dataset", "Notification", "Wallet", "DemoRunLog",
    "User", "Organization", "SystemSetting",
  ];
  for (const t of tablenames) {
    // @ts-expect-error dynamic model access
    await db[t].deleteMany();
  }
  const dataDir = join(process.cwd(), "data", "participants");
  if (existsSync(dataDir)) {
    for (const org of ORGS) {
      rmSync(join(dataDir, org.slug), { recursive: true, force: true });
    }
  }
}

/**
 * "Initialize Demo Network" (spec §30): one click configures 3 hospitals,
 * 3 banks, 3 farm groups, synthetic datasets, 3 federated models, wallets,
 * the local blockchain, and the default privacy configuration.
 */
export async function initializeDemoNetwork(opts: { actor: string; seedRoundsOverride?: number }) {
  // cross-process seeding lock (fresh marker < 10 min old blocks other seeds)
  await db.systemSetting.upsert({
    where: { key: "demo_seeding" },
    update: { value: new Date().toISOString() },
    create: { key: "demo_seeding", value: new Date().toISOString(), description: "Seeding in progress (lock marker)" },
  });
  try {
    await resetDemo();
    const t0 = Date.now();

  // ── 1. Organizations + wallets ──
  for (const org of ORGS) {
    const wallet = await db.wallet.create({
      data: { address: deriveWalletAddress(org.slug), balance: 0, pending: 0, claimed: 0, totalEarned: 0 },
    });
    await db.organization.create({
      data: {
        name: org.name, slug: org.slug, type: org.type, industry: org.industry, location: org.location,
        status: "ACTIVE", verification: "VERIFIED", description: org.description, walletId: wallet.id,
      },
    });
    await audit({ actor: opts.actor, eventType: "ORGANIZATION_REGISTERED", organization: org.name, resource: org.slug, metadata: { wallet: wallet.address } });
  }

  // ── 2. Demo users ──
  for (const u of DEMO_USERS) {
    const org = await db.organization.findUnique({ where: { slug: u.org } });
    await db.user.create({
      data: {
        email: u.email, name: u.name, role: u.role,
        passwordHash: hashPassword(u.password),
        organizationId: org?.id ?? null,
        walletAddress: org?.walletId ?? null,
        avatarSeed: u.email,
      },
    });
    await audit({ actor: u.email, eventType: "USER_REGISTERED", organization: org?.name, resource: u.role });
  }

  // ── 3. Synthetic datasets — raw CSVs persisted ONLY inside participant folders ──
  for (const [slug, meta] of Object.entries(DATASETS)) {
    const spec = PARTICIPANT_SPECS[slug];
    const org = await db.organization.findUnique({ where: { slug } });
    if (!spec || !org) continue;
    const ds = generateDataset(spec);
    const storagePath = persistParticipantDataset(slug, org.name, ds);
    await db.dataset.create({
      data: {
        name: meta.name, ownerId: org.id, industry: org.industry, domain: spec.domain,
        sampleCount: ds.sampleCount, featureCount: ds.featureCount, targetName: ds.targetName,
        privacyClassification: meta.privacyClassification, status: "LOCAL_ONLY",
        storagePath, metadataHash: hashDataset(ds.X, ds.y, spec.seed), isDemo: true,
      },
    });
    await audit({ actor: opts.actor, organization: org.name, eventType: "DATASET_GENERATED", resource: meta.name, metadata: { samples: ds.sampleCount, localPath: `data/participants/${slug}/` } });
  }

  // ── 4. Federated models (v1.0 + silo baselines) ──
  for (const m of MODELS) {
    await createGlobalModel({
      name: m.name, slug: m.slug, useCase: m.useCase, industry: m.industry,
      taskType: m.taskType, description: m.description,
      participantSlugs: m.participants, actor: opts.actor, actorRole: "ADMIN",
    });
  }

  // ── 5. Historical federation rounds — REAL training runs (labeled Demo Data) ──
  for (const m of MODELS) {
    const model = await db.model.findUnique({ where: { slug: m.slug } });
    if (!model) continue;
    const rounds = opts.seedRoundsOverride ?? m.seedRounds;
    for (let r = 1; r <= rounds; r++) {
      await runFederatedRound({
        modelId: model.id, roundNumber: r,
        config: { epochs: 5, batchSize: 32, lr: 0.1, privacyMode: "DEMO", pacingMs: 0 },
        actor: opts.actor, actorRole: "ADMIN",
      });
    }
  }

  // ── 6. Marketplace listings ──
  for (const m of MODELS) {
    const model = await db.model.findUnique({ where: { slug: m.slug }, include: { participants: { include: { organization: true } } } });
    if (!model) continue;
    await db.marketplaceListing.create({
      data: {
        modelId: model.id,
        title: m.name,
        description: m.description,
        useCase: m.useCase,
        industry: m.industry,
        performance: model.currentAccuracy,
        privacyMethod: "SECURE_AGGREGATION",
        trainingRounds: await db.federatedRound.count({ where: { modelId: model.id } }),
        price: m.slug === "cancer-risk" ? 500 : m.slug === "fraud-detection" ? 750 : 300,
        accessPolicy: "REQUEST_ACCESS",
        participantOrgs: JSON.stringify(model.participants.map((p) => p.organization.name)),
        status: "ACTIVE",
      },
    });
  }

  // ── 7. System settings + demo run log ──
  await db.systemSetting.createMany({
    data: [
      { key: "demo_initialized", value: new Date().toISOString(), description: "Demo network initialized at" },
      { key: "privacy_mode", value: "DEMO", description: "DEMO | ENCRYPTION" },
      { key: "round_reward_pool", value: "1000", description: "DATA tokens distributed per round" },
      { key: "label", value: "Research / Hackathon Demonstration", description: "System label (spec §2)" },
      { key: "india_focus", value: "true", description: "Positioned for India's data ecosystem" },
    ],
  });
  await db.demoRunLog.create({ data: { action: "DEMO_INITIALIZED", detail: `Seeded in ${Date.now() - t0}ms` } });
  await db.notification.create({
    data: {
      type: "SYSTEM",
      title: "Demo network initialized",
      message: "9 organizations, 10 demo users, 3 federated models and 12 real training rounds are ready. All data is synthetic.",
    },
  });

  return { ms: Date.now() - t0 };
  } finally {
    // remove the seeding marker only when THIS process's flag row still exists
    await db.systemSetting.deleteMany({ where: { key: "demo_seeding" } }).catch(() => undefined);
  }
}

/** Lazy guard: seed once on first API hit if the DB is empty. */
export async function ensureSeeded(): Promise<void> {
  const flag = await db.systemSetting.findUnique({ where: { key: "demo_initialized" } });
  if (flag) return;
  // a fresh seeding marker means another process is mid-seed — wait briefly, then re-check
  const marker = await db.systemSetting.findUnique({ where: { key: "demo_seeding" } });
  if (marker && Date.now() - new Date(marker.value).getTime() < 10 * 60_000) {
    await new Promise((r) => setTimeout(r, 2500));
    const recheck = await db.systemSetting.findUnique({ where: { key: "demo_initialized" } });
    if (recheck) return;
    return; // still seeding — this request proceeds unseeded; next request will see data
  }
  if (g.__dvSeeding) return g.__dvSeeding;
  g.__dvSeeding = initializeDemoNetwork({ actor: "system", seedRoundsOverride: 4 })
    .catch((e) => { console.error("[seed] failed:", e); })
    .finally(() => { g.__dvSeeding = null; });
  return g.__dvSeeding;
}
