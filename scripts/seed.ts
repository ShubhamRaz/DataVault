#!/usr/bin/env bun
/**
 * DataVault — Seed script: initializes the complete demo network.
 * Usage: bun scripts/seed.ts
 */
import { initializeDemoNetwork, resetDemo } from "../src/server/seed";

const command = process.argv[2] ?? "seed";

async function main() {
  if (command === "reset") {
    console.log("• Resetting demo data…");
    await resetDemo();
    console.log("✓ Reset complete");
    return;
  }
  console.log("• Initializing DataVault demo network (real federated training runs)…");
  const t0 = Date.now();
  const result = await initializeDemoNetwork({ actor: "system" });
  console.log(`✓ Demo network ready in ${result.ms}ms (${((Date.now() - t0) / 1000).toFixed(1)}s wall)`);
  console.log("  Login: admin@datavault.demo / demo1234");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ Seed failed:", e);
    process.exit(1);
  });
