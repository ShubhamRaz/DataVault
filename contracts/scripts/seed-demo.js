/**
 * DataVault — demo seeding against the LOCAL Hardhat node (read-only friendly).
 *
 * Registers the three demo hospital participants, records their demo
 * contributions for round #1, funds the 1000 DATA round pool and allocates
 * the canonical spec §37 split (0.45 / 0.30 / 0.25 → 450 / 300 / 250 DATA),
 * then re-reads all state via view calls (read-only verification).
 *
 * Only hashes, scores and amounts ever touch the chain — never raw data.
 *
 * Usage (local node must be running: `npm run node` or `docker compose up hardhat`):
 *   npx hardhat run scripts/seed-demo.js --network localhost
 *
 * Idempotent: safe to re-run — already-recorded actions are skipped.
 * If REWARD_CONTRACT_ADDRESS is set (contracts/.env), that contract is used;
 * otherwise a fresh one is deployed to the current network.
 */
const hre = require("hardhat");
const { createHmac, createHash } = require("crypto");

// ── demo network (mirrors src/server/demo-specs.ts) ──
const HOSPITALS = [
  { slug: "hospital-a", name: "Apollo Demo Hospital", score: "0.45", reward: "450" },
  { slug: "hospital-b", name: "AIIMS Demo Center", score: "0.30", reward: "300" },
  { slug: "hospital-c", name: "Max Demo Research Lab", score: "0.25", reward: "250" },
];

const ROUND = 1;
const ROUND_POOL = hre.ethers.parseUnits("1000", 2); // 1000 DATA = 100000 units

/** Same deterministic wallet derivation as src/server/blockchain/ledger.ts —
 *  org slug → HMAC-SHA256 → first 20 bytes. No private keys involved. */
function deriveWalletAddress(slug) {
  const digest = createHmac("sha256", "datavault-wallet-derivation-v1").update(slug).digest("hex");
  return hre.ethers.getAddress(`0x${digest.slice(0, 40)}`);
}

/** SHA-256 contribution proof of a demo update payload (hash only — never raw data). */
function contributionHash(slug, round) {
  const payload = JSON.stringify({ participant: slug, round, model: "Cancer Risk Prediction", privacy: "masked-update" });
  return hre.ethers.hexlify(createHash("sha256").update(payload).digest());
}

const fmtDATA = (units) => {
  const s = hre.ethers.formatUnits(units, 2);
  return `${Number(s).toFixed(2)} DATA`;
};

async function main() {
  const [coordinator] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const target = process.env.REWARD_CONTRACT_ADDRESS || "";

  console.log("──────────────────────────────────────────────────────────");
  console.log("DataVault demo seed (local test network only — no real funds)");
  console.log(`  network     : ${hre.network.name} (chainId ${chainId})`);
  console.log(`  coordinator : ${coordinator.address}`);
  console.log("──────────────────────────────────────────────────────────");

  let contract;
  if (target && hre.ethers.isAddress(target)) {
    contract = await hre.ethers.getContractAt("DataVaultRewards", target);
    console.log(`✓ using existing DataVaultRewards at ${target}`);
  } else {
    contract = await hre.ethers.deployContract("DataVaultRewards");
    await contract.waitForDeployment();
    console.log(`✓ deployed fresh DataVaultRewards at ${await contract.getAddress()}`);
    console.log(`  → set REWARD_CONTRACT_ADDRESS=${await contract.getAddress()} for the api service`);
  }

  // ── 1. register hospital participants (idempotent) ──
  console.log("\n1) REGISTER_PARTICIPANT");
  for (const h of HOSPITALS) {
    const wallet = deriveWalletAddress(h.slug);
    const registered = await contract.isParticipant(wallet);
    if (registered) {
      console.log(`   • ${h.name} (${h.slug}) already registered at ${wallet} — skipped`);
    } else {
      await (await contract.registerParticipant(wallet)).wait();
      console.log(`   ✓ ${h.name} (${h.slug}) registered at ${wallet}`);
    }
  }

  // ── 2. fund the round pool (idempotent) ──
  console.log("\n2) FUND_ROUND");
  const fundedBefore = (await contract.roundRewardPool(ROUND))[0];
  if (fundedBefore > 0n) {
    console.log(`   • round #${ROUND} already funded with ${fmtDATA(fundedBefore)} — skipped`);
  } else {
    await (await contract.fundRound(ROUND, ROUND_POOL)).wait();
    console.log(`   ✓ round #${ROUND} funded with ${fmtDATA(ROUND_POOL)}`);
  }

  // ── 3. record contributions + allocate rewards (spec §37 split) ──
  console.log("\n3) RECORD_CONTRIBUTION + ALLOCATE_REWARD");
  for (const h of HOSPITALS) {
    const wallet = deriveWalletAddress(h.slug);
    const hash = contributionHash(h.slug, ROUND);
    const score = hre.ethers.parseUnits(h.score, 6); // 6-decimal normalized score
    const amount = hre.ethers.parseUnits(h.reward, 2); // 2-decimal DATA amount

    const [, , recorded] = await contract.getRoundContribution(wallet, ROUND);
    if (!recorded) {
      await (await contract.recordContribution(wallet, ROUND, hash, score)).wait();
      console.log(`   ✓ ${h.name}: contribution recorded (score ${h.score}, proof ${hash.slice(0, 18)}…)`);
    } else {
      console.log(`   • ${h.name}: contribution for round #${ROUND} already recorded — skipped`);
    }

    const alreadyAllocated = await contract.getRoundReward(wallet, ROUND);
    if (alreadyAllocated > 0n) {
      console.log(`   • ${h.name}: reward for round #${ROUND} already allocated — skipped`);
    } else {
      await (await contract.allocateReward(wallet, ROUND, amount)).wait();
      console.log(`   ✓ ${h.name}: ${fmtDATA(amount)} allocated (pending claim)`);
    }
  }

  // ── 4. read-only verification ──
  console.log("\n4) READ-ONLY VERIFICATION (view calls)");
  const [funded, allocated, remaining] = await contract.roundRewardPool(ROUND);
  console.log(`   round #${ROUND} pool   : funded ${fmtDATA(funded)} · allocated ${fmtDATA(allocated)} · remaining ${fmtDATA(remaining)}`);
  console.log(`   total reward pool     : ${fmtDATA(await contract.totalRewardPool())}`);
  console.log(`   total claimed         : ${fmtDATA(await contract.totalClaimed())}`);

  console.log("\n   participant            wallet                                    score     pending");
  for (const h of HOSPITALS) {
    const wallet = deriveWalletAddress(h.slug);
    const [lifetime, count, lastRound] = await contract.getParticipantContribution(wallet);
    const [pending, claimed] = await contract.getParticipantRewards(wallet);
    console.log(
      `   ${h.name.padEnd(22)} ${wallet}  ${hre.ethers.formatUnits(lifetime, 6)}  ${fmtDATA(pending).padStart(12)} (claimed ${fmtDATA(claimed)}, ${count} contributions, last round ${lastRound})`
    );
  }

  console.log("\n──────────────────────────────────────────────────────────");
  console.log("Seed complete. Claim from a participant wallet with:");
  console.log("  contract.connect(signer).claimReward()");
  console.log("On-chain content: hashes, scores, amounts only — no raw data (spec §52).");
  console.log("──────────────────────────────────────────────────────────");
}

main().catch((error) => {
  console.error("✗ seed failed:", error);
  process.exitCode = 1;
});
