import { db } from "../src/lib/db";
import { createHash } from "crypto";

async function main() {
  const entries = await db.auditLog.findMany({ orderBy: { seq: "asc" } });
  console.log("total entries:", entries.length);
  let prevHash = "0x" + "0".repeat(64);
  let prevSeq = 0;
  for (const e of entries) {
    const payload = JSON.stringify({
      actor: e.actor, eventType: e.eventType, resource: e.resource,
      status: e.status, metadata: e.metadata ? JSON.parse(e.metadata) : {}, ts: e.createdAt.getTime(),
    });
    const recomputed = `0x${createHash("sha256").update(`${e.prevHash}::${payload}`).digest("hex")}`;
    const issues: string[] = [];
    if (recomputed !== e.entryHash) issues.push("HASH-MISMATCH");
    if (e.prevHash !== prevHash) issues.push("PREV-BROKEN");
    if (e.seq !== prevSeq + 1) issues.push(`SEQ-GAP ${prevSeq}->${e.seq}`);
    if (issues.length) {
      console.log(`seq=${e.seq} ${issues.join(",")} actor=${e.actor} type=${e.eventType} ts=${e.createdAt.toISOString()}`);
      console.log(`  storedHash=${e.entryHash.slice(0, 20)} recomputed=${recomputed.slice(0, 20)} storedPrev=${e.prevHash.slice(0, 14)} expectedPrev=${prevHash.slice(0, 14)}`);
    }
    prevHash = e.entryHash;
    prevSeq = e.seq;
  }
  console.log("done");
}
main();
