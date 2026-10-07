import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/admin/settings — system settings. */
export async function GET() {
  return withAuth(async () => {
    const settings = await db.systemSetting.findMany({ orderBy: { key: "asc" } });
    return ok({ settings });
  }, ["ADMIN"]);
}

/** PATCH /api/admin/settings — update system settings (privacy mode, reward pool). */
export async function PATCH(req: Request) {
  return withAuth(async ({ user }) => {
    const body = await readJson<{ key?: string; value?: string }>(req);
    if (!body.key) return fail("key is required");

    const allowed = ["privacy_mode", "round_reward_pool", "label"];
    if (!allowed.includes(body.key)) return fail(`Settings key must be one of: ${allowed.join(", ")}`);
    if (body.key === "privacy_mode" && !["DEMO", "ENCRYPTION"].includes(body.value ?? "")) {
      return fail("privacy_mode must be DEMO or ENCRYPTION");
    }

    await db.systemSetting.upsert({
      where: { key: body.key },
      update: { value: body.value ?? "" },
      create: { key: body.key, value: body.value ?? "" },
    });
    await audit({ actor: user.email, actorRole: user.role, eventType: "SETTINGS_UPDATED", resource: body.key, metadata: { value: body.value } });
    return ok({ key: body.key, value: body.value });
  }, ["ADMIN"]);
}
