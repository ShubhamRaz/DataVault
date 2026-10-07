import { db } from "@/lib/db";
import { ok, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/audit — searchable/filterable hash-chained audit log (spec §21, §46). */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const eventType = url.searchParams.get("eventType") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const q = url.searchParams.get("q")?.toLowerCase() ?? undefined;
    const take = Math.min(300, Number(url.searchParams.get("take") ?? 150));

    const entries = await db.auditLog.findMany({
      where: {
        ...(eventType && eventType !== "all" ? { eventType } : {}),
        ...(status && status !== "all" ? { status } : {}),
        ...(q ? { OR: [{ actor: { contains: q } }, { resource: { contains: q } }, { organization: { contains: q } }, { eventType: { contains: q.toUpperCase() } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    const byType: Record<string, number> = {};
    for (const e of entries) byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;

    return ok({
      entries: entries.map((e) => ({
        id: e.id, timestamp: e.createdAt, actor: e.actor, actorRole: e.actorRole,
        organization: e.organization, eventType: e.eventType, resource: e.resource,
        status: e.status, metadata: e.metadata ? JSON.parse(e.metadata) : null,
        hash: e.entryHash, blockchainTxHash: e.blockchainTxHash,
      })),
      byType,
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
