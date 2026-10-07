import { db } from "@/lib/db";
import { hashPassword, setSessionCookie, rateLimit } from "@/server/auth";
import { audit } from "@/server/audit";
import { ok, fail, withPublic, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"];

export async function POST(req: Request) {
  return withPublic(async () => {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`register:${ip}`, 8, 60_000)) return fail("Too many attempts, try again shortly", 429);

    const body = await readJson<{
      email?: string; name?: string; password?: string; role?: string; organizationSlug?: string;
    }>(req);

    const email = body.email?.toLowerCase().trim();
    const name = body.name?.trim();
    const password = body.password ?? "";
    const role = ROLES.includes(body.role ?? "") ? body.role! : "VIEWER";

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("A valid email is required");
    if (!name || name.length < 2) return fail("Name is required (min 2 chars)");
    if (password.length < 8) return fail("Password must be at least 8 characters");

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return fail("An account with this email already exists", 409);

    // Join an existing demo organization (registration requires an org invitation slug)
    let organizationId: string | null = null;
    if (body.organizationSlug) {
      const org = await db.organization.findUnique({ where: { slug: body.organizationSlug } });
      if (!org) return fail("Organization not found", 404);
      organizationId = org.id;
    }

    const user = await db.user.create({
      data: {
        email, name, role, passwordHash: hashPassword(password), organizationId,
        avatarSeed: email,
      },
      include: { organization: true },
    });

    await setSessionCookie({
      id: user.id, email: user.email, name: user.name, role: user.role,
      organizationId: user.organizationId, organizationName: user.organization?.name ?? null,
    });
    await audit({ actor: email, actorRole: role, organization: user.organization?.name, eventType: "USER_REGISTERED" });

    return ok({
      id: user.id, email: user.email, name: user.name, role: user.role,
      organizationId: user.organizationId, organizationName: user.organization?.name ?? null,
    }, 201);
  });
}
