import { db } from "@/lib/db";
import { ok, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/notifications — notification center (spec §47). */
export async function GET() {
  return withAuth(async () => {
    const notifications = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return ok({ notifications, unread: notifications.filter((n) => !n.read).length });
  });
}

/** POST /api/notifications — mark read. */
export async function POST(req: Request) {
  return withAuth(async () => {
    const body = await readJson<{ ids?: string[]; all?: boolean }>(req);
    if (body.all) {
      await db.notification.updateMany({ data: { read: true } });
      return ok({ updated: "all" });
    }
    if (body.ids?.length) {
      await db.notification.updateMany({ where: { id: { in: body.ids } }, data: { read: true } });
      return ok({ updated: body.ids.length });
    }
    return ok({ updated: 0 });
  });
}
