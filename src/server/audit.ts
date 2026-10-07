/**
 * DataVault — Audit system (spec §21, §52).
 * Hash-chained audit log: every entry hashes (prevHash + entry data) →
 * tamper-evident trail. Writes are serialized (in-process mutex) and
 * sequenced so the chain can never fork under concurrent events.
 */
import { createHash } from "crypto";
import { db } from "@/lib/db";

export type AuditEventType =
  | "MODEL_CREATED"
  | "ROUND_STARTED"
  | "MODEL_DISTRIBUTED"
  | "LOCAL_TRAINING_COMPLETED"
  | "UPDATE_ENCRYPTED"
  | "UPDATE_SUBMITTED"
  | "AGGREGATION_COMPLETED"
  | "GLOBAL_MODEL_UPDATED"
  | "ROUND_COMPLETED"
  | "ROUND_FAILED"
  | "REWARD_CREATED"
  | "REWARD_CLAIMED"
  | "BLOCKCHAIN_RECORDED"
  | "ACCESS_REQUESTED"
  | "ACCESS_APPROVED"
  | "ORGANIZATION_REGISTERED"
  | "ORGANIZATION_APPROVED"
  | "USER_LOGIN"
  | "USER_REGISTERED"
  | "DATASET_GENERATED"
  | "RAW_ACCESS_BLOCKED"
  | "DEMO_INITIALIZED"
  | "DEMO_RESET"
  | "DEMO_EXPORTED"
  | "SETTINGS_UPDATED";

const GENESIS = "0x" + "0".repeat(64);

// serialize audit writes so prev-hash chaining can never fork
const g = globalThis as unknown as { __dvAuditChain?: Promise<unknown> };
g.__dvAuditChain ??= Promise.resolve();

export interface AuditParams {
  actor: string;
  actorRole?: string;
  organization?: string;
  eventType: AuditEventType;
  resource?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  blockchainTxHash?: string;
}

export function audit(params: AuditParams): Promise<string> {
  const run = (g.__dvAuditChain as Promise<unknown>).then(async () => writeEntry(params));
  // keep the chain alive even if a single write fails
  g.__dvAuditChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function writeEntry(params: AuditParams): Promise<string> {
  const last = await db.auditLog.findFirst({ orderBy: { seq: "desc" }, select: { entryHash: true, seq: true } });
  const prevHash = last?.entryHash ?? GENESIS;
  const seq = (last?.seq ?? 0) + 1;
  const ts = new Date();
  // NOTE: every field must be JSON-stable across write & verify (undefined → null
  // so JSON.stringify keeps the key and the payload bytes match exactly)
  const payload = JSON.stringify({
    actor: params.actor,
    eventType: params.eventType,
    resource: params.resource ?? null,
    status: params.status ?? "SUCCESS",
    metadata: params.metadata ?? {},
    ts: ts.getTime(),
  });
  const entryHash = `0x${createHash("sha256").update(`${prevHash}::${payload}`).digest("hex")}`;
  await db.auditLog.create({
    data: {
      seq,
      actor: params.actor,
      actorRole: params.actorRole,
      organization: params.organization,
      eventType: params.eventType,
      resource: params.resource,
      status: params.status ?? "SUCCESS",
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      entryHash,
      prevHash,
      blockchainTxHash: params.blockchainTxHash,
      createdAt: ts,
    },
  });
  return entryHash;
}

/** Verify the audit hash chain integrity (seq order + hash links + recomputation). */
export async function verifyAuditChain(): Promise<{ valid: boolean; entries: number; brokenAtEntry?: string }> {
  const entries = await db.auditLog.findMany({ orderBy: { seq: "asc" } });
  let prevHash = GENESIS;
  for (const e of entries) {
    const payload = JSON.stringify({
      actor: e.actor,
      eventType: e.eventType,
      resource: e.resource,
      status: e.status,
      metadata: e.metadata ? JSON.parse(e.metadata) : {},
      ts: e.createdAt.getTime(),
    });
    const recomputed = `0x${createHash("sha256").update(`${e.prevHash}::${payload}`).digest("hex")}`;
    if (recomputed !== e.entryHash || e.prevHash !== prevHash) {
      return { valid: false, entries: entries.length, brokenAtEntry: e.id };
    }
    prevHash = e.entryHash;
  }
  return { valid: true, entries: entries.length };
}
