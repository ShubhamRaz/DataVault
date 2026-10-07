import { db } from "@/lib/db";
import { ok, errorResponse } from "@/server/api-helpers";
import { ensureSeeded } from "@/server/seed";

export const dynamic = "force-dynamic";

/** Live dashboard KPIs + chart series (spec §10) — all from the DB, nothing hardcoded. */
export async function GET() {
  try {
    await ensureSeeded();

    const [
      organizations, activeModels, federationRounds, encryptedUpdates, rewardsAgg,
      privacyEvents, participants, blocks, txs, listings,
    ] = await Promise.all([
      db.organization.count({ where: { status: "ACTIVE" } }),
      db.model.count({ where: { status: "ACTIVE" } }),
      db.federatedRound.count(),
      db.modelUpdate.count({ where: { encrypted: true } }),
      db.reward.aggregate({ _sum: { amount: true } }),
      db.privacyEvent.count(),
      db.participant.count(),
      db.blockchainBlock.count(),
      db.blockchainTransaction.count(),
      db.marketplaceListing.count({ where: { status: "ACTIVE" } }),
    ]);

    // model accuracy progression (primary metric per round, per model)
    const models = await db.model.findMany({
      select: { id: true, name: true, taskType: true, industry: true, baselineAccuracy: true, currentAccuracy: true, currentVersion: true },
      orderBy: { createdAt: "asc" },
    });
    const modelProgression = [];
    for (const m of models) {
      const rounds = await db.federatedRound.findMany({
        where: { modelId: m.id, status: "COMPLETED" },
        select: { roundNumber: true, metricsAfter: true, improvement: true },
        orderBy: { roundNumber: "asc" },
      });
      modelProgression.push({
        modelId: m.id, name: m.name, taskType: m.taskType, industry: m.industry,
        baseline: m.baselineAccuracy, current: m.currentAccuracy, version: m.currentVersion,
        series: rounds.map((r) => ({ round: r.roundNumber, value: r.metricsAfter })),
      });
    }

    // organization contribution (lifetime scores)
    const orgs = await db.organization.findMany({
      where: { slug: { not: "datavault-core" } },
      select: { name: true, industry: true },
      orderBy: { name: "asc" },
    });
    const contributionByOrg = [];
    for (const o of orgs) {
      const lifetime = await db.participant.aggregate({
        where: { organization: { name: o.name } },
        _sum: { lifetimeScore: true },
      });
      const rewardSum = await db.reward.aggregate({
        where: { organization: { name: o.name } },
        _sum: { amount: true },
      });
      contributionByOrg.push({
        org: o.name, industry: o.industry,
        lifetimeScore: Math.round((lifetime._sum.lifetimeScore ?? 0) * 1000) / 1000,
        rewards: Math.round(rewardSum._sum.amount ?? 0),
      });
    }

    // rewards distribution per round (latest 12 rounds)
    const recentRounds = await db.federatedRound.findMany({
      orderBy: { roundNumber: "desc" }, take: 12,
      include: { model: { select: { name: true } } },
    });
    const rewardsPerRound = [];
    for (const r of recentRounds) {
      const sum = await db.reward.aggregate({ where: { roundId: r.id }, _sum: { amount: true } });
      rewardsPerRound.push({
        round: `#${r.roundNumber}`, model: r.model.name, total: sum._sum.amount ?? 0,
        improvement: r.improvement, encryptedUpdates: r.encryptedUpdates,
      });
    }
    rewardsPerRound.reverse();

    // privacy events by type
    const privacyByType: Record<string, number> = {};
    const pe = await db.privacyEvent.findMany({ select: { type: true } });
    for (const e of pe) privacyByType[e.type] = (privacyByType[e.type] ?? 0) + 1;

    // network activity timeline (rounds + updates per day, last 14 days)
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const roundRows = await db.federatedRound.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true, encryptedUpdates: true, improvement: true },
    });
    const activity: Record<string, { rounds: number; updates: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      activity[d.toISOString().slice(0, 10)] = { rounds: 0, updates: 0 };
    }
    for (const r of roundRows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (activity[key]) {
        activity[key].rounds += 1;
        activity[key].updates += r.encryptedUpdates;
      }
    }

    const avgAccuracy = models.length
      ? models.reduce((s, m) => s + m.currentAccuracy, 0) / models.length
      : 0;

    return ok({
      kpis: {
        organizations,
        activeModels,
        federationRounds,
        encryptedUpdates,
        totalContributions: await db.contribution.count(),
        rewardsDistributed: Math.round(rewardsAgg._sum.amount ?? 0),
        privacyEvents,
        modelAccuracy: Math.round(avgAccuracy * 10000) / 100,
        participants,
        blocks,
        transactions: txs,
        listings,
      },
      modelProgression,
      contributionByOrg,
      rewardsPerRound,
      privacyByType,
      activity: Object.entries(activity).map(([date, v]) => ({ date, ...v })),
      demo: {
        label: "Research / Hackathon Demonstration",
        rawDataSharedBytes: 0,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
