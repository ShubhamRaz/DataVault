import { ok, withAuth } from "@/server/api-helpers";
import { blockchain } from "@/server/blockchain/ledger";
import { verifyAuditChain } from "@/server/audit";

export const dynamic = "force-dynamic";

/** GET /api/blockchain/verify — recompute the full ledger + audit chains. */
export async function GET() {
  return withAuth(async () => {
    const [chain, auditChain] = await Promise.all([blockchain.verifyChain(), verifyAuditChain()]);
    return ok({
      ledger: chain,
      auditChain,
      allValid: chain.valid && auditChain.valid,
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}
