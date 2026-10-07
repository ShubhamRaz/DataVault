# DataVault API Reference

DataVault ships **two backends** that implement the same product surface:

| | Embedded API (Next.js) | FastAPI backend (`services/api`) |
|---|---|---|
| Base URL | same-origin `/api/*` (the web app itself) | `http://localhost:8000` (Docker) |
| Auth | JWT (HMAC-SHA256) in an **httpOnly cookie** set by login | JWT **Bearer** token from `/api/v1/auth/login` |
| Database | Prisma + SQLite (embedded demo engine) | Prisma/SQLAlchemy + PostgreSQL |
| FL engine | TypeScript MLP + FedAvg in-process | PyTorch service `services/ml-service` (:8001) |
| Blockchain | local SHA-256 hash-chain ledger | Solidity `DataVaultRewards` on the Hardhat node (:8545) |
| Docs | this file | live OpenAPI at `/docs` + `/openapi.json` |

The web app uses the **embedded API by default** (sandbox mode). Setting
`NEXT_PUBLIC_API_URL` (e.g. `http://localhost:8000`) switches the web frontend
to the FastAPI backend.

> **Research / hackathon demonstration.** All data is synthetic; default
> secrets are demo-grade (see `README.md` → Security notes).

---

## 1. Conventions (embedded Next.js API)

- All responses share a uniform envelope:

  ```json
  { "ok": true,  "data": { … } }
  { "ok": false, "error": "Human-readable message" }
  ```

- Authentication is a signed **httpOnly session cookie** (`dv_session`).
  `POST /api/auth/login` sets it; every authenticated route requires it.
  Private keys / secrets are never exposed to the frontend.
- **RBAC roles**: `ADMIN`, `ORG_ADMIN`, `ML_OPERATOR`, `PARTICIPANT`, `VIEWER`.
  A route's required roles are listed below. Missing/insufficient auth → `401`
  / `403`.
- The first request to any route auto-seeds the demo network if the database
  is empty (`ensureSeeded`).
- Try it live (sandbox):

  ```bash
  # login and store the cookie
  curl -s -c /tmp/dv.jar -X POST http://localhost:3000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@datavault.demo","password":"demo1234"}'
  curl -s -b /tmp/dv.jar http://localhost:3000/api/dashboard/stats | jq .data.kpis
  ```

---

## 2. Authentication

### POST `/api/auth/login`
Public. Rate-limited (12 attempts / minute / IP). Sets the session cookie.
- Request: `{ "email": "admin@datavault.demo", "password": "demo1234" }`
- Response `200`:

  ```json
  { "ok": true, "data": {
      "id": "clx…", "email": "admin@datavault.demo", "name": "Ada Platform",
      "role": "ADMIN", "organizationId": "clx…", "organizationName": "DataVault Research Core"
  }}
  ```

- Response `401`: `{ "ok": false, "error": "Invalid email or password" }`
  (failed attempts are written to the audit log).

### POST `/api/auth/register`
Public. Creates a user (optionally joining an org by slug).
- Request:

  ```json
  { "email": "new.user@example.com", "name": "New User",
    "password": "demo1234", "role": "ML_OPERATOR", "organizationSlug": "hospital-a" }
  ```

- Response `201`: same user object as login (session cookie is set).

### POST `/api/auth/logout`
Auth. Clears the session cookie → `{ "ok": true, "data": { "loggedOut": true } }`

### GET `/api/auth/me`
Returns the session user or `null` (no error when anonymous).

---

## 3. Dashboard

### GET `/api/dashboard/stats` — *all roles*
The global dashboard payload (KPIs, model progression series, contribution
per org, rewards per round, privacy counters, activity feed).

```json
{ "ok": true, "data": {
  "kpis": {
    "organizations": 10, "activeModels": 3, "federationRounds": 16,
    "encryptedUpdates": 0, "totalContributions": 48, "rewardsDistributed": 16000,
    "privacyEvents": 68, "modelAccuracy": 0.8897, "participants": 9,
    "blocks": 17, "transactions": 102, "listings": 3
  },
  "modelProgression": [{
    "modelId": "clx…", "name": "Cancer Risk Prediction", "taskType": "CLASSIFICATION",
    "industry": "Healthcare", "baseline": 0.8362, "current": 0.8897,
    "version": "v1.9", "series": [{ "round": 1, "value": 0.851 }]
  }],
  "contributionByOrg": [{ "org": "Apollo Demo Hospital", "industry": "Healthcare",
                          "lifetimeScore": 2.71, "rewards": 5230.4 }],
  "rewardsPerRound":   [{ "round": "#7", "model": "Cancer Risk Prediction",
                          "total": 1000, "improvement": 0.008, "encryptedUpdates": 0 }],
  "privacyByType": { "UPDATE_ENCRYPTED": 48, "SECURE_AGGREGATION": 16, "RAW_ACCESS_BLOCKED": 4 },
  "activity": [{ "date": "2026-10-07", "rounds": 16, "updates": 48 }],
  "demo": { "label": "Raw data shared", "rawDataSharedBytes": 0 }
}}
```

---

## 4. Organizations

### GET `/api/organizations?industry=&status=&verification=&search=&take=` — *all roles*
List organizations (with wallet + dataset summary per org).
### POST `/api/organizations` — *ADMIN*
- Request:

  ```json
  { "name": "Sunrise Demo Clinic", "type": "Hospital", "industry": "Healthcare",
    "location": "Pune, IN", "domain": "HEALTHCARE", "description": "…" }
  ```

- Response `201`: created org with derived wallet address.
### GET `/api/organizations/[id]` — *all roles*
Detail: datasets, models the org participates in, contributions, rewards,
privacy events, audit trail.
### PATCH `/api/organizations/[id]` — *ADMIN*
Approve/suspend/verify: `{ "status": "ACTIVE", "verification": "VERIFIED" }`

---

## 5. Datasets (metadata only — raw data stays local)

### GET `/api/datasets?domain=&status=&classification=&q=` — *all roles*
Dataset registry: name, owner, domain, `sampleCount`, `featureCount`,
`privacyClassification` (`RESTRICTED | CONFIDENTIAL | INTERNAL`),
`storagePath` (participant-local), `metadataHash` — **never record content**.

### POST `/api/datasets` — *ADMIN, ML_OPERATOR*
Generates a NEW synthetic dataset inside a participant environment.
- Request: `{ "organizationSlug": "hospital-a", "samples": 900 }`
- Response `201`: `{ "dataset": { … }, "sampleCount": 900, "localPath": "data/participants/hospital-a/" }`

### GET `/api/datasets/[id]/raw` — *all roles* — **the privacy guard**
Raw record download is **always blocked** (spec §2/§34). Every attempt is
logged as a `RAW_ACCESS_BLOCKED` privacy event + audit entry.
- Response `200` (yes — the guard answers 200 with `blocked: true`):

  ```json
  { "ok": true, "data": {
    "blocked": true,
    "reason": "RAW DATA ACCESS DENIED",
    "policy": "DataVault privacy architecture: raw records never leave the data owner's environment.",
    "dataset": { "id": "clx…", "name": "Apollo Synthetic Oncology Records",
                 "owner": "Apollo Demo Hospital", "status": "ENCRYPTED_UPDATES_ONLY" },
    "whatIsShared": {
      "rawRecords": "NOT SHARED — 0 bytes ever transferred",
      "modelUpdates": "SHARED — privacy-protected (masked + encrypted) only",
      "metadata": "SHARED — sample counts, feature names, hashes (no record content)"
    }
  }}
  ```

---

## 6. Models (registry)

### GET `/api/models?industry=&status=&taskType=&q=` — *all roles*
- Response (abridged):

  ```json
  { "ok": true, "data": { "models": [{
    "id": "clx…", "name": "Cancer Risk Prediction", "slug": "cancer-risk",
    "useCase": "Binary classification of elevated cancer risk from synthetic biomarkers",
    "industry": "Healthcare", "taskType": "CLASSIFICATION",
    "framework": "Custom MLP (TS engine) / PyTorch (ml-service)",
    "status": "ACTIVE", "privacyMode": "DEMO", "version": "v1.9",
    "accuracyBefore": 0.8362, "accuracyAfter": 0.8897,
    "participants": ["Apollo Demo Hospital", "AIIMS Demo Center", "Max Demo Research Lab"],
    "participantCount": 3, "trainingRounds": 7, "versionCount": 9,
    "modelHash": "0x9f3c…", "listing": { "id": "clx…", "price": 0, "status": "ACTIVE" }
  }]}}
  ```

### POST `/api/models` — *ADMIN, ML_OPERATOR*
Creates a global model (v1.0 random init + federated standardizer) and
computes the **silo baseline** (each participant trains a local-only model,
cross-evaluated across the network — the honest "before federation" number).
- Request:

  ```json
  { "name": "Diabetic Retinopathy Screener", "useCase": "Binary classification from synthetic retinal features",
    "industry": "Healthcare", "taskType": "CLASSIFICATION", "description": "…",
    "participantOrgIds": ["clx…", "clx…", "clx…"] }
  ```

- Response `201`:

  ```json
  { "ok": true, "data": { "model": {
      "id": "clx…", "name": "Diabetic Retinopathy Screener", "version": "v1.0",
      "baseline": 0.7912,
      "siloDetail": [{ "organization": "Apollo Demo Hospital", "localAccuracy": 0.84, "crossAccuracy": 0.78 }],
      "modelHash": "0x…", "blockNumber": 3
  }}}
  ```

- Errors: `400` name/useCase/industry missing, fewer than 2 participants, or a
  participant without a local dataset.

### GET `/api/models/[id]` — *all roles*
Full model detail: version history (per-round metrics + `modelHash`),
participants, rounds, latest metrics, privacy proofs, marketplace listing.

---

## 7. Federation (training)

### GET `/api/federation/status` — *all roles*
Live run state: which models are currently training, active round phases,
participant network snapshot (participants per model + their status).

### GET `/api/federation/rounds?modelId=&status=&take=` — *all roles*
Round history with per-round contributions and rewards.
- Response (abridged):

  ```json
  { "ok": true, "data": { "rounds": [{
    "id": "clx…", "roundNumber": 7, "status": "COMPLETED",
    "model": { "id": "clx…", "name": "Cancer Risk Prediction", "industry": "Healthcare", "taskType": "CLASSIFICATION" },
    "metricsBefore": 0.881, "metricsAfter": 0.8897, "improvement": 0.0087,
    "durationMs": 4123, "encryptedUpdates": 0,
    "config": { "epochs": 5, "batchSize": 32, "lr": 0.1, "privacyMode": "DEMO", "pacingMs": 0 },
    "aggregateMetrics": { "global": { "accuracy": 0.8897, "loss": 0.3021 }, "perParticipant": [ … ] },
    "contributions": [{ "organizationName": "Apollo Demo Hospital", "normalizedScore": 0.37, "sampleCount": 900 }],
    "rewards": [{ "organizationName": "Apollo Demo Hospital", "amount": 371.9, "txHash": "0x…", "status": "AVAILABLE" }]
  }]}}
  ```

### POST `/api/federation/rounds` — *ADMIN, ML_OPERATOR, ORG_ADMIN*
Starts **real** federated training. Progress streams over SSE
(`/api/federation/events`). One round resolves synchronously; `rounds > 1`
returns `202` and streams the whole sequence.
- Request:

  ```json
  { "modelId": "clx…", "rounds": 1, "epochs": 5, "lr": 0.1,
    "batchSize": 32, "privacyMode": "DEMO", "pacingMs": 420 }
  ```

- Response `200` (single round):

  ```json
  { "ok": true, "data": { "started": true, "rounds": 1,
      "result": { "roundId": "clx…", "status": "COMPLETED",
                  "accuracyBefore": 0.881, "accuracyAfter": 0.8897, "improvement": 0.0087 } } }
  ```

- Response `202` (multi-round): `{ "started": true, "rounds": 3, "modelId": "clx…", "streaming": true }`
- Errors: `400` modelId missing · `404` model not found · `409` a round is
  already running for this model.

### GET `/api/federation/rounds/[id]` — *all roles*
Full round detail: training runs, model updates (hash, size, norm, encrypted
flag, metrics), contributions, rewards, privacy events, blockchain proofs.

### GET `/api/federation/events` — *public SSE stream*
Server-Sent Events stream of the federation event bus. The client connects
with `EventSource`; the stream replays the last 30 events, sends a heartbeat
comment every 15 s and auto-closes after 10 minutes.
- Event payloads (one `data:` line per event):

  ```json
  { "type": "PARTICIPANT_TRAINING", "roundId": "clx…", "modelId": "clx…",
    "modelName": "Cancer Risk Prediction", "roundNumber": 8,
    "participantId": "clx…", "participantName": "Apollo Demo Hospital",
    "progress": 62, "message": "Apollo Demo Hospital: local training 62% (epoch 3/5, loss 0.3124)",
    "timestamp": "2026-10-07T12:00:00.000Z" }
  ```

- Event types: `STREAM_CONNECTED`, `ROUND_STARTED`, `MODEL_DISTRIBUTED`,
  `PARTICIPANT_TRAINING`, `LOCAL_UPDATE_GENERATED`, `UPDATE_ENCRYPTED`,
  `UPDATE_SUBMITTED`, `SECURE_AGGREGATION`, `GLOBAL_MODEL_UPDATED`,
  `REWARD_CALCULATED`, `BLOCKCHAIN_RECORDED`, `ROUND_COMPLETED`, `ROUND_FAILED`.

---

## 8. Privacy

### GET `/api/privacy/status` — *all roles*
The privacy posture (spec §34):

```json
{ "ok": true, "data": {
  "status": {
    "raw_data_shared": false, "encrypted_updates": false,
    "secure_aggregation": true, "model_update_only": true,
    "audit_logging": true, "mode": "DEMO"
  },
  "counters": { "rawDataSharedBytes": 0, "dataOwners": 9, "modelUpdates": 48,
                "encryptedUpdates": 0, "privacyEvents": 68 },
  "layers": {
    "federatedLearning": { "name": "Layer 1 — Federated Learning", "…": "…" },
    "privacyComputing":  { "name": "Layer 2 — Privacy Computing", "mode": "DEMO", "…": "…" },
    "blockchain":        { "name": "Layer 3 — Blockchain Incentives", "network": "DataVault Local Test Network (chain 31337)", "…": "…" }
  },
  "latestRoundId": "clx…",
  "disclaimer": "DataVault is a research and hackathon demonstration. It is not legal or regulatory compliance advice. Production deployments must undergo organization-specific privacy, security, legal, and regulatory review."
}}
```

### GET `/api/privacy/events?type=&roundId=&organizationId=&take=` — *all roles*
Filterable privacy event log (`UPDATE_ENCRYPTED`, `SECURE_AGGREGATION`,
`RAW_ACCESS_BLOCKED`, `POLICY_APPLIED`, …).

---

## 9. Contributions & rewards

### GET `/api/contributions?organizationId=&roundId=&take=` — *all roles*
The transparent contribution ledger (spec §36): raw/normalized score, sample
share, quality/improvement/participation sub-scores, lifetime score per org.

### GET `/api/rewards?organizationId=&status=&q=` — *all roles*
Reward history + per-org wallet summary + the formula (shown in the UI):

```json
{ "ok": true, "data": {
  "rewards": [{ "id": "clx…", "round": "#7", "model": "Cancer Risk Prediction",
    "organization": "Apollo Demo Hospital", "contribution": 0.37, "reward": 371.9,
    "txHash": "0x…", "status": "AVAILABLE", "roundAccuracy": 0.8897,
    "walletAddress": "0x…", "createdAt": "2026-10-07T…" }],
  "wallets": [{ "address": "0x…", "organization": "Apollo Demo Hospital",
    "balance": 1200.5, "pending": 4030.9, "claimed": 1200.5, "totalEarned": 5231.4 }],
  "totals": { "totalEarned": 16000, "available": 16000, "claimed": 0, "poolPerRound": 1000 },
  "rewardFormula": {
    "pool": "ROUND_REWARD_POOL = 1000 DATA per round",
    "formula": "participant_reward = pool × normalized_contribution_score",
    "contribution": "raw = 0.35·sample_share + 0.25·quality + 0.25·improvement + 0.15·participation; normalized = raw / Σ raw"
  }
}}
```

### POST `/api/rewards/claim` — *ADMIN, ORG_ADMIN, PARTICIPANT*
Claims all `AVAILABLE` rewards of an organization to its wallet balance and
writes `CLAIM_REWARD` transactions to the ledger.
- Request: `{ "organizationId": "clx…" }` (optional `rewardIds: [...]`;
  defaults to the caller's org)
- Response `200`: `{ "claimed": 4, "total": 483.2, "blockNumber": 12, "txHashes": ["0x…", "…"] }`
- Errors: `403` claiming for another org · `404` wallet not found · `400` nothing available.

---

## 10. Blockchain (local test network explorer)

### GET `/api/blockchain/overview` — *all roles*
- Response:

  ```json
  { "ok": true, "data": {
    "network": "DataVault Local Test Network", "chainId": 31337,
    "blocks": 17, "transactions": 102, "rewardTransactions": 96,
    "contributionProofs": 48, "latestBlock": 17, "latestBlockHash": "0x…",
    "consensus": "PoW (difficulty 3, hash-chained ledger)",
    "recentBlocks": [ … ]
  }}
  ```

### GET `/api/blockchain/transactions?action=&roundNumber=&participant=&q=&take=` — *all roles*
Filterable transaction table. Actions: `REGISTER_PARTICIPANT`,
`RECORD_CONTRIBUTION`, `ALLOCATE_REWARD`, `CLAIM_REWARD`, `RECORD_PROOF`.

### GET `/api/blockchain/verify` — *all roles*
Full chain re-verification (recomputes every block hash + link) plus the audit
chain: `{ "chain": { "valid": true, "blocks": 17, "checkedAt": "…" }, "audit": { "valid": true, "entries": 214 } }`

---

## 11. Audit log

### GET `/api/audit?q=&eventType=&status=&take=` — *all roles*
Searchable, hash-chained audit trail (spec §21): actor, role, organization,
event type (`USER_LOGIN`, `ROUND_STARTED`, `UPDATE_SUBMITTED`,
`RAW_ACCESS_BLOCKED`, `REWARD_CLAIMED`, `DEMO_INITIALIZED`, …), entry hash +
prev-hash for tamper evidence.

---

## 12. Marketplace

### GET `/api/marketplace?industry=&privacyMethod=&accessPolicy=&q=` — *public-friendly, all roles*
Privacy-first listings (models & collaboration opportunities — **never raw
datasets**). Each listing: title, description, use case, industry,
performance, `privacyMethod` (`FEDERATED_AVERAGING | SECURE_AGGREGATION |
HE + SECURE_AGG`), training rounds, price in DATA, access policy, participating
orgs.

### POST `/api/marketplace` — *ADMIN, ML_OPERATOR*
Publish a listing for a federated model: `{ "modelId": "clx…", "title": "…", "description": "…", "price": 0, "accessPolicy": "REQUEST_ACCESS" }`

### GET `/api/marketplace/[id]` — *all roles*
Listing detail + access requests.

### POST `/api/marketplace/[id]/access-requests` — *all roles*
Request collaboration access:
`{ "message": "We'd like to join the next training round" }` →
`{ "request": { "status": "PENDING", "…": "…" } }`

---

## 13. Notifications

### GET `/api/notifications` — *all roles*
`{ "notifications": [ { "type": "ROUND_COMPLETED", "title": "Federated Round #8 completed", "message": "…", "read": false, "createdAt": "…" } ], "unread": 3 }`

### POST `/api/notifications`
Mark read: `{ "ids": ["clx…"] }` or `{ "all": true }`

---

## 14. Admin

### GET/POST `/api/admin/demo` — *ADMIN*
Demo Controls (spec §56) — real backend actions:
- `POST { "action": "initialize" }` → full demo network init (9 orgs, 10 users,
  9 synthetic datasets, 3 models, **real** historical federation rounds,
  wallets, local blockchain genesis). Takes ~1–2 min.
- `POST { "action": "reset" }` → wipe all demo data (DB + participant folders).
- `POST { "action": "regenerate" }` → regenerate missing synthetic datasets.
- `GET` → demo state: `{ "initialized": true, "counts": { "organizations": 10, "users": 10, "datasets": 9, "models": 3, "rounds": 16, "rewards": 48, "blocks": 17 }, "runLogs": [ … ] }`

### GET/PATCH `/api/admin/settings` — *ADMIN*
System settings: privacy mode (`DEMO | ENCRYPTION`), round reward pool, etc.
`PATCH { "privacy_mode": "ENCRYPTION" }`

### GET `/api/admin/users` — *ADMIN*
User management: all users with role, org, last login.

### GET `/api/admin/export` — *ADMIN*
Exportable self-contained **HTML demo report** (spec §57) with real computed
data (models, rounds, baselines, rewards, chain + audit verification).
Content-Type: `text/html`.

---

## 15. FastAPI backend (`services/api`, port 8000)

The Docker-mode backend (`services/api`, built by the services agent) exposes
a versioned REST surface that mirrors the embedded API plus service-level
endpoints. **Live, interactive OpenAPI docs are served by FastAPI at
`http://localhost:8000/docs`** (`/openapi.json` for the schema).

Auth: `POST /api/v1/auth/login` with JSON credentials returns a JWT; send it
as `Authorization: Bearer <token>` on every call. Same RBAC roles as above.

| Method & path | Roles | Description |
| --- | --- | --- |
| `GET /health` | public | Liveness + dependency status (postgres, redis, ml-service, hardhat) |
| `GET /docs`, `GET /openapi.json` | public | OpenAPI UI + schema |
| `POST /api/v1/auth/login` | public | JWT login (demo users from `README.md`) |
| `POST /api/v1/auth/register` | public | Create user |
| `GET /api/v1/users/me` | any | Session user |
| `GET /api/v1/organizations` / `POST` / `GET /{id}` / `PATCH /{id}` | all / ADMIN | Org registry + approval (same filters as embedded API) |
| `GET /api/v1/datasets` / `POST` | all / ADMIN,ML_OPERATOR | Dataset metadata registry (raw data stays with owners) |
| `GET /api/v1/datasets/{id}/raw` | all | Privacy guard — always `403 RAW_ACCESS_BLOCKED` + audit entry |
| `GET /api/v1/models` / `POST` / `GET /{id}` | all / ADMIN,ML_OPERATOR | Model registry + silo baselines |
| `GET /api/v1/federation/rounds` / `POST` | all / ADMIN,ML_OPERATOR,ORG_ADMIN | Round history / start rounds (jobs to ml-service via redis) |
| `GET /api/v1/federation/rounds/{id}` | all | Round detail (runs, updates, rewards, proofs) |
| `GET /api/v1/federation/rounds/{id}/status` | all | Live round status + phase |
| `GET /api/v1/federation/events` | all | SSE stream of federation events (same event types as §7) |
| `GET /api/v1/privacy/status` / `GET /api/v1/privacy/events` | all | Privacy posture + event log |
| `GET /api/v1/contributions` | all | Contribution ledger |
| `GET /api/v1/rewards` | all | Reward history + wallet summaries |
| `POST /api/v1/rewards/claim` | ADMIN,ORG_ADMIN,PARTICIPANT | Claim → `claimReward()` on the DataVaultRewards contract |
| `GET /api/v1/blockchain/transactions` / `GET /api/v1/blockchain/verify` | all | On-chain tx table + `eth_call` verification of proofs |
| `GET /api/v1/marketplace` / `POST` / `GET /{id}` / `POST /{id}/access-requests` | all | Marketplace listings |
| `GET /api/v1/audit` | all | Hash-chained audit log |
| `GET /api/v1/dashboard/stats` | all | Dashboard aggregation |

Representative call:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@datavault.demo","password":"demo1234"}' | jq -r .token)

curl -s http://localhost:8000/api/v1/federation/rounds -H "Authorization: Bearer $TOKEN" | jq .
```

Blockchain wiring (env): `BLOCKCHAIN_RPC_URL=http://hardhat:8545`,
`CHAIN_ID=31337`, `REWARD_CONTRACT_ADDRESS` (empty → deployed at startup),
`BLOCKCHAIN_PRIVATE_KEY` (empty → Hardhat dev account #0, local chain only).

### ML service (`services/ml-service`, port 8001)

Internal service consumed by the api service (not exposed to browsers):

| Method & path | Description |
| --- | --- |
| `GET /health` | Liveness + mode (`ML_MODE=demo\|encryption`) |
| `POST /train` | Local participant training: global weights + config → weight delta, local metrics (PyTorch) |
| `POST /aggregate` | FedAvg aggregation of participant deltas (sample-weighted) |
| `POST /encrypt` / `POST /decrypt` | TenSEAL CKKS encrypt/decrypt of selected update tensors (ENCRYPTION mode) |
| `POST /evaluate` | Evaluate a model version on the caller's local holdout |

Example:

```bash
curl -s -X POST http://localhost:8001/train \
  -H 'Content-Type: application/json' \
  -d '{"model":"cancer-risk","round":9,"epochs":5,"lr":0.1,"batchSize":32,
       "globalWeights":"<serialized tensor bundle>"}' | jq .
```

---

## 16. Error handling

- Uniform envelope everywhere: `{ "ok": false, "error": "message" }` (embedded)
  / FastAPI `HTTPException` details.
- Typical statuses: `400` validation · `401` not authenticated · `403`
  role/ownership violation · `404` not found · `409` concurrent round ·
  `429` login rate limit · `500` internal (logged server-side).
- All important actions are audit-logged (hash-chained); privacy-sensitive
  denials also create privacy events.
