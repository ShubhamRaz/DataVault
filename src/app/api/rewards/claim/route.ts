import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { blockchain } from "@/server/blockchain/ledger";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/rewards/claim — claim AVAILABLE rewards to wallet balance (spec §6).
 * Executes wallet transfer + CLAIM_REWARD ledger transaction.
 */
export async function POST(req: Request) {
  return withAuth(async ({ user }) => {
    const body = await readJson<{ organizationId?: string; rewardIds?: string[] }>(req);

    // org admins / admins may claim for their organization (participants for own org)
    const targetOrgId = body.organizationId ?? user.organizationId;
    if (!targetOrgId) return fail("organizationId is required (or join an organization first)");

    const org = await db.organization.findUnique({ where: { id: targetOrgId }, include: { wallet: true } });
    if (!org || !org.wallet) return fail("Organization wallet not found", 404);

    const canClaim = user.role === "ADMIN" || user.organizationId === targetOrgId;
    if (!canClaim) return fail("You can only claim rewards for your own organization", 403);

    const rewards = await db.reward.findMany({
      where: {
        organizationId: targetOrgId,
        status: "AVAILABLE",
        ...(body.rewardIds?.length ? { id: { in: body.rewardIds } } : {}),
      },
    });
    if (rewards.length === 0) return fail("No available rewards to claim");

    const total = rewards.reduce((s, r) => s + r.amount, 0);
    const txs = rewards.map((r) => ({
      fromAddress: "0x00000000000000000000000000000000000da0a",
      toAddress: org.wallet!.address,
      action: "CLAIM_REWARD" as const,
      amount: r.amount,
      roundNumber: r.roundNumber,
      participantName: org.name,
      metadata: { rewardId: r.id, score: r.score },
    }));
    const { blockNumber, txHashes } = await blockchain.appendBlock(txs);

    const claimedAt = new Date();
    for (let i = 0; i < rewards.length; i++) {
      await db.reward.update({ where: { id: rewards[i].id }, data: { status: "CLAIMED", claimedAt, txHash: txHashes[i] } });
    }
    await db.wallet.update({
      where: { id: org.wallet.id },
      data: {
        pending: Math.max(0, Math.round((org.wallet.pending - total) * 100) / 100),
        claimed: Math.round((org.wallet.claimed + total) * 100) / 100,
        balance: Math.round((org.wallet.balance + total) * 100) / 100,
      },
    });
    await audit({
      actor: user.email, actorRole: user.role, organization: org.name,
      eventType: "REWARD_CLAIMED", resource: `${rewards.length} rewards`,
      blockchainTxHash: txHashes[0],
      metadata: { total, blockNumber, rewards: rewards.length },
    });
    await db.notification.create({
      data: {
        type: "REWARD_ALLOCATED",
        title: "Rewards claimed",
        message: `${org.name} claimed ${total.toFixed(0)} DATA to wallet ${org.wallet.address.slice(0, 10)}… — on-chain in block #${blockNumber}.`,
      },
    });

    return ok({ claimed: rewards.length, total, blockNumber, txHashes });
  }, ["ADMIN", "ORG_ADMIN", "PARTICIPANT"]);
}
