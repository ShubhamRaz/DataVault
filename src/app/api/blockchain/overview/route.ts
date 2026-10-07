import { db } from "@/lib/db";
import { ok, withAuth } from "@/server/api-helpers";
import { blockchain } from "@/server/blockchain/ledger";

export const dynamic = "force-dynamic";

/** GET /api/blockchain/overview — network stats + latest blocks (spec §22). */
export async function GET() {
  return withAuth(async () => {
    const stats = await blockchain.chainStats();
    const blocks = await db.blockchainBlock.findMany({
      orderBy: { number: "desc" },
      take: 10,
      include: { transactions: { select: { hash: true, action: true, amount: true } } },
    });
    const contributionRecords = await db.blockchainTransaction.findMany({
      where: { action: "RECORD_CONTRIBUTION" },
      orderBy: { timestamp: "desc" },
      take: 10,
    });
    return ok({
      stats,
      blocks: blocks.map((b) => ({
        number: b.number, hash: b.hash, prevHash: b.prevHash, nonce: b.nonce,
        txCount: b.txCount, timestamp: b.timestamp,
        transactions: b.transactions,
      })),
      contributionRecords: contributionRecords.map((t) => ({
        hash: t.hash, participantName: t.participantName, roundNumber: t.roundNumber,
        modelName: t.modelName, metadata: t.metadata ? JSON.parse(t.metadata) : null, timestamp: t.timestamp,
      })),
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
