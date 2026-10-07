import { db } from "@/lib/db";
import { ok, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/blockchain/transactions — filterable transaction table (spec §22, §46). */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? undefined;
    const q = url.searchParams.get("q")?.toLowerCase() ?? undefined;
    const take = Math.min(200, Number(url.searchParams.get("take") ?? 100));

    const txs = await db.blockchainTransaction.findMany({
      where: {
        ...(action && action !== "all" ? { action } : {}),
        ...(q ? { OR: [{ hash: { contains: q } }, { participantName: { contains: q } }, { modelName: { contains: q } }, { toAddress: { contains: q } }] } : {}),
      },
      orderBy: { timestamp: "desc" },
      take,
    });

    return ok({
      transactions: txs.map((t) => ({
        hash: t.hash, from: t.fromAddress, to: t.toAddress, action: t.action,
        amount: t.amount, round: t.roundNumber, modelName: t.modelName,
        participantName: t.participantName, status: t.status, timestamp: t.timestamp,
        metadata: t.metadata ? JSON.parse(t.metadata) : null,
      })),
      network: "DataVault Local Test Network",
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
