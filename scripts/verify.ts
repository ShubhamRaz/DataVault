import { db } from "../src/lib/db";
import { verifyAuditChain } from "../src/server/audit";
import { blockchain } from "../src/server/blockchain/ledger";

async function main() {
  const models = await db.model.findMany({ include: { versions: true } });
  for (const m of models) {
    const rounds = await db.federatedRound.findMany({ where: { modelId: m.id }, orderBy: { roundNumber: "asc" } });
    console.log(`\n■ ${m.name} [${m.taskType}] baseline(silo)=${m.baselineAccuracy} current=${m.currentAccuracy} v=${m.currentVersion}`);
    for (const r of rounds) {
      console.log(`  round ${r.roundNumber}: ${r.status} before=${r.metricsBefore.toFixed(4)} after=${r.metricsAfter.toFixed(4)} improve=${r.improvement.toFixed(4)} enc=${r.encryptedUpdates} ${r.durationMs}ms`);
    }
  }
  const rewards = await db.reward.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { organization: true, round: true } });
  console.log("\n■ rewards (latest):");
  for (const r of rewards) console.log(`  ${r.organization.name} r${r.roundNumber} = ${r.amount} DATA (score ${r.score}) tx=${r.txHash?.slice(0, 16)}… ${r.status}`);
  const chain = await blockchain.chainStats();
  console.log("\n■ ledger:", JSON.stringify(chain));
  const verify = await blockchain.verifyChain();
  console.log("■ ledger verify:", JSON.stringify(verify));
  const auditVerify = await verifyAuditChain();
  console.log("■ audit chain:", JSON.stringify(auditVerify));
  const counts = {
    orgs: await db.organization.count(),
    users: await db.user.count(),
    datasets: await db.dataset.count(),
    updates: await db.modelUpdate.count(),
    contributions: await db.contribution.count(),
    privacyEvents: await db.privacyEvent.count(),
    audit: await db.auditLog.count(),
    notifications: await db.notification.count(),
    listings: await db.marketplaceListing.count(),
    wallets: await db.wallet.count(),
  };
  console.log("■ counts:", JSON.stringify(counts));
  const w = await db.wallet.findMany({ include: { org: true } });
  console.log("■ wallets:", w.map((x) => `${x.org?.slug}:${x.totalEarned}e/${x.pending}p`).join(" "));
}
main();
