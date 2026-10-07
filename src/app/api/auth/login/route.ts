import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie, rateLimit } from "@/server/auth";
import { audit } from "@/server/audit";
import { ok, fail, withPublic, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withPublic(async () => {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`login:${ip}`, 12, 60_000)) return fail("Too many attempts, try again shortly", 429);

    const { email, password } = await readJson<{ email?: string; password?: string }>(req);
    if (!email || !password) return fail("Email and password are required");

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { organization: true },
    });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      await audit({ actor: email, eventType: "USER_LOGIN", status: "FAILED", metadata: { reason: "invalid credentials" } });
      return fail("Invalid email or password", 401);
    }

    await setSessionCookie({
      id: user.id, email: user.email, name: user.name, role: user.role,
      organizationId: user.organizationId, organizationName: user.organization?.name ?? null,
    });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ actor: user.email, actorRole: user.role, organization: user.organization?.name, eventType: "USER_LOGIN" });

    return ok({
      id: user.id, email: user.email, name: user.name, role: user.role,
      organizationId: user.organizationId, organizationName: user.organization?.name ?? null,
    });
  });
}
