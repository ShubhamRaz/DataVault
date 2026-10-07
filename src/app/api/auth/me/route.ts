import { getSessionUser, ROLE_LABELS } from "@/server/auth";
import { ok, withPublic } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  return withPublic(async () => {
    const user = await getSessionUser();
    if (!user) return ok(null);
    return ok({ ...user, roleLabel: ROLE_LABELS[user.role] ?? user.role });
  });
}
