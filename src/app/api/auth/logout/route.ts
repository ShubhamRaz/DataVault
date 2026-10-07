import { clearSessionCookie, getSessionUser } from "@/server/auth";
import { ok, withPublic } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

export async function POST() {
  return withPublic(async () => {
    const user = await getSessionUser();
    await clearSessionCookie();
    return ok({ loggedOut: true, email: user?.email ?? null });
  });
}
