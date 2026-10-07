# DataVault — Federated Learning Engine

> Everything in this document is **real computation** (spec §65): the metrics
> shown in the UI are produced by actual gradient descent on actual synthetic
> datasets. Pacing delays during the live demo are presentation-only.

## 1. Model architecture (custom MLP)

A compact multilayer perceptron, hand-written in TypeScript
(`src/server/ml/mlp.ts`) — no ML framework needed, deterministic, and fast
enough to train inside a browser demo round-trip:

```
input (d) ──► hidden (16, tanh) ──► output (1, sigmoid | linear)
```

| Domain | Input features `d` | Parameters | Output |
| --- | --- | --- | --- |
| Healthcare (cancer risk) | 12 | 12·16 + 16 + 16 + 1 = **229** | sigmoid → P(risk) |
| Finance (card fraud) | 8 | 8·16 + 16 + 16 + 1 = **161** | sigmoid → P(fraud) |
| Agriculture (crop yield) | 7 | 7·16 + 16 + 16 + 1 = **145** | linear → t/ha |

- **Init**: Xavier-style scaled uniform, seeded PRNG (deterministic per seed).
- **Standardization**: a *federated standardizer* — sample-weighted average of
  each participant's local feature statistics (metadata only, never raw
  records) — so all silos share one input scale.
- **Training**: mini-batch SGD with deterministic shuffling, per-epoch loss
  logging; defaults `epochs=5, batchSize=32, lr=0.1, L2=5e-4`.
- **Losses**: binary cross-entropy (classification) / MSE (regression).
- **Metrics** (`src/server/ml/metrics.ts`): accuracy, precision, recall, F1,
  ROC-AUC (Mann-Whitney U with tie handling), confusion matrix + BCE loss for
  classification; MAE, RMSE, R² for regression.

The Docker-mode `services/ml-service` implements the same architecture in
**PyTorch** (plus TenSEAL CKKS for encryption mode) — the TS engine is the
sandbox twin of that service.

## 2. FedAvg math (sample-weighted)

Per round, participant `i` computes its **update** (weight delta):

```
Δᵢ = wᵢ_local − w_global              (only Δᵢ ever leaves the silo,
                                         masked + optionally AES-256-GCM sealed)
```

The secure aggregator combines the *masked* deltas — masks sum to zero
(see [PRIVACY.md](./PRIVACY.md)) — with sample-weighted federated averaging:

```
Δ_agg = Σᵢ (nᵢ / Σⱼ nⱼ) · Δᵢ           (nᵢ = participant i's local train size)
w_new = w_global + Δ_agg                 → new global version v1.<round>
```

The new global model is then evaluated **at every participant** on its local
test split (metrics only — no data moves), and the network-weighted average
becomes the official round metric:

```
metric_global = Σᵢ (nᵢ_test / Σⱼ nⱼ_test) · metricᵢ
```

## 3. Non-IID synthetic data design

Raw demo data is **100% synthetic** (`src/server/synthetic-data.ts`) with a
generative ground-truth signal per domain plus *deliberate per-participant
distribution shift* — the whole reason federation beats silos:

```ts
bias: { featureShifts: number[], classPriorShift: number, noise: number }
```

- **`featureShifts`** — each feature is shifted by a per-silo offset (e.g.
  hospital-a sees older/heavier populations, hospital-b younger/lighter).
- **`classPriorShift`** — the positive-class prevalence differs per silo
  (e.g. hospital-a 0.42 vs hospital-b −0.38 around the base rate).
- **`noise`** — per-silo label/measurement noise level (0.22–0.36).
- **Seeded PRNG (mulberry32)** per participant → fully deterministic runs.

Each participant's dataset is split **70% train / 15% val / 15% test** and
persisted as a CSV *only inside the participant's own environment*
(`data/participants/<slug>/data.csv` — never in a central store).

| Participant | Samples | Shift profile (abridged) |
| --- | --- | --- |
| hospital-a | 900 | age +12, tumor_size +0.6, prior +0.42, noise 0.26 |
| hospital-b | 650 | age −6, glucose −18, prior −0.38, noise 0.34 |
| hospital-c | 1100 | mild shifts, prior +0.08, noise 0.22 |
| bank-a | 1400 | amount +180, prior +0.20, noise 0.30 |
| bank-b | 1000 | amount −220, prior −0.30, noise 0.36 |
| bank-c | 1200 | mild shifts, prior +0.05, noise 0.27 |
| farm-a | 800 | rainfall +150, fertilizer +15, noise 0.32 |
| farm-b | 700 | rainfall −180, prior −0.12, noise 0.35 |
| farm-c | 950 | mild shifts, noise 0.28 |

## 4. Silo baseline vs federated results

The **silo baseline** (computed at model creation, `model-init.ts`) is the
honest "before federation" number: each participant trains a local-only model
(25 epochs on its own train split), and those models are **cross-evaluated on
every participant's test set** — i.e. how well would isolated models serve the
whole network? The network-average cross-accuracy is the baseline.

Numbers as measured in the sandbox seed (deterministic; your run may differ
by tiny amounts):

| Model | Silo baseline | After federation (rounds) | Federated gain |
| --- | --- | --- | --- |
| Cancer Risk Prediction (hospitals) | **83.6%** accuracy (0.8362) | **89.0%** accuracy (0.8897, v1.9, 7 rounds) | **+5.4 pts** |
| Card Fraud Detection (banks) | **90.8%** accuracy (0.9082) | **91.5%** accuracy (0.9150, v1.4, 4 rounds) | **+0.7 pts** |
| Crop Yield Prediction (farms) | **R² 0.65** (0.6533) | **R² 0.69** (0.6922, v1.5, 5 rounds) | **+0.04 R²** |

Reading: the headline story — *"three hospitals that cannot share a single
patient record jointly lift cancer-risk accuracy from 83.6% to 89.0%"* — is
backed by real training runs, and the deltas are visible round-by-round on
the dashboard (`modelProgression` series). Fraud starts high (balanced,
well-specified synthetic signal) so the federated gain is smaller; crop-yield
R² shows the regression path. Each completed round re-evaluates the global
model across all participant test splits — the per-round progression is the
curve on the dashboard.

## 5. Round configuration

`POST /api/federation/rounds` accepts:

| Field | Default | Range | Meaning |
| --- | --- | --- | --- |
| `rounds` | 1 | 1–10 | consecutive rounds (multi-round → `202` + SSE stream) |
| `epochs` | 5 | 1–30 | local SGD epochs per participant |
| `batchSize` | 32 | 8–256 | mini-batch size |
| `lr` | 0.1 | 0.001–1 | learning rate |
| `privacyMode` | `DEMO` | DEMO / ENCRYPTION | masking only / masking + AES-256-GCM |
| `pacingMs` | 420 | 0–2000 | presentation pacing between phases |

A per-model run lock (`409` on conflict) prevents concurrent rounds.

## 6. Round event lifecycle

One round executes this exact sequence (every transition comes from real
backend computation; all events stream over SSE at
`GET /api/federation/events`):

```
ROUND_STARTED
  └─ MODEL_DISTRIBUTED            global v1.N → all participants
       └─ per participant:
            PARTICIPANT_TRAINING  (progress 5→98, per-epoch loss)
            LOCAL_UPDATE_GENERATED (Δᵢ, ‖Δ‖, samples, local metrics)
            UPDATE_ENCRYPTED      (mask [+ GCM], updateHash proof)
            UPDATE_SUBMITTED      (ModelUpdate row + privacy event + audit)
       └─ SECURE_AGGREGATION      (masks cancel — only the aggregate is visible)
       └─ GLOBAL_MODEL_UPDATED    (v1.N+1, model_hash, real metrics)
       └─ REWARD_CALCULATED       (scores → 1000 DATA pool split)
       └─ BLOCKCHAIN_RECORDED     (contribution proofs + reward txs mined)
ROUND_COMPLETED (or ROUND_FAILED with error + audit entry)
```

## 7. Where the engines live

| Concern | Sandbox (TS engine) | Docker mode |
| --- | --- | --- |
| Local training | `src/server/ml/mlp.ts` (`trainLocal`, in-process) | `services/ml-service` `POST /train` (PyTorch) |
| Aggregation | `fedAvg()` in `mlp.ts` | `services/ml-service` `POST /aggregate` |
| Orchestration | `src/server/federation/orchestrator.ts` | `services/api` + redis job bus |
| Metrics | `src/server/ml/metrics.ts` | ml-service `/evaluate` |
| Encryption mode | AES-256-GCM over masked vector (`privacy-engine.ts`) | TenSEAL **CKKS** on selected tensors |

## 8. Honest limitations

- Participant "environments" are in-process silos (separate datasets +
  strict API boundary, but one OS process). Production deploys one container
  per organization.
- The MLP is intentionally small (229 params) — the goal is a demo-fast,
  inspectable pipeline, not SOTA accuracy.
- Synthetic ground-truth signals are linear-ish; real-world non-IID data is
  harder. The numbers demonstrate the *mechanism*, not production accuracy.
- Convergence is tuned for 4–7 demo rounds, not for maximal final accuracy.
