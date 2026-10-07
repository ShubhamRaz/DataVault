import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/** POST /api/marketplace/[id]/access-requests — request access to a listing (spec §18). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async ({ user }) => {
    const listing = await db.marketplaceListing.findUnique({ where: { id } });
    if (!listing) return fail("Listing not found", 404);

    const targetOrgId = user.organizationId;
    if (!targetOrgId) return fail("Join an organization before requesting access", 400);
    if (listing.accessPolicy === "OPEN") return ok({ autoGranted: true, status: "APPROVED", message: "Listing is open access" });

    const body = await readJson<{ message?: string }>(req).catch(() => ({ message: undefined }));
    const existing = await db.accessRequest.findFirst({ where: { listingId: id, organizationId: targetOrgId, status: "PENDING" } });
    if (existing) return fail("An access request is already pending for this listing", 409);

    const request = await db.accessRequest.create({
      data: {
        listingId: id, organizationId: targetOrgId,
        requesterName: user.name, message: body.message ?? null, status: "PENDING",
      },
    });

    await audit({
      actor: user.email, actorRole: user.role, organization: user.organizationName ?? undefined,
      eventType: "ACCESS_REQUESTED", resource: listing.title,
      metadata: { requestId: request.id, listingId: id },
    });
    await db.notification.create({
      data: {
        type: "ACCESS_REQUESTED",
        title: "Marketplace access requested",
        message: `${user.organizationName ?? user.name} requested access to "${listing.title}".`,
      },
    });

    return ok({ request: { id: request.id, status: request.status } }, 201);
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
