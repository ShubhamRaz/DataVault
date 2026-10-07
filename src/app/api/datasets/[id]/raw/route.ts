import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { ok, withAuth } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/datasets/[id]/raw — the privacy guard (spec §2, §15, §34).
 * Raw participant data can NEVER be downloaded from the central platform.
 * Every attempt is logged as a privacy event + audit entry (RAW_ACCESS_BLOCKED).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async ({ user }) => {
    const dataset = await db.dataset.findUnique({ where: { id }, include: { owner: true } });
    if (!dataset) {
      return ok({ blocked: true, reason: "Dataset not found" }, 404);
    }

    await db.privacyEvent.create({
      data: {
        type: "RAW_ACCESS_BLOCKED",
        organizationId: dataset.ownerId,
        modelName: null,
        description: `${user.email} attempted to access raw records of "${dataset.name}" — blocked by the privacy guard. Raw data never leaves the data owner.`,
        metadata: JSON.stringify({ datasetId: id, actor: user.email, actorRole: user.role }),
      },
    });
    await audit({
      actor: user.email, actorRole: user.role, organization: dataset.owner.name,
      eventType: "RAW_ACCESS_BLOCKED", resource: dataset.name,
      status: "BLOCKED",
      metadata: { datasetId: id, policy: "raw-data-never-leaves-owner" },
    });

    return ok({
      blocked: true,
      reason: "RAW DATA ACCESS DENIED",
      policy: "DataVault privacy architecture: raw records never leave the data owner's environment.",
      dataset: { id: dataset.id, name: dataset.name, owner: dataset.owner.name, status: dataset.status },
      whatIsShared: {
        rawRecords: "NOT SHARED — 0 bytes ever transferred",
        modelUpdates: "SHARED — privacy-protected (masked + encrypted) only",
        metadata: "SHARED — sample counts, feature names, hashes (no record content)",
      },
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
