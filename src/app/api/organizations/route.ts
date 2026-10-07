import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { hashPassword } from "@/server/password";
import { deriveWalletAddress } from "@/server/blockchain/ledger";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/organizations — list with filters (industry, status, verification, search). */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const industry = url.searchParams.get("industry") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const verification = url.searchParams.get("verification") ?? undefined;
    const q = url.searchParams.get("q")?.toLowerCase() ?? undefined;

    const orgs = await db.organization.findMany({
      where: {
        ...(industry && industry !== "all" ? { industry } : {}),
        ...(status && status !== "all" ? { status } : {}),
        ...(verification && verification !== "all" ? { verification } : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { location: { contains: q } }] } : {}),
      },
      include: { wallet: true },
      orderBy: { createdAt: "asc" },
    });

    const enriched = [];
    for (const o of orgs) {
      const [modelsParticipating, rounds, contribution, rewardSum, datasets] = await Promise.all([
        db.participant.count({ where: { organizationId: o.id, status: "ACTIVE" } }),
        db.contribution.count({ where: { organizationId: o.id } }),
        db.contribution.aggregate({ where: { organizationId: o.id }, _sum: { normalizedScore: true } }),
        db.reward.aggregate({ where: { organizationId: o.id }, _sum: { amount: true } }),
        db.dataset.count({ where: { ownerId: o.id } }),
      ]);
      enriched.push({
        id: o.id, name: o.name, slug: o.slug, type: o.type, industry: o.industry, location: o.location,
        status: o.status, verification: o.verification, description: o.description,
        walletAddress: o.wallet?.address ?? null,
        activeModels: modelsParticipating,
        trainingRounds: rounds,
        contributionScore: Math.round((contribution._sum.normalizedScore ?? 0) * 1000) / 1000,
        rewardBalance: Math.round((rewardSum._sum.amount ?? 0) * 100) / 100,
        datasets,
        createdAt: o.createdAt,
      });
    }
    return ok({ organizations: enriched });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}

/** POST /api/organizations — admin registers a new organization (spec §29). */
export async function POST(req: Request) {
  return withAuth(async ({ user }) => {
    const body = await readJson<{
      name?: string; type?: string; industry?: string; location?: string; description?: string;
      adminEmail?: string; adminName?: string; adminPassword?: string;
    }>(req);

    const name = body.name?.trim();
    if (!name || name.length < 3) return fail("Organization name is required (min 3 chars)");
    if (!body.industry) return fail("Industry is required");

    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

    const wallet = await db.wallet.create({
      data: { address: deriveWalletAddress(slug), balance: 0, pending: 0, claimed: 0, totalEarned: 0 },
    });
    const org = await db.organization.create({
      data: {
        name, slug, type: body.type ?? "Enterprise", industry: body.industry,
        location: body.location ?? "—", description: body.description ?? null,
        status: "PENDING", verification: "UNVERIFIED", walletId: wallet.id,
      },
    });

    // optionally create the org's first admin user
    if (body.adminEmail && body.adminName && body.adminPassword) {
      if (body.adminPassword.length < 8) return fail("Admin password must be at least 8 characters", 400);
      const existing = await db.user.findUnique({ where: { email: body.adminEmail.toLowerCase() } });
      if (!existing) {
        await db.user.create({
          data: {
            email: body.adminEmail.toLowerCase(), name: body.adminName, role: "ORG_ADMIN",
            passwordHash: hashPassword(body.adminPassword), organizationId: org.id,
          },
        });
      }
    }

    await audit({
      actor: user.email, actorRole: user.role, organization: name,
      eventType: "ORGANIZATION_REGISTERED", resource: slug,
      metadata: { orgId: org.id, wallet: wallet.address },
    });

    return ok({ organization: { id: org.id, name, slug, status: org.status } }, 201);
  }, ["ADMIN"]);
}

