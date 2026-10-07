import { db } from "@/lib/db";
import { ok, withAuth } from "@/server/api-helpers";
import { PrivacyEngine } from "@/server/privacy/privacy-engine";

export const dynamic = "force-dynamic";

/** GET /api/privacy/status — the privacy posture object (spec §34). */
export async function GET() {
  return withAuth(async () => {
    const setting = await db.systemSetting.findUnique({ where: { key: "privacy_mode" } });
    const mode = (setting?.value as "DEMO" | "ENCRYPTION") ?? "DEMO";
    const engine = new PrivacyEngine(process.env.JWT_SECRET || "datavault", mode);

    const [orgs, updates, encUpdates, privacyEvents] = await Promise.all([
      db.organization.count({ where: { slug: { not: "datavault-core" } } }),
      db.modelUpdate.count(),
      db.modelUpdate.count({ where: { encrypted: true } }),
      db.privacyEvent.count(),
    ]);

    const latestRound = await db.federatedRound.findFirst({ orderBy: { createdAt: "desc" } });

    return ok({
      status: engine.status(),
      counters: {
        rawDataSharedBytes: 0,
        dataOwners: orgs,
        modelUpdates: updates,
        encryptedUpdates: encUpdates,
        privacyEvents,
      },
      layers: {
        federatedLearning: {
          name: "Layer 1 — Federated Learning",
          description: "Round-based FedAvg: global model distributed, trained locally, only weight deltas travel.",
          engine: "Custom MLP + SGD (TS demo engine) / PyTorch (ml-service)",
        },
        privacyComputing: {
          name: "Layer 2 — Privacy Computing",
          description: "Pairwise zero-sum additive masking (masks cancel at the aggregator) + AES-256-GCM in ENCRYPTION mode. Production: TenSEAL CKKS on selected tensors.",
          mode,
        },
        blockchain: {
          name: "Layer 3 — Blockchain Incentives",
          description: "SHA-256 hash-chained local ledger (Local Test Network). Solidity DataVaultRewards contract for EVM deployment.",
          network: "DataVault Local Test Network (chain 31337)",
        },
      },
      latestRoundId: latestRound?.id ?? null,
      disclaimer: "DataVault is a research and hackathon demonstration. It is not legal or regulatory compliance advice. Production deployments must undergo organization-specific privacy, security, legal, and regulatory review.",
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
