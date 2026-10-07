import { db } from "@/lib/db";
import { ok, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/rewards — reward history + wallet summary (spec §6).
 * Values are computed by the reward engine from real contribution scores.
 */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const q = url.searchParams.get("q")?.toLowerCase() ?? undefined;
    const take = Math.min(200, Number(url.searchParams.get("take") ?? 100));

    const rewards = await db.reward.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(status && status !== "all" ? { status } : {}),
        ...(q ? { organization: { name: { contains: q } } } : {}),
      },
      include: {
        organization: { select: { name: true, slug: true, wallet: true } },
        round: { include: { model: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    // wallet summaries per organization
    const wallets = await db.wallet.findMany({
      include: { org: { select: { name: true, slug: true, industry: true } } },
      orderBy: { totalEarned: "desc" },
    });

    const totals = {
      totalEarned: wallets.reduce((s, w) => s + w.totalEarned, 0),
      available: wallets.reduce((s, w) => s + w.pending, 0),
      claimed: wallets.reduce((s, w) => s + w.claimed, 0),
      poolPerRound: 1000,
    };

    return ok({
      rewards: rewards.map((r) => ({
        id: r.id, round: `#${r.roundNumber}`, model: r.round.model.name,
        organization: r.organization.name, organizationSlug: r.organization.slug,
        contribution: r.score, reward: r.amount, txHash: r.txHash, status: r.status,
        roundAccuracy: r.round.metricsAfter, claimedAt: r.claimedAt, createdAt: r.createdAt,
        walletAddress: r.organization.wallet?.address ?? null,
      })),
      wallets: wallets
        .filter((w) => w.org)
        .map((w) => ({
          address: w.address, organization: w.org!.name, slug: w.org!.slug, industry: w.org!.industry,
          balance: w.balance, pending: w.pending, claimed: w.claimed, totalEarned: w.totalEarned,
        })),
      totals,
      rewardFormula: {
        pool: "ROUND_REWARD_POOL = 1000 DATA per round",
        formula: "participant_reward = pool × normalized_contribution_score",
        contribution: "raw = 0.35·sample_share + 0.25·quality + 0.25·improvement + 0.15·participation; normalized = raw / Σ raw",
      },
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
