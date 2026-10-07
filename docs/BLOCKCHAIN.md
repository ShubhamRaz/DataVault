# DataVault — Blockchain Layer

DataVault anchors **contribution proofs, reward allocations and claims** on a
tamper-evident ledger. It ships two implementations with **identical action
semantics** (`REGISTER_PARTICIPANT → RECORD_CONTRIBUTION → ALLOCATE_REWARD →
CLAIM_REWARD`):

| Mode | Ledger | Where |
| --- | --- | --- |
| Sandbox (default) | **Local hash-chain ledger** — real SHA-256 blocks + PoW, stored in the app database ("DataVault Local Test Network", chainId 31337) | `src/server/blockchain/ledger.ts` |
| Docker / production | **`DataVaultRewards.sol`** on a Hardhat local node (chainId 31337) or Polygon Amoy testnet via ethers.js | `contracts/` + `services/api` |

> **On-chain policy (spec §52): only hashes, proofs, scores and amounts.**
> Never raw records, personal data, model weights, or dataset content.

## 1. The local hash-chain ledger (sandbox)

A genuine proof-of-work hash chain — not an array with fake fields
(`src/server/blockchain/ledger.ts`):

- **Block** = `{ number, prevHash, hash, nonce, txCount, timestamp }` +
  its transactions. Genesis prev-hash = `0x000…0` (64 zeros).
- **Canonical transaction ordering**: a block's header commits to the
  **sorted** list of its tx hashes — identical block content always produces
  the identical header, regardless of arrival order.
- **Mining (PoW, difficulty 3)**: find `nonce` such that

  ```
  SHA-256( header :: nonce )  starts with "000"
  ```

  Fast enough for live demos (< 50 ms typical), yet a real brute-force loop
  — changing any transaction invalidates the block hash instantly.
- **Block append** is serialized through a promise chain so prev-hash links
  can never fork, and each transaction gets a deterministic nonce
  (`blockNumber * 1000 + index`).
- **Transaction** = `{ hash, fromAddress, toAddress, action, amount,
  roundNumber, modelName, participantName, metadata }` with tx hash =
  `SHA-256(JSON(f, t, a, amt, r, m, p, meta, nonce))`.
- **Verification** (`GET /api/blockchain/verify`): walks the whole chain,
  recomputes every block hash from the stored header+nonce and re-checks the
  prev-hash links → `{ valid, blocks, checkedAt, brokenAt? }`. The audit log
  chain is verified the same way.
- **Wallet derivation**: `deriveWalletAddress(orgSlug) =
  HMAC-SHA256("datavault-wallet-derivation-v1", slug)[:20 bytes]` —
  deterministic, server-side, **no private keys ever reach the frontend**.

Actions recorded (matching the Solidity contract):

| Action | Emitted when | Payload highlights |
| --- | --- | --- |
| `REGISTER_PARTICIPANT` | model creation | participant wallet, model hash |
| `RECORD_CONTRIBUTION` | every participant update | `metadata.updateHash` (SHA-256 of the protected update), samples, normalized score |
| `ALLOCATE_REWARD` | reward allocation | amount (DATA), pool (1000) |
| `CLAIM_REWARD` | wallet claim | amount, reward ids |
| `RECORD_PROOF` | model/version proofs | model hash |

Stats endpoint (`GET /api/blockchain/overview`): blocks, transactions,
rewardTransactions, contributionProofs, latest block hash, and
`consensus: "PoW (difficulty 3, hash-chained ledger)"`.

## 2. `DataVaultRewards.sol`

Solidity `^0.8.24`, optimizer on, in `contracts/contracts/`. Full API table:
see [`contracts/README.md`](../contracts/README.md). Summary:

| Function | Role | Purpose |
| --- | --- | --- |
| `registerParticipant(address)` | coordinator | register participant wallet → `ParticipantRegistered` |
| `fundRound(roundId, amount)` | coordinator | fund a round pool (demo: 1000 DATA) |
| `recordContribution(participant, roundId, contributionHash, score)` | coordinator | record contribution proof → `ContributionRecorded` |
| `allocateReward(participant, roundId, amount)` | coordinator | pool-capped allocation → `RewardAllocated` |
| `claimReward()` | participant | pull-based claim → `RewardClaimed` |
| `getParticipantContribution` / `getRoundContribution` / `getParticipantRewards` / `getRoundReward` | view | contribution + wallet state |
| `totalRewardPool()` / `roundRewardPool(roundId)` | view | pool accounting |

**Design choices**

- **DATA = internal accounting unit** (not ERC-20): `uint256` with 2-decimal
  fixed-point (`SCALE = 1e2`, `450.00 DATA = 45000`), mirroring the off-chain
  reward engine; scores use 6-decimal fixed-point (`SCORE_SCALE = 1e6`) like
  the backend's `normalizedScore`.
- **Access control**: `onlyCoordinator` modifier; the deployer (backend
  service account) is the coordinator. Participants only ever call
  `claimReward()` for themselves.
- **Invariants enforced on-chain**: one contribution and one allocation per
  `(participant, round)`; allocations can never exceed the funded round pool;
  claims are pull-based and pending zeroes before any effect.
- **Safety**: checks-effects-interactions, custom errors, zero external calls
  (DATA never transfers out) → reentrancy impossible by construction; a mutex
  remains as defense-in-depth. No loops, no raw data on-chain.
- **Reward formula stays transparent** (spec §37):
  `participant_reward = ROUND_REWARD_POOL × normalized_contribution_score`
  — the coordinator computes normalized scores from real training telemetry
  and submits amounts; the contract enforces the accounting.

**Tests** (`contracts/test/DataVaultRewards.test.js`, 27 chai assertions):
registration (duplicates, zero address), contribution recording (duplicates,
unregistered), the canonical **1000 DATA × 0.45/0.30/0.25 → 450/300/250**
allocation math, pool-cap reverts, claim flow + accounting, **double-claim
prevention**, and **unauthorized-access reverts** for every coordinator
action.

```bash
cd contracts && npm install && npx hardhat test   # 27 passing
```

## 3. Hardhat workflow

```bash
cd contracts
npm install                     # standalone package (own node_modules)

npx hardhat compile             # compile DataVaultRewards.sol
npx hardhat test                # 27 tests (in-process chain, chainId 31337)

npm run node                    # local JSON-RPC node on 0.0.0.0:8545
                                # (20 deterministic 10000-ETH dev accounts)

npm run deploy:local            # deploy → prints address + env wiring
npm run seed:local              # idempotent hospital-a/b/c demo seed:
                                # registers wallets, records 0.45/0.30/0.25
                                # contributions, allocates 450/300/250 DATA,
                                # then re-reads all state (read-only views)
```

Seed output (local node):

```
1) REGISTER_PARTICIPANT
   ✓ Apollo Demo Hospital (hospital-a) registered at 0x0110214cBfC6…
   ✓ AIIMS Demo Center (hospital-b) registered at 0x7AA181430Dcc3…
   ✓ Max Demo Research Lab (hospital-c) registered at 0xeFCc5544feEb…
2) FUND_ROUND            ✓ round #1 funded with 1000.00 DATA
3) RECORD_CONTRIBUTION + ALLOCATE_REWARD   … 450/300/250 DATA
4) READ-ONLY VERIFICATION (view calls)     … pool, pending, lifetime score
```

In Docker the same node runs as the `hardhat` compose service
(`contracts/Dockerfile`, port 8545, chainId 31337); deploy/seed run inside it:

```bash
docker compose exec hardhat npx hardhat run scripts/deploy.js --network localhost
docker compose exec hardhat npx hardhat run scripts/seed-demo.js --network localhost
```

## 4. Polygon Amoy deployment path (optional)

Never required for the demo — no real funds needed (spec §38):

1. `cp contracts/.env.example contracts/.env`
2. Set `PRIVATE_KEY` (a **burner** key with test MATIC only) and
   `POLYGON_AMOY_RPC_URL` (Alchemy / Infura / PublicNode; chainId 80002).
3. Fund the key from a Polygon Amoy faucet.
4. `npm run deploy:amoy` → prints the contract address.
5. Point the backend at it:
   `BLOCKCHAIN_RPC_URL=<amoy url>`, `CHAIN_ID=80002`,
   `REWARD_CONTRACT_ADDRESS=<printed>`.

Security notes: keys live **only** in gitignored `.env` files
(`contracts/.gitignore`, root `.gitignore` documents the pattern); the
hardhat network's built-in dev accounts are publicly known keys and must
never receive real funds; the deployer becomes the on-chain coordinator.

## 5. Backend integration (Docker mode)

`services/api` (FastAPI) talks to the chain via ethers.js:

- Env: `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY` (empty → Hardhat dev
  account #0 for the local chain), `CHAIN_ID`, `REWARD_CONTRACT_ADDRESS`
  (empty → the api service deploys the contract at startup and stores the
  address in Postgres `SystemSetting`).
- Every federation round produces the same four actions as the local ledger:
  register (model init), record contribution (per participant update),
  allocate reward (per reward), claim (on wallet claim). Transaction hashes
  + block numbers are persisted (`Reward.txHash`,
  `AuditLog.blockchainTxHash`) so the UI and the audit trail cross-link the
  chain.
- `WalletService` derives participant wallets exactly like the sandbox
  (`deriveWalletAddress`), so demo org addresses match across both ledgers.

## 6. What goes on-chain — and what never does

| On-chain | Never on-chain |
| --- | --- |
| contribution hash (SHA-256 of the protected update) | raw dataset content |
| normalized contribution score (1e6) | patient/transaction/farm records |
| reward amount (2dp DATA) | model weights / update vectors |
| round id, participant wallet address | participant names* / personal data |
| timestamps, pool amounts | encryption keys, secrets |

\* the sandbox ledger stores org *display names* in transaction metadata for
the explorer UX — the Solidity contract deliberately does not (addresses
only).

## 7. Honest limitations

- The sandbox ledger is **local** (app database + in-process PoW): it is
  tamper-evident for the demo, but it is not a distributed consensus —
  "Local Test Network" is labeled as such everywhere.
- The Hardhat node is a dev chain: deterministic accounts, auto-mining,
  resets on restart (redeploy via the compose entrypoint or seed script).
- DATA is an internal accounting unit, not a transferable token; there is no
  on-chain price/liquidity (by design for the MVP).
- Reward *scores* are computed off-chain by the coordinator — the contract
  verifies accounting, not the ML quality of the score (roadmap: on-chain
  verification of score commitments).
- Polygon Amoy is a testnet; no production/mainnet deployment has been
  audited.
