# DataVault Contracts — Solidity Reward Ledger

Solidity implementation of the DataVault contribution & reward layer
(**spec §38 / §39 / §52**): participant registration, contribution-proof
recording, pool-capped reward allocation and pull-based claims, with strict
coordinator-only access control. It mirrors the semantics of the TypeScript
local ledger in `src/server/blockchain/ledger.ts`
(`REGISTER_PARTICIPANT` → `RECORD_CONTRIBUTION` → `ALLOCATE_REWARD` →
`CLAIM_REWARD`), so the same product story runs on both the embedded sandbox
ledger and this EVM contract.

```
contracts/
├── contracts/DataVaultRewards.sol   # the contract (Solidity ^0.8.24)
├── test/DataVaultRewards.test.js    # 27 Hardhat + chai tests
├── scripts/deploy.js                # deploy to the current network, prints address
├── scripts/seed-demo.js             # hospital-a/b/c demo seed (idempotent)
├── hardhat.config.js                # chainId 31337 · localhost · polygonAmoy (env)
├── Dockerfile                       # local test network container (RPC :8545)
├── package.json                     # standalone npm package (own node_modules)
└── .env.example                     # PRIVATE_KEY, POLYGON_AMOY_RPC_URL, …
```

## The DATA token (design choice)

DATA is an **internal accounting unit**, not an ERC-20. Amounts are `uint256`
in **2-decimal fixed-point** (`SCALE = 1e2`, so `450.00 DATA = 45000 units`) —
exactly the precision used by the off-chain reward engine
(`src/server/rewards/reward-engine.ts`, pool = 1000 DATA, rewards rounded to
2 decimals). Contribution scores use **6-decimal fixed-point**
(`SCORE_SCALE = 1e6`, `0.45 → 450000`), matching the backend's
`normalizedScore` precision. No floats, no token plumbing; a production
deployment would wrap this in an ERC-20 without changing the math.

## Contract API

| Function | Who | Description |
| --- | --- | --- |
| `registerParticipant(address)` | coordinator | Register a participant wallet (event `ParticipantRegistered`) |
| `fundRound(uint256 roundId, uint256 amount)` | coordinator | Fund a round's reward pool (demo: 1000 DATA) |
| `recordContribution(address, uint256 roundId, bytes32 hash, uint256 score)` | coordinator | Record contribution **proof** (event `ContributionRecorded`) |
| `allocateReward(address, uint256 roundId, uint256 amount)` | coordinator | Allocate DATA from the round pool (event `RewardAllocated`) |
| `claimReward()` | participant | Claim all pending rewards (event `RewardClaimed`) |
| `getParticipantContribution(address)` | view | Lifetime score, contribution count, last round |
| `getRoundContribution(address, uint256)` | view | Contribution hash + score for a round |
| `getParticipantRewards(address)` | view | Pending / claimed / total allocated |
| `getRoundReward(address, uint256)` | view | Reward allocated for one (participant, round) |
| `totalRewardPool()` | view | Total outstanding pool (funded − claimed) |
| `roundRewardPool(uint256)` | view | (funded, allocated, remaining) for a round |
| `isParticipant(address)` / `SCALE()` / `SCORE_SCALE()` | view | Registry & precision |

**Events**: `ParticipantRegistered`, `ContributionRecorded`, `RewardAllocated`,
`RewardClaimed`, `RoundFunded`.

**Guards (custom errors)**: `NotCoordinator`, `AlreadyRegistered`,
`NotRegistered`, `ContributionAlreadyRecorded`, `NoContributionForRound`,
`RewardAlreadyAllocated`, `RoundNotFunded`, `InsufficientRoundPool`,
`NoPendingRewards`, `ZeroAddress`, `ZeroAmount`, `ReentrantCall`.

**Safety**: deployer = coordinator (`onlyCoordinator`); one contribution and
one allocation per (participant, round); allocations can never exceed the
funded pool; claims are pull-based with checks-effects-interactions; the
contract makes **zero external calls** (DATA is internal accounting), so
reentrancy is impossible by construction (a mutex is kept as
defense-in-depth).

**Privacy policy (spec §52)**: only hashes, scores and amounts go on-chain.
Never raw records, personal data, model weights or dataset content.

## Quickstart

```bash
cd contracts
npm install                 # standalone package, own node_modules

npx hardhat compile         # compile the contract
npx hardhat test            # 27 tests: registration, contributions,
                            # 0.45/0.30/0.25 → 450/300/250 allocation math,
                            # claims, double-claim, unauthorized reverts
```

## Run the local test network

```bash
npm run node                # JSON-RPC on 0.0.0.0:8545, chainId 31337
                            # 20 deterministic pre-funded accounts (10000 ETH)
```

Deploy + seed against it (second terminal):

```bash
npm run deploy:local        # → prints REWARD_CONTRACT_ADDRESS
npm run seed:local          # registers hospital-a/b/c, records demo
                            # contributions, allocates 450/300/250 DATA,
                            # then re-reads everything (read-only verification)
```

`scripts/seed-demo.js` is **idempotent** — re-running skips already-recorded
actions. It reuses `REWARD_CONTRACT_ADDRESS` from `contracts/.env` when set,
otherwise deploys a fresh contract. Wallet addresses are derived exactly like
the backend (`deriveWalletAddress` in `src/server/blockchain/ledger.ts`):
`HMAC-SHA256("datavault-wallet-derivation-v1", orgSlug)[:20 bytes]` — no
private keys are involved in registration.

## Polygon Amoy (optional public testnet)

Never required for the demo. To deploy on a public chain:

```bash
cp .env.example .env        # then fill PRIVATE_KEY + POLYGON_AMOY_RPC_URL
                            # (funded with test MATIC from the Amoy faucet)
npm run deploy:amoy         # deployer = coordinator on chainId 80002
```

Get an RPC URL from Alchemy / Infura / PublicNode and test MATIC from a
Polygon Amoy faucet. **Only ever use a burner key with test funds.**

## Secrets

All secrets live in `contracts/.env` (gitignored — see `.gitignore`). The
repo contains **no private keys**; the local network uses Hardhat's public
deterministic dev accounts, and `hardhat.config.js` reads keys only from env
vars. Never expose keys to the frontend.

## Docker

```bash
docker build -t datavault-hardhat ./contracts   # from the repo root
docker run -p 8545:8545 datavault-hardhat       # local test network
```

This is exactly what the `hardhat` service in the root `docker-compose.yml`
does.

## Related docs

- `docs/BLOCKCHAIN.md` — ledger design, contract integration, Amoy path
- `README.md` (repo root) — full-stack quick start
