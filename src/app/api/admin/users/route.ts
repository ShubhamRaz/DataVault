import { db } from "@/lib/db";
import { ok, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/admin/users — user management (spec §29). */
export async function GET() {
  return withAuth(async () => {
    const users = await db.user.findMany({
      include: { organization: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true, organization: true },
    });
    return ok({
      users: users.map((u) => ({
        ...u,
        // NOTE: password hashes are never exposed
      })),
    });
  }, ["ADMIN"]);
}
