import { db } from "@/lib/db";
import { ok, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/privacy/events — privacy event log. */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? undefined;
    const take = Math.min(200, Number(url.searchParams.get("take") ?? 100));

    const events = await db.privacyEvent.findMany({
      where: type && type !== "all" ? { type } : {},
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });

    const byType: Record<string, number> = {};
    for (const e of events) byType[e.type] = (byType[e.type] ?? 0) + 1;

    return ok({
      events: events.map((e) => ({
        id: e.id, type: e.type, organization: e.organization?.name ?? null,
        modelName: e.modelName, description: e.description,
        metadata: e.metadata ? JSON.parse(e.metadata) : null, createdAt: e.createdAt,
      })),
      byType,
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
