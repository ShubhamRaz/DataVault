# DataVault API Gateway — FastAPI (port 8000)

Metadata, auth, rewards, proofs and the audit chain for the DataVault
marketplace (spec §24). Federated compute is delegated to the PyTorch
ml-service (`ML_SERVICE_URL`, default `http://localhost:8001`).

## Run

```bash
cd services/api
pip install -r requirements.txt
# PostgreSQL (Docker mode):
DATABASE_URL=postgresql://datavault:datavault@localhost:5432/datavault \
ML_SERVICE_URL=http://localhost:8001 \
uvicorn app.main:app --port 8000          # http://localhost:8000/docs
# local dev fallback (no Postgres needed, spec §64):
DATABASE_URL=sqlite:////tmp/datavault-api.db uvicorn app.main:app --port 8000
```

Startup creates the schema and (when empty) seeds the demo network:
10 organizations, 10 demo users (password `demo1234`, e.g.
`admin@datavault.demo`), wallets, dataset metadata, 3 models + participants.

Environment (see `app/config.py`): `DATABASE_URL`, `JWT_SECRET`,
`JWT_EXPIRES_HOURS=24`, `ML_SERVICE_URL`, `SEED_DEMO=true`,
`ROUND_REWARD_POOL=1000`, `BLOCKCHAIN_RPC_URL` (optional Hardhat node).

## Endpoints

| Group | Routes | Notes |
|-------|--------|-------|
| auth | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` | JWT HS256, scrypt hashing, RBAC |
| organizations | `GET/POST /api/organizations`, `GET /api/organizations/{id}` | create = ADMIN |
| models | `GET/POST /api/models`, `GET /api/models/{id}` | create (ML_OPERATOR+) validates against the ml-service registry |
| federation | `POST /api/federation/rounds`, `GET /api/federation/rounds[/{id}]` | POST proxies a real round to the ml-service and persists updates, contributions, rewards, blockchain txs + audit |
| privacy | `GET /api/privacy/status` | LAYER 2 status + gateway telemetry |
| rewards | `GET /api/rewards`, `POST /api/rewards/claim` | claim guards ownership; double-claim → 409 |
| blockchain | `GET /api/blockchain/transactions` | proofs from the PoW-3 hash chain |
| audit | `GET /api/audit?verify=true` | hash-chained log + integrity verification |
| dashboard | `GET /api/dashboard/stats` | platform KPIs |

Roles (RBAC): `ADMIN > ORG_ADMIN > ML_OPERATOR > PARTICIPANT > VIEWER`.
Starting a round requires `ML_OPERATOR` or higher.

### End-to-end example

```bash
TOKEN=$(curl -s -X POST localhost:8000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@datavault.demo","password":"demo1234"}' | jq -r .token)

curl -X POST localhost:8000/api/federation/rounds \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"model":"cancer-risk","config":{"privacyMode":"ENCRYPTION"}}'

curl "localhost:8000/api/federation/rounds" | jq .
curl "localhost:8000/api/audit?verify=true" | jq .chain
```

Reward engine (spec §36/§37): `raw = 0.35·sample_share + 0.25·quality +
0.25·improvement + 0.15·participation`, normalized across participants;
`reward = 1000 DATA × normalized` (2 dp) — same formula as the TS engine and
the ml-service.

Audit chain: every entry hashes `prevHash :: JSON-stable payload`
`{actor, eventType, resource|null, status, metadata, ts}` (sorted keys,
compact separators) → tamper-evident trail, `?verify=true` recomputes it.

## Tests

```bash
python -m pytest tests/ -q    # 14 tests: reward split 0.45/0.30/0.25 → 450/300/250,
                              # scrypt round-trip, JWT signature/expiry, RBAC order
```
