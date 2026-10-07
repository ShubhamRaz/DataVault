import { db } from "@/lib/db";
import { runFederatedRound, runFederation, isRunning } from "@/server/federation/orchestrator";
import { audit } from "@/server/audit";
import { ok, fail, withAuth, readJson } from "@/server/api-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET /api/federation/rounds — round history across models. */
export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const modelId = url.searchParams.get("modelId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const take = Math.min(100, Number(url.searchParams.get("take") ?? 50));

    const rounds = await db.federatedRound.findMany({
      where: {
        ...(modelId ? { modelId } : {}),
        ...(status && status !== "all" ? { status } : {}),
      },
      include: { model: { select: { id: true, name: true, industry: true, taskType: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });

    const enriched = [];
    for (const r of rounds) {
      const contributions = await db.contribution.findMany({
        where: { roundId: r.id },
        select: { organization: { select: { name: true } }, normalizedScore: true, sampleCount: true },
      });
      const rewards = await db.reward.findMany({
        where: { roundId: r.id },
        select: { organization: { select: { name: true } }, amount: true, txHash: true, status: true },
      });
      enriched.push({
        id: r.id, roundNumber: r.roundNumber, status: r.status, model: r.model,
        metricsBefore: r.metricsBefore, metricsAfter: r.metricsAfter, improvement: r.improvement,
        durationMs: r.durationMs, encryptedUpdates: r.encryptedUpdates, error: r.error,
        startedAt: r.startedAt, completedAt: r.completedAt,
        config: r.config ? JSON.parse(r.config) : null,
        aggregateMetrics: r.aggregateMetrics ? JSON.parse(r.aggregateMetrics) : null,
        contributions: contributions.map((c) => ({ organizationName: c.organization.name, normalizedScore: c.normalizedScore, sampleCount: c.sampleCount })),
        rewards: rewards.map((w) => ({ organizationName: w.organization.name, amount: w.amount, txHash: w.txHash, status: w.status })),
      });
    }
    return ok({ rounds: enriched });
  }, ["ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"]);
}

/**
 * POST /api/federation/rounds — start real training (spec §13):
 * Frontend → Backend API → ML engine. Progress streams over SSE
 * (/api/federation/events). Supports `rounds: N` for auto-run.
 */
export async function POST(req: Request) {
  return withAuth(async ({ user }) => {
    const body = await readJson<{
      modelId?: string; rounds?: number; epochs?: number; lr?: number;
      batchSize?: number; privacyMode?: "DEMO" | "ENCRYPTION"; pacingMs?: number;
    }>(req);

    if (!body.modelId) return fail("modelId is required");
    const model = await db.model.findUnique({ where: { id: body.modelId } });
    if (!model) return fail("Model not found", 404);
    if (isRunning(body.modelId)) return fail("A federation round is already running for this model", 409);

    const numRounds = Math.min(10, Math.max(1, body.rounds ?? 1));
    const last = await db.federatedRound.findFirst({
      where: { modelId: body.modelId },
      orderBy: { roundNumber: "desc" },
    });
    const nextRound = (last?.roundNumber ?? 0) + 1;

    const config = {
      epochs: Math.min(30, Math.max(1, body.epochs ?? 5)),
      batchSize: Math.min(256, Math.max(8, body.batchSize ?? 32)),
      lr: Math.min(1, Math.max(0.001, body.lr ?? 0.1)),
      privacyMode: body.privacyMode === "ENCRYPTION" ? ("ENCRYPTION" as const) : ("DEMO" as const),
      pacingMs: Math.min(2000, Math.max(0, body.pacingMs ?? 420)),
    };

    // Model privacy mode follows the round's mode
    await db.model.update({ where: { id: model.id }, data: { privacyMode: config.privacyMode, status: "TRAINING" } });
    await audit({
      actor: user.email, actorRole: user.role,
      eventType: "ROUND_STARTED", resource: `${model.name} #${nextRound}`,
      metadata: { rounds: numRounds, config },
    });

    // fire-and-observe: run in background, progress via SSE; resolve with first round quickly
    if (numRounds === 1) {
      const result = await runFederatedRound({
        modelId: body.modelId, roundNumber: nextRound, config, actor: user.email, actorRole: user.role,
      });
      await db.model.update({ where: { id: model.id }, data: { status: "ACTIVE" } }).catch(() => {});
      return ok({ started: true, rounds: 1, result });
    }

    // multi-round: kick off in background so SSE streams the whole sequence
    const promise = runFederation({
      modelId: body.modelId, rounds: numRounds, config,
      actor: user.email, actorRole: user.role,
    })
      .then(async (results) => {
        await db.model.update({ where: { id: body.modelId }, data: { status: "ACTIVE" } }).catch(() => {});
        return results;
      })
      .catch(async (e) => {
        await db.model.update({ where: { id: body.modelId }, data: { status: "ACTIVE" } }).catch(() => {});
        throw e;
      });
    // register observer but don't block the HTTP response
    void promise;

    return ok({ started: true, rounds: numRounds, modelId: body.modelId, streaming: true }, 202);
  }, ["ADMIN", "ML_OPERATOR", "ORG_ADMIN"]);
}
