import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { ok, withAuth } from "@/server/api-helpers";
import { verifyAuditChain } from "@/server/audit";
import { blockchain } from "@/server/blockchain/ledger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export — exportable demo report (spec §57).
 * Self-contained HTML report with real computed data.
 */
export async function GET() {
  return withAuth(async ({ user }) => {
    const [models, orgs, wallets, chainVerify, auditVerify] = await Promise.all([
      db.model.findMany({ include: { participants: { include: { organization: true } } } }),
      db.organization.findMany({ where: { slug: { not: "datavault-core" } } }),
      db.wallet.findMany(),
      blockchain.verifyChain(),
      verifyAuditChain(),
    ]);

    const reportRows: string[] = [];
    let totalRounds = 0, totalRewards = 0;

    for (const m of models) {
      const rounds = await db.federatedRound.findMany({
        where: { modelId: m.id, status: "COMPLETED" },
        orderBy: { roundNumber: "asc" },
        select: { roundNumber: true, metricsBefore: true, metricsAfter: true, improvement: true, encryptedUpdates: true },
      });
      totalRounds += rounds.length;
      const rewards = await db.reward.aggregate({ where: { round: { modelId: m.id } }, _sum: { amount: true } });
      totalRewards += rewards._sum.amount ?? 0;
      const last = rounds[rounds.length - 1];
      reportRows.push(`
        <tr>
          <td><b>${esc(m.name)}</b><br><small>${esc(m.industry)} · ${m.taskType} · ${esc(m.currentVersion)}</small></td>
          <td>${m.participants.map((p) => esc(p.organization.name)).join("<br>")}</td>
          <td>${rounds.length}</td>
          <td>${(m.baselineAccuracy * 100).toFixed(1)}%</td>
          <td>${(m.currentAccuracy * 100).toFixed(1)}%</td>
          <td>${last ? `+${(m.currentAccuracy * 100 - m.baselineAccuracy * 100).toFixed(1)} pts` : "—"}</td>
          <td>${rounds.reduce((s, r) => s + r.encryptedUpdates, 0)}</td>
          <td>${(rewards._sum.amount ?? 0).toFixed(0)} DATA</td>
        </tr>`);
    }

    const privacyEvents = await db.privacyEvent.count();
    const auditEntries = await db.auditLog.count();
    const updates = await db.modelUpdate.count();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>DataVault Demo Report</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #060a13; color: #e8eef9; margin: 0; padding: 40px; }
  .wrap { max-width: 1000px; margin: 0 auto; }
  h1 { color: #22d3ee; font-size: 26px; margin-bottom: 2px; }
  .tag { color: #8296b3; font-size: 13px; margin-bottom: 28px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 24px 0; }
  .kpi { background: #0b1322; border: 1px solid #1b2942; border-radius: 10px; padding: 14px; }
  .kpi b { display: block; font-size: 22px; color: #2dd4bf; }
  .kpi span { color: #8296b3; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0 32px; background: #0b1322; border-radius: 10px; overflow: hidden; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #22d3ee; background: #0e1729; padding: 10px 12px; }
  td { padding: 10px 12px; border-top: 1px solid #1b2942; font-size: 13px; vertical-align: top; }
  small { color: #8296b3; }
  .section { margin-top: 32px; }
  .section h2 { color: #22d3ee; font-size: 17px; border-bottom: 1px solid #1b2942; padding-bottom: 6px; }
  .ok { color: #34d399; } .warn { color: #fbbf24; }
  ul { color: #c8d6ec; line-height: 1.7; font-size: 13px; }
  .footer { margin-top: 40px; color: #8296b3; font-size: 11px; border-top: 1px solid #1b2942; padding-top: 16px; }
</style>
</head>
<body><div class="wrap">
  <h1>DataVault — Demo Report</h1>
  <div class="tag">Privacy-First AI Collaboration Marketplace · Research / Hackathon Demonstration · Generated ${new Date().toISOString()} by ${esc(user.email)}</div>

  <div class="grid">
    <div class="kpi"><b>${orgs.length}</b><span>Organizations</span></div>
    <div class="kpi"><b>${models.length}</b><span>Federated Models</span></div>
    <div class="kpi"><b>${totalRounds}</b><span>Federation Rounds</span></div>
    <div class="kpi"><b>${updates}</b><span>Protected Updates</span></div>
    <div class="kpi"><b>${totalRewards.toFixed(0)}</b><span>DATA Rewards</span></div>
    <div class="kpi"><b>0 bytes</b><span>Raw Data Shared</span></div>
  </div>

  <div class="section"><h2>Federated Models</h2>
  <table>
    <tr><th>Model</th><th>Participants</th><th>Rounds</th><th>Before (silo)</th><th>After (federated)</th><th>Gain</th><th>Encrypted Updates</th><th>Rewards</th></tr>
    ${reportRows.join("")}
  </table></div>

  <div class="section"><h2>Privacy Configuration</h2>
  <ul>
    <li>Raw data shared: <b class="ok">0 bytes</b> — raw datasets remain in participant environments (data/participants/&lt;org&gt;/)</li>
    <li>Model updates: ${updates} submitted — pairwise zero-sum additive masking; AES-256-GCM in ENCRYPTION mode</li>
    <li>Secure aggregation: <b class="ok">ENABLED</b> — masks cancel at the aggregator; individual updates never visible</li>
    <li>Privacy events logged: ${privacyEvents} (including raw-access blocks)</li>
    <li>Federated evaluation: metrics computed locally at participants; only numbers travel</li>
  </ul></div>

  <div class="section"><h2>Blockchain &amp; Integrity</h2>
  <ul>
    <li>Ledger: DataVault Local Test Network (chain 31337), PoW hash-chained blocks</li>
    <li>Chain verification: ${chainVerify.valid ? '<b class="ok">VALID</b>' : '<b class="warn">INVALID</b>'} (${chainVerify.blocks} blocks re-hashed)</li>
    <li>Audit hash chain: ${auditVerify.valid ? '<b class="ok">VALID</b>' : '<b class="warn">INVALID</b>'} (${auditVerify.entries} entries)</li>
    <li>Audit events recorded: ${auditEntries}</li>
  </ul></div>

  <div class="section"><h2>Reward Wallets</h2>
  <table>
    <tr><th>Organization</th><th>Address</th><th>Total Earned</th><th>Available</th><th>Claimed</th></tr>
    ${wallets.map((w) => {
      const org = orgs.find((o) => o.id === w.orgId);
      return `<tr><td>${esc(org?.name ?? "—")}</td><td><small>${w.address.slice(0, 22)}…</small></td><td>${w.totalEarned.toFixed(0)} DATA</td><td>${w.pending.toFixed(0)} DATA</td><td>${w.claimed.toFixed(0)} DATA</td></tr>`;
    }).join("")}
  </table></div>

  <div class="footer">
    DataVault is a research and hackathon demonstration. It is not legal or regulatory compliance advice.
    Production deployments must undergo organization-specific privacy, security, legal, and regulatory review.
    All datasets are synthetic. "Train Together. Share Nothing."
  </div>
</div></body></html>`;

    await audit({ actor: user.email, actorRole: user.role, eventType: "DEMO_EXPORTED", resource: "demo-report.html" });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="datavault-demo-report-${Date.now()}.html"`,
      },
    });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR"]);
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
