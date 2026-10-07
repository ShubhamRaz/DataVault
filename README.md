<div align="center">

# 🔐 DataVault

### Train Together. Share Nothing.

**Privacy-First AI Collaboration Marketplace**

Federated learning · secure aggregation · blockchain-anchored rewards

[![Status](https://img.shields.io/badge/status-research%20%2F%20hackathon%20demo-8b5cf6)](.)
[![Next.js](https://img.shields.io/badge/Next.js-16-0ea5e9)](.)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-14b8a6)](.)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-eab308)](.)
[![Docker](https://img.shields.io/badge/Docker-compose-38bdf8)](.)

</div>

> **⚠️ Research / Hackathon Demonstration (spec §2)**
>
> DataVault is a research and hackathon demonstration built on 100%
> synthetic data. It is **not** legal or regulatory compliance advice.
> Production deployments must undergo organization-specific privacy,
> security, legal, and regulatory review. See
> [Honest limitations](#-honest-limitations).

---

## The story (one paragraph)

Hospitals, banks and farm collectives sit on data they legally cannot share
— so every organization trains weak models in isolation. DataVault lets them
**co-train AI models without moving a single raw record**: a global model is
distributed, each organization trains locally, only **privacy-protected
model updates** (pairwise zero-sum masked, optionally AES-256-GCM sealed)
travel to a **secure aggregator**, FedAvg produces the next global model,
contributions are scored transparently, and rewards + contribution proofs
are anchored on a **hash-chained ledger / Solidity contract**. In the seeded
demo, three hospitals that never exchange a patient record lift
**cancer-risk classification accuracy from 83.6% to 89.0%** — real training
runs, zero raw bytes shared.

```
RAW DATA NEVER LEAVES THE DATA OWNER.
```

## Architecture

```
 Browser (Next.js 16 SPA, SSE live events)
   │  /api/*  httpOnly-cookie JWT
   ▼
 API layer ── Embedded Next.js API (sandbox)  ·  FastAPI services/api (Docker)
   │                                        │
   ▼                                        ▼
 SQLite (sandbox)                    PostgreSQL 16 + Redis 7
   │                                        │
   ▼                                        ▼
 Federated Learning Orchestrator ──── PyTorch ml-service :8001
   │  distribute global model · collect protected updates
   ▼
 Participant environments (data/participants/<slug>/ — raw data stays here)
   │  local SGD → weight delta Δ → mask (+ AES-256-GCM) → SHA-256 proof
   ▼
 Secure Aggregator (pairwise zero-sum masks — Σ masks = 0)
   │  FedAvg → global model vNext → model_hash
   ▼
 Contribution scoring → 1000 DATA pool split → Blockchain Reward Engine
   │
   ▼
 Local SHA-256 hash-chain ledger (PoW, chain 31337)  ·  DataVaultRewards.sol
 on Hardhat :8545 / Polygon Amoy — hashes, scores & amounts ONLY
```

Deep dives: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[PRIVACY](docs/PRIVACY.md) · [BLOCKCHAIN](docs/BLOCKCHAIN.md) ·
[FEDERATED_LEARNING](docs/FEDERATED_LEARNING.md) · [API](docs/API.md) ·
[DEMO script](docs/DEMO.md)

## Features checklist

**Layer 1 — Federated Learning (real, not simulated)**
- [x] Round-based FedAvg (sample-weighted) on a custom MLP (tanh hidden,
      sigmoid/linear output) — hand-written forward/backprop/mini-batch SGD
- [x] Non-IID synthetic datasets per participant (feature shifts, class
      prior shifts, noise) — Healthcare / Finance / Agriculture
- [x] Honest silo baselines (local-only models cross-evaluated network-wide)
- [x] Per-round global model versions + SHA-256 model hashes (registry)
- [x] Live round events over SSE (training %, per-epoch loss, phases)
- [x] Multi-round runs, per-model run locks, round failure handling

**Layer 2 — Privacy Computing**
- [x] Pairwise zero-sum additive masking — masks cancel exactly
      (`verifyZeroSum` tolerance 1e-12); aggregator sees only masked vectors
- [x] AES-256-GCM (real authenticated encryption) in ENCRYPTION mode
- [x] `PrivacyEngine` / `EncryptionService` / `SecureAggregator` interfaces
- [x] DEMO vs ENCRYPTION modes; TenSEAL CKKS path in ml-service (Docker)
- [x] Privacy Center: posture booleans, `rawDataSharedBytes: 0`, event log
- [x] RAW_ACCESS_BLOCKED guard on raw dataset downloads (always, all roles)

**Layer 3 — Blockchain & Incentives**
- [x] Local SHA-256 hash-chain ledger ("Local Test Network", PoW difficulty
      3, canonical tx ordering, full chain re-verification)
- [x] `DataVaultRewards.sol` (Solidity ^0.8.24) — registration, contribution
      proofs, pool-capped allocations, pull-based claims, 27 Hardhat tests
- [x] Polygon Amoy network config (env-only, never required for the demo)
- [x] Deterministic server-side wallet derivation — no private keys in the
      frontend, ever

**Marketplace & platform**
- [x] Transparent contribution scoring
      (`0.35·share + 0.25·quality + 0.25·improvement + 0.15·participation`)
      and the 1000 DATA round pool — computed, never hardcoded
- [x] Privacy-first marketplace: models & collaborations, **never raw data**
- [x] Hash-chained audit log + notifications + admin demo controls
      (initialize / regenerate / reset / export HTML report)
- [x] JWT auth (scrypt hashes, httpOnly cookies), 5 RBAC roles, rate limiting
- [x] Full Docker stack: web · api · ml-service · hardhat · postgres · redis

## Tech stack

| Layer | Technology |
| --- | --- |
| Web | **Next.js 16** (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Zustand · TanStack Query · Recharts |
| Embedded backend | Next.js API routes · **Prisma ORM** (SQLite in sandbox) · Node crypto (JWT/scrypt/AES-256-GCM) |
| Services backend | **FastAPI** (services/api) · PostgreSQL 16 · Redis 7 · OpenAPI `/docs` |
| ML | TypeScript MLP + FedAvg engine (sandbox) · **PyTorch** + **TenSEAL CKKS** (services/ml-service) |
| Blockchain | **Solidity ^0.8.24** + **Hardhat** (contracts/) · ethers.js · local node chainId 31337 · optional Polygon Amoy |
| Infra | **Docker Compose** · multi-stage Next.js standalone build |

## Quick start

### Option A — Sandbox mode (fastest; what the hosted preview runs)

Just the Next.js app with the embedded demo engine:

```bash
bun install
bun run db:push            # create the SQLite schema (db/custom.db)
bun scripts/seed.ts        # demo network + REAL training history (~1-2 min)
bun run dev                # → http://localhost:3000
```

Login: **admin@datavault.demo / demo1234**.
(If you skip the seed, the first request auto-seeds.)

### Option B — Full Docker stack (spec §61 one-command demo)

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL | Notes |
| --- | --- | --- |
| web (Next.js) | http://localhost:3000 | login admin@datavault.demo / demo1234 |
| api (FastAPI) | http://localhost:8000 | OpenAPI docs at `/docs` |
| ml-service | http://localhost:8001 | PyTorch + TenSEAL |
| hardhat node | http://localhost:8545 | chainId 31337, 20 dev accounts |
| postgres | localhost:5432 | `datavault:datavault` |
| redis | localhost:6379 | — |

The `web-seed` one-shot service seeds the web app's embedded engine
automatically (real training rounds, ~1–2 min on first boot).

**Mode note:** by default the `web` service runs the **embedded demo
engine** (sandbox mode — self-contained demo). Set
`NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env` and rebuild
(`docker compose up --build --force-recreate web`) to point the web app at
the FastAPI backend. `REWARD_CONTRACT_ADDRESS` empty → the api service
deploys `DataVaultRewards` at startup; to pin an address, see
[docs/BLOCKCHAIN.md](docs/BLOCKCHAIN.md) §3.

## Environment variables

Copy `.env.example` → `.env` (gitignored). Full reference with comments
lives there; summary:

| Variable | Default | Used by | Meaning |
| --- | --- | --- | --- |
| `DATABASE_URL` | sqlite (sandbox) / `postgresql://datavault:datavault@postgres:5432/datavault` | web / api | Prisma connection |
| `REDIS_URL` | `redis://redis:6379` | api, ml-service | queue / pub-sub |
| `JWT_SECRET` | dev default — **change it** | web, api | session token signing |
| `ML_SERVICE_URL` | `http://ml-service:8001` | api | internal ML endpoint |
| `BLOCKCHAIN_RPC_URL` | `http://hardhat:8545` | api | EVM JSON-RPC endpoint |
| `CHAIN_ID` | `31337` | api | 31337 local · 80002 Amoy |
| `BLOCKCHAIN_PRIVATE_KEY` | *(empty)* | api | coordinator key; empty → Hardhat dev account #0 (local only) |
| `REWARD_CONTRACT_ADDRESS` | *(empty)* | api | empty → auto-deploy at startup |
| `NEXT_PUBLIC_API_URL` | *(empty)* | web (build-time) | empty = embedded engine; `http://localhost:8000` = FastAPI backend |
| `PRIVACY_MODE` | `DEMO` | web | `DEMO` / `ENCRYPTION` (AES-256-GCM) |
| `ML_MODE` | `demo` | ml-service | `demo` / `encryption` (TenSEAL CKKS) |

> **Never** commit `.env` files or private keys. `contracts/.env` holds
> deployer keys for testnets only — burner keys, test funds only.

## Database setup

```bash
bun run db:push          # sandbox: push prisma/schema.prisma → SQLite
bun scripts/seed.ts      # demo data + real training history
bun scripts/seed.ts reset  # wipe everything
```

19 models (User, Organization, Wallet, Dataset, Model, ModelVersion,
FederatedRound, Participant, TrainingRun, ModelUpdate, PrivacyEvent,
Contribution, Reward, BlockchainBlock/Transaction, AuditLog,
MarketplaceListing, AccessRequest, SystemSetting, Notification, DemoRunLog)
— ERD summary in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §6.
Docker mode runs the same schema against PostgreSQL via the api service.

## Blockchain setup

```bash
cd contracts
npm install               # standalone npm package (own node_modules)
npx hardhat test          # 27 tests incl. 0.45/0.30/0.25 → 450/300/250 math
npm run node              # local chain on 0.0.0.0:8545 (chainId 31337)
npm run deploy:local      # deploy → prints REWARD_CONTRACT_ADDRESS
npm run seed:local        # hospital-a/b/c demo (idempotent)
```

Polygon Amoy (optional, env-only): `cp contracts/.env.example contracts/.env`,
fill `PRIVATE_KEY` + `POLYGON_AMOY_RPC_URL`, then `npm run deploy:amoy`.
Details: [contracts/README.md](contracts/README.md) and
[docs/BLOCKCHAIN.md](docs/BLOCKCHAIN.md).

## ML setup

- **Sandbox**: nothing to install — the TS engine trains in-process
  (`src/server/ml/mlp.ts`). Round config from the Federation UI.
- **Docker**: `services/ml-service` (PyTorch + TenSEAL) starts with
  `docker compose up`; configure with `ML_MODE=demo|encryption`. Its
  endpoints are documented in [docs/API.md](docs/API.md) §15.

## Demo instructions

Follow the **10-minute script**: [docs/DEMO.md](docs/DEMO.md).
Demo users (all password **`demo1234`**):

| Email | Role | Org |
| --- | --- | --- |
| admin@datavault.demo | ADMIN | DataVault Research Core |
| alice@apollo.demo | ORG_ADMIN | Apollo Demo Hospital (hospital-a) |
| arjun@aiims.demo | ORG_ADMIN | AIIMS Demo Center (hospital-b) |
| priya@max.demo | ORG_ADMIN | Max Demo Research Lab (hospital-c) |
| vikram@hdfc.demo | ORG_ADMIN | HDFC Demo Bank (bank-a) |
| meera@greenvalley.demo | ORG_ADMIN | Green Valley Farm Group (farm-a) |
| raj@datavault.demo | ML_OPERATOR | DataVault Research Core |
| sunita@aiims.demo | PARTICIPANT | AIIMS Demo Center |
| karan@icici.demo | PARTICIPANT | ICICI Demo Bank (bank-b) |
| viewer@datavault.demo | VIEWER | DataVault Research Core |

All organizations, datasets, patients, transactions and farm records are
**100% synthetic**.

## API docs

- Embedded Next.js API (33 routes) + FastAPI `/api/v1/*` + ml-service:
  **[docs/API.md](docs/API.md)**
- Live OpenAPI (Docker mode): http://localhost:8000/docs

## Testing

```bash
# Smart contract (Hardhat + chai) — 27 tests
cd contracts && npm install && npx hardhat test

# Web app (Next.js dev server + API smoke checks)
bun run lint
bun scripts/verify.ts        # sandbox: ledger/audit chain verification

# Python services (Docker mode)
pytest services/api/tests services/ml-service/tests
```

## Security notes

- **Secrets**: only via env vars; `.env` files are gitignored; the repo
  contains no private keys. Hardhat dev accounts are publicly known keys —
  **never** send them real funds.
- **Auth**: scrypt password hashing; JWT (HMAC-SHA256) in httpOnly,
  same-site cookies; login rate limiting (12/min/IP); RBAC on every route.
- **Frontend**: never sees private keys, encryption keys, or raw data.
- **On-chain**: hashes/scores/amounts only (spec §52).
- Demo defaults (`JWT_SECRET`, `demo1234`) are intentionally weak — change
  them for anything beyond a local demo.

## Privacy architecture summary

Three layers (full detail: [docs/PRIVACY.md](docs/PRIVACY.md)):

1. **Federated Learning** — raw data stays in `data/participants/<slug>/`;
   only masked weight deltas, sample counts and metrics leave.
2. **Privacy Computing** — pairwise zero-sum additive masking (masks cancel
   at the aggregator: `Σᵢ maskᵢ = 0`) + AES-256-GCM (ENCRYPTION mode);
   production path: TenSEAL CKKS on selected tensors + DH-derived masks.
3. **Blockchain Incentives** — contribution proofs and rewards anchored on
   the local hash-chain ledger / `DataVaultRewards.sol`.

The executable proof: `GET /api/datasets/{id}/raw` **always** answers
`RAW_ACCESS_BLOCKED` (for every role) and logs the attempt as a privacy
event + audit entry.

## 🧭 Honest limitations

Transparency is a feature (spec §2, §64, §65):

1. **Single-process simulation** — participant "environments" are in-process
   silos with strict API boundaries and separate on-disk datasets, not
   separate machines. The masking math is real; host isolation is not.
2. **Demo-grade crypto where noted** — mask values derive from a shared
   round seed (fast, deterministic; production uses pairwise
   Diffie–Hellman); the AES-256-GCM key is server-side, not participant-held;
   TenSEAL CKKS lives in the Python service for ENCRYPTION-mode production
   paths.
3. **Local ledger vs real chain** — the sandbox ledger is an in-app SHA-256
   PoW chain ("Local Test Network"); the Docker mode runs the real Solidity
   contract on a local Hardhat node; Polygon Amoy is testnet-only, unaudited.
4. **DATA is an accounting unit** — not an ERC-20, no liquidity or price.
5. **Small MLP by design** (≤229 params) — demo-fast and inspectable, not
   SOTA; synthetic ground truth is linear-ish.
6. **No differential privacy yet**; no external security audit; not DPDP
   certification — see the disclaimer at the top.

## Future roadmap

- Per-organization container deployment (true silo isolation, gRPC transport)
- Diffie–Hellman pairwise mask derivation + threshold decryption
- DP-SGD noise budgets on updates
- ERC-20 DATA token + on-chain score-commitment verification
- Model marketplace payments, SLAs and access contracts
- Production audit / pen-test, FHIR & banking data connectors (India focus)
- Foundry toolchain, contract upgradeability + multi-coordinator governance

---

<div align="center">

**DataVault — Train Together. Share Nothing.**

Research / hackathon demonstration · 100% synthetic data ·
[docs/](docs/) · [DEMO script](docs/DEMO.md)

*Not legal or regulatory compliance advice. Production deployments must
undergo organization-specific privacy, security, legal, and regulatory
review (spec §55).*

</div>
