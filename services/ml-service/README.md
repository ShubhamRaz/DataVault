# DataVault ML Service — PyTorch Federated Learning (port 8001)

Real federated training for the DataVault demo network (spec §5 Layer 1/2, §14, §65).
Python 3.11, CPU-only PyTorch. No raw participant data ever leaves
`data/participants/<slug>/`.

## Run

```bash
cd services/ml-service
pip install -r requirements.txt          # torch CPU: add --index-url https://download.pytorch.org/whl/cpu
uvicorn app.main:app --port 8001         # http://localhost:8001/docs
```

Regenerate the 9 synthetic participant datasets (deterministic, seeded):

```bash
python -m app.datasets.generators        # writes ../../data/participants/<slug>/data.csv
# or over HTTP once the service is up:
curl -X POST http://localhost:8001/datasets/regenerate
```

Environment (see `app/config.py`): `DATA_ROOT` (default `../../data/participants`),
`MODELS_DIR`, `EPOCHS=5`, `BATCH_SIZE=32`, `LR=0.1`, `L2=0.0005`,
`PRIVACY_MODE=DEMO|ENCRYPTION` (also `ML_MODE`), `ML_SECRET`.

## Endpoints

| Method | Path                    | Description |
|--------|-------------------------|-------------|
| GET    | `/health`               | liveness + backend report |
| GET    | `/privacy/status`       | LAYER 2 status (raw data NOT shared, update-only, encryption, secure aggregation) |
| GET    | `/federation/models`    | model registry (cancer-risk, fraud-detection, crop-yield) + versions |
| POST   | `/federation/rounds`    | run a REAL federated round → metrics + events |
| POST   | `/datasets/regenerate`  | re-create the 9 synthetic datasets |

### Run a federated round

```bash
curl -X POST http://localhost:8001/federation/rounds \
  -H 'content-type: application/json' \
  -d '{"model":"cancer-risk","roundNumber":1,"config":{"epochs":5,"lr":0.1,"privacyMode":"DEMO"}}'
```

Response: full round report — `metrics` (before/after/improvement, per-participant),
`participants` (updates, hashes, sizes — never raw data), `rewards` (1000 DATA pool),
`blockchain` (PoW-3 block + tx hashes), `events` (the 11 lifecycle event types:
ROUND_STARTED, MODEL_DISTRIBUTED, PARTICIPANT_TRAINING, LOCAL_UPDATE_GENERATED,
UPDATE_ENCRYPTED, UPDATE_SUBMITTED, SECURE_AGGREGATION, GLOBAL_MODEL_UPDATED,
REWARD_CALCULATED, BLOCKCHAIN_RECORDED, ROUND_COMPLETED).

## Round pipeline (all real computation, spec §65)

1. distribute global MLP (input → 16 tanh → 1; sigmoid for classification, linear for regression)
2. each `ParticipantNode` trains locally (mini-batch SGD, 70/15/15 split, seeded shuffle)
3. only weight **deltas** leave the node (+ metrics telemetry)
4. pairwise additive masks (zero-sum) + optional **AES-256-GCM** (`ENCRYPTION` mode)
5. `SecureAggregator` weighted aggregation — masks cancel **exactly** (weight-aware pairwise construction)
6. FedAvg → new global model → real evaluation (accuracy/precision/recall/F1/ROC-AUC · MAE/RMSE/R²)
7. contribution scoring + 1000 DATA reward pool
8. PoW-3 hash-chain block with contribution proofs + reward allocations

### TenSEAL / CKKS (spec §64 fallback)

The service runs **without** TenSEAL: `ENCRYPTION` mode uses AES-256-GCM +
additive masking, and `/privacy/status` documents the fallback. If `tenseal`
is importable, `CKKSService` additionally provides homomorphic
encryption/aggregation of update vectors (`app/privacy/encryption.py`, import-guarded).

## Tests

```bash
python -m pytest tests/ -q    # 30 tests: determinism, FedAvg, zero-sum masks,
                              # AES round-trip, metrics known answers, rewards
```

Dataset generators are a byte-exact port of the TypeScript engine
(`src/server/synthetic-data.ts`) — all 9 dataset metadata hashes match the TS
engine for the same seeds (verified in `tests/test_engine.py`).
