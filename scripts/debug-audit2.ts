import { db } from "../src/lib/db";
import { createHash } from "crypto";

async function main() {
  const e = await db.auditLog.findFirst({ where: { seq: 145 } });
  if (!e) return console.log("not found");
  const h = (payload: string) => `0x${createHash("sha256").update(`${e!.prevHash}::${payload}`).digest("hex")}`;
  const base = {
    actor: e.actor, eventType: e.eventType, resource: e.resource, status: e.status,
    metadata: e.metadata ? JSON.parse(e.metadata) : {},
  };
  const ts = e.createdAt.getTime();
  const candidates: Record<string, string> = {
    "exact": JSON.stringify({ ...base, ts }),
    "ts-1": JSON.stringify({ ...base, ts: ts - 1 }),
    "ts+1": JSON.stringify({ ...base, ts: ts + 1 }),
    "ts-2": JSON.stringify({ ...base, ts: ts - 2 }),
    "tsDateNow(rounded s)": JSON.stringify({ ...base, ts: Math.floor(ts / 1000) * 1000 }),
    "no-ts": JSON.stringify(base),
    "ts-as-string": JSON.stringify({ ...base, ts: e.createdAt.toISOString() }),
    "ts-as-date-obj": JSON.stringify({ ...base, ts: e.createdAt }),
    "with-org": JSON.stringify({ ...base, ts, organization: e.organization }),
  };
  for (const [name, payload] of Object.entries(candidates)) {
    const match = h(payload) === e.entryHash;
    if (match) console.log("MATCH:", name);
  }
  console.log("stored:", e.entryHash);
  console.log("org:", e.organization, "| resource:", JSON.stringify(e.resource), "| status:", e.status);
  console.log("createdAt iso:", e.createdAt.toISOString(), "| ms:", ts);
}
main();
