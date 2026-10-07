# DataVault — Architecture

> **DataVault is a research and hackathon demonstration** (spec §2, §55).
> It is not legal or regulatory compliance advice. Production deployments
> must undergo organization-specific privacy, security, legal, and regulatory
> review.

## 1. The idea in one paragraph

Organizations hold valuable data they cannot legally or commercially share
(patients, transactions, farm records). DataVault lets them **co-train AI
models without moving raw data**: a global model is distributed, each
organization trains locally, only **privacy-protected model updates** leave
the premises, a **secure aggregator** combines them (FedAvg), contribution is
scored transparently, and rewards + contribution proofs are anchored on a
**blockchain ledger**. Core principle: **RAW DATA NEVER LEAVES THE DATA OWNER.**

## 2. Full-stack diagram

```
                              ┌─────────────────────────────┐
                              │        Browser (SPA)        │
                              │  Next.js 16 + React 19      │
                              │  hash-routed views, SSE     │
                              │  dark navy/cyan theme       │
                              └──────────────┬──────────────┘
                                             │  /api/*  (httpOnly cookie JWT)
                ┌────────────────────────────┴────────────────────────────┐
                │                    API GATEWAY / BACKEND                │
                │  ┌─────────────────────────┐   ┌──────────────────────┐ │
                │  │ Embedded API (Next.js)  │   │  FastAPI (services/  │ │
                │  │ /api/auth /orgs /models │   │  api) :8000          │ │
                │  │ /federation /rewards    │   │  /api/v1/*  OpenAPI  │ │
                │  │ /blockchain /audit      │   │  /docs               │ │
                │  └───────────┬─────────────┘   └──────────┬───────────┘ │
                │              │ Prisma                       │ Prisma/ORM │
                │              ▼                              ▼            │
                │        ┌────────────┐                ┌──────────────┐    │
                │        │  SQLite    │                │ PostgreSQL16 │    │
                │        │ (sandbox)  │                │   (Docker)   │    │
                │        └────────────┘                └──────────────┘    │
                │              │                              │            │
                │  ┌───────────┴────────────┐       ┌───────┴──────────┐  │
                │  │ FL ORCHESTRATOR        │       │  Redis 7         │  │
                │  │ (TS engine in-process  │       │  job bus / SSE   │  │
                │  │  OR PyTorch service)   │◄──────┤  pub-sub         │  │
                │  └───────────┬────────────┘  ┌────┴───────────────┐  │
                │              │               │ ml-service :8001   │  │
                │              │               │ PyTorch + FedAvg   │  │
                │              │               │ TenSEAL CKKS       │  │
                │              │               └────────────────────┘  │
                └──────────────┼───────────────────────────────────────┘
                               │  (mask + optional AES-256-GCM)
        ┌──────────────────────┼──────────────────────┐
        │        PARTICIPANT TRAINING ENVIRONMENTS    │   ← raw data stays
        │  ┌────────────┐ ┌────────────┐ ┌──────────┐ │     INSIDE each silo
        │  │ Hospital A │ │ Hospital B │ │Hospital C│ │
        │  │ data/      │ │ data/      │ │ data/    │ │
        │  │ participants│ │ participants│ │participants│
        │  │ /hospital-a│ │ /hospital-b│ │/hospital-c│
        │  └─────┬──────┘ └─────┬──────┘ └────┬─────┘ │
        │        │ local SGD    │             │       │
        └────────┼──────────────┼─────────────┼───────┘
                 │  weight deltas only (masked / encrypted)
                 ▼
        ┌──────────────────────────────────────────────┐
        │ PRIVACY LAYER → SECURE AGGREGATOR            │
        │ pairwise zero-sum masks (Σ masks = 0)        │
        │ AES-256-GCM (ENCRYPTION mode)                │
        │ TenSEAL CKKS (production path, ml-service)   │
        └──────────────────────┬───────────────────────┘
                               ▼
        ┌──────────────────────────────────────────────┐
        │ GLOBAL MODEL REGISTRY                        │
        │ versions v1.0…v1.N, model_hash (SHA-256),    │
        │ per-round metrics, weights artifacts         │
        └──────────────────────┬───────────────────────┘
                               ▼
        ┌──────────────────────────────────────────────┐
        │ BLOCKCHAIN REWARD ENGINE                     │
        │ 1) local SHA-256 hash-chain ledger           │
        │    (PoW difficulty 3, chain 31337) — sandbox │
        │ 2) DataVaultRewards.sol on Hardhat :8545 /   │
        │    Polygon Amoy — Docker / production       │
        └──────────────────────┬───────────────────────┘
                               ▼
                 contribution proofs + reward events on-chain
                 (hashes, scores, amounts ONLY — never raw data)

        Side-rails: Audit log (hash-chained) · Notifications ·
                    Privacy event log · Marketplace + access requests
```

## 3. Data flow of one federated round

1. **Round start** — `POST /api/federation/rounds` (RBAC: ADMIN /
   ML_OPERATOR / ORG_ADMIN). A `FederatedRound` row is created (status
   `RUNNING`); the run lock prevents concurrent rounds per model.
2. **Model distribution** — the latest `ModelVersion` (global weights +
   federated standardizer) is "distributed" to every active `Participant`
   (in the demo, participant nodes are in-process environments backed by
   `data/participants/<slug>/data.csv`).
3. **Local training** — each participant trains locally (mini-batch SGD,
   configurable epochs/lr/batch). Training runs stream progress events
   (`PARTICIPANT_TRAINING`, epoch-level loss) over SSE.
4. **Update protection** — the weight delta `Δ = w_local − w_global` is
   serialized and protected: pairwise zero-sum additive mask (+ optional
   AES-256-GCM in ENCRYPTION mode). A SHA-256 `updateHash` proof is computed.
5. **Submission** — a `TrainingRun` + `ModelUpdate` row is stored
   (hash, sample count, norm, size, encrypted flag — **never raw data**);
   a privacy event `UPDATE_ENCRYPTED` and an audit entry are written.
6. **Secure aggregation** — the aggregator sums the *masked* vectors
   (sample-weighted FedAvg). Masks cancel exactly, so only the aggregate
   is recoverable.
7. **Global model update** — `w_new = w_global + Δ_aggregate`; a new
   `ModelVersion` is registered with `model_hash` (SHA-256), and the model is
   re-evaluated at every participant (metrics only travel).
8. **Contribution scoring** — transparent formula
   `0.35·sample_share + 0.25·quality + 0.25·improvement + 0.15·participation`,
   normalized across participants → `Contribution` rows.
9. **Reward allocation** — `participant_reward = 1000 DATA ×
   normalized_score` → `Reward` rows (`AVAILABLE`) + wallet pending updates.
10. **Blockchain recording** — `RECORD_CONTRIBUTION` + `ALLOCATE_REWARD`
    transactions are mined into a new block (local ledger / smart contract);
    reward tx hashes are attached to the reward rows.
11. **Round completion** — round status `COMPLETED`, notifications emitted,
    everything visible in dashboards, audit log and chain explorer.

The exact event sequence is documented in
[docs/FEDERATED_LEARNING.md](./FEDERATED_LEARNING.md) §6.

## 4. Component responsibilities

| Component | Location | Responsibility |
| --- | --- | --- |
| Web SPA | `src/components/datavault/*` | All views (landing, auth, dashboard, organizations, models, federation, datasets, privacy, blockchain, rewards, marketplace, audit, admin, settings). SSE-driven live training view. |
| Embedded API | `src/app/api/**/route.ts` | 30+ REST endpoints, RBAC, uniform envelope, audit + privacy events on every sensitive action. |
| Auth | `src/server/auth.ts` | scrypt password hashing, JWT (HMAC-SHA256) in httpOnly cookie, RBAC helpers, login rate limiting. |
| FL orchestrator | `src/server/federation/orchestrator.ts` | Round lifecycle, run locks, event emission, scoring/reward/ledger wiring. |
| Participant node | `src/server/federation/participant-node.ts` | Simulated participant environment: local train/eval on `data/participants/<slug>/`. |
| ML engine | `src/server/ml/mlp.ts`, `metrics.ts` | Hand-written MLP (tanh hidden, sigmoid/linear output), mini-batch SGD, FedAvg, hashing. |
| Privacy engine | `src/server/privacy/privacy-engine.ts` | `PrivacyEngine` / `EncryptionService` (AES-256-GCM) / `SecureAggregator` (pairwise zero-sum masks). |
| Reward engine | `src/server/rewards/reward-engine.ts` | Transparent contribution scoring + 1000 DATA pool split + persistence. |
| Local ledger | `src/server/blockchain/ledger.ts` | SHA-256 hash-chained blocks, PoW (difficulty 3), chain verification, deterministic wallet derivation. |
| Audit | `src/server/audit.ts` | Hash-chained audit log with `blockchainTxHash` cross-links. |
| Seed / demo | `src/server/seed.ts`, `demo-specs.ts`, `synthetic-data.ts` | 10 orgs / 10 users / 9 datasets / 3 models / real historical rounds. |
| FastAPI backend | `services/api` *(services agent)* | Docker-mode REST backend (OpenAPI `/docs`), Postgres persistence, ethers.js contract client. |
| ML service | `services/ml-service` *(services agent)* | PyTorch training service + TenSEAL CKKS encryption mode. |
| Contracts | `contracts/` | `DataVaultRewards.sol`, Hardhat tests/deploy/seed, local node container, Amoy config. |
| Infra | `docker-compose.yml`, root `Dockerfile`, `contracts/Dockerfile` | One-command full stack (see §7). |

## 5. The three privacy layers (spec §5)

| Layer | Sandbox implementation | Production path |
| --- | --- | --- |
| **1 — Federated Learning** | Round-based FedAvg on a custom MLP (TS engine, real SGD + real metrics); participant environments read local CSVs; only weight deltas travel. | PyTorch `services/ml-service`, participant-side deployment, gRPC/queue transport. |
| **2 — Privacy Computing** | Pairwise zero-sum additive masking (masks cancel at the aggregator — **real math**, demo-grade key derivation); optional AES-256-GCM (real authenticated encryption) over masked updates. DEMO mode = fast/deterministic; ENCRYPTION mode = masking + GCM. | TenSEAL **CKKS** homomorphic encryption of selected update tensors + pairwise Diffie–Hellman mask derivation (no shared seed). |
| **3 — Blockchain / Incentives** | SHA-256 hash-chained local ledger ("DataVault Local Test Network", PoW difficulty 3, chainId 31337) recording contribution proofs, reward allocations and claims. | `DataVaultRewards.sol` on Hardhat local node / **Polygon Amoy** testnet via ethers.js (same action semantics). |

See [docs/PRIVACY.md](./PRIVACY.md) for the masking math and
[docs/BLOCKCHAIN.md](./BLOCKCHAIN.md) for the ledger/contract design.

## 6. Database ERD summary (Prisma — 19 models)

```
User ──┬──► Organization 1─1 Wallet
       │        │
       │        ├──1─n Dataset           (metadata only; raw CSVs stay in data/participants/)
       │        ├──1─n Participant ──────┐
       │        ├──1─n Contribution      │ (Participant n─1 Model)
       │        ├──1─n Reward            ▼
       │        ├──1─n PrivacyEvent    Model 1─n ModelVersion  (weights, model_hash)
       │        └──1─n AccessRequest     │ 1
       │                                 ▼
       │                          FederatedRound 1─n TrainingRun
       │                                 │        1─n ModelUpdate  (update_hash, payload)
       │                                 │        1─n Contribution
       │                                 │        1─n Reward
       │                                 ▼
       │                     BlockchainBlock 1─n BlockchainTransaction
       │                                 (hash, prevHash, nonce, PoW)
       ├──► AuditLog (hash-chained: entryHash, prevHash, blockchainTxHash)
       └──► Notification · SystemSetting · DemoRunLog
       MarketplaceListing 1─1 Model, 1─n AccessRequest
```

Key integrity fields: every `ModelUpdate.updateHash`,
`ModelVersion.modelHash`, `Dataset.metadataHash`,
`BlockchainTransaction.hash` and `AuditLog.entryHash` is a real SHA-256
digest (spec §52). Nothing on-chain contains record content.

## 7. Ports table

| Service | Port | Notes |
| --- | --- | --- |
| web (Next.js 16) | **3000** | UI + embedded API + embedded demo engine |
| api (FastAPI) | **8000** | Docker-mode backend; OpenAPI at `/docs` |
| ml-service (PyTorch) | **8001** | training / aggregation / TenSEAL CKKS |
| hardhat node | **8545** | DataVault Local Test Network, chainId **31337** |
| postgres 16 | **5432** | user/pass/db: `datavault` (demo) |
| redis 7 | **6379** | job bus + pub-sub |

## 8. Deployment modes

| | Sandbox mode | Full Docker mode |
| --- | --- | --- |
| Start | `bun run dev` (+ `bun scripts/seed.ts`) | `cp .env.example .env && docker compose up --build` |
| Backend | Next.js embedded API (SQLite) | FastAPI `services/api` (Postgres) + ml-service + hardhat node |
| FL engine | TypeScript MLP engine in-process | PyTorch ml-service |
| Ledger | local hash-chain ledger | `DataVaultRewards.sol` on the Hardhat container / Amoy |
| Frontend wiring | same-origin `/api/*` | `NEXT_PUBLIC_API_URL` (build-time switch) |

## 9. Design decisions worth knowing

- **No fake ML**: every metric shown in the UI comes from real training
  (spec §65). Pacing delays are presentation-only.
- **Honest baselines**: the "before federation" number is a *silo baseline*
  (local-only models cross-evaluated network-wide), not a random weak model.
- **Ledger semantics are mirrored** between the TS local ledger and the
  Solidity contract (REGISTER / RECORD / ALLOCATE / CLAIM), so the product
  story is identical in both modes.
- **Only hashes/proofs go on-chain** (spec §52).
- **Single-process simulation boundary** (demo): participant "environments"
  are in-process silos with separate datasets on disk; the mask seed is
  shared. Documented in [docs/PRIVACY.md](./PRIVACY.md) §8.
