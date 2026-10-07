# DataVault — The 10-Minute Hackathon Demo Script

> Practice script. Every number below comes from **real federated training
> runs on 100% synthetic data** — nothing is hardcoded per-screen. Runtime
> figures assume the seeded sandbox (≈1–2 s per round phase).

## 0. One-command setup (before the judges arrive)

**Full Docker mode** (the spec §61 ideal):

```bash
git clone <repo> datavault && cd datavault
cp .env.example .env
docker compose up --build          # web :3000 · api :8000 · ml :8001 ·
                                   # hardhat :8545 · postgres :5432 · redis :6379
```

The `web-seed` one-shot service pushes the schema and runs the real demo
seed (~1–2 min: 3 federated models with genuine historical training rounds).
Then open **http://localhost:3000**.

**Sandbox / preview mode** (no Docker — what the hosted preview runs):

```bash
bun install
bun run db:push            # create the SQLite schema
bun scripts/seed.ts        # real demo network + training history
bun run dev                # → preview panel / localhost:3000
```

> **Sandbox preview notes**: the hosted preview runs the Next.js app in
> **embedded demo engine** mode ("sandbox mode"): the TS federated-learning
> engine, pairwise masking, local hash-chain ledger and SQLite demo data all
> live inside the web app — the Python services, Hardhat node, Postgres and
> Redis of the Docker stack are the production-shaped twins. Use the
> **Preview Panel** next to the code editor (or "Open in New Tab" for a full
> browser window). Seeded logins are below; the first request auto-seeds if
> the database is empty.

**Demo credentials**

| Login | Role | Use during demo |
| --- | --- | --- |
| `admin@datavault.demo` / `demo1234` | ADMIN | main walkthrough (Ada Platform) |
| `alice@apollo.demo` / `demo1234` | ORG_ADMIN (hospital-a) | org view + claim rewards |
| `vikram@hdfc.demo` / `demo1234` | ORG_ADMIN (bank-a) | finance silo perspective |
| `meera@greenvalley.demo` / `demo1234` | ORG_ADMIN (farm-a) | agriculture story |
| `viewer@datavault.demo` / `demo1234` | VIEWER | read-only marketplace viewer |

(All 10 demo users share password `demo1234` — see README "Demo data".)

---

## Minute 0–1 — Login & the story

1. Open **http://localhost:3000** → the landing page: **"Train Together.
   Share Nothing."** Scroll the three-layer diagram (Federated Learning →
   Privacy Computing → Blockchain Incentives).
2. **Login** as `admin@datavault.demo` / `demo1234`.

**Say**: *"Organizations have valuable data they legally cannot share —
hospitals, banks, farm collectives. DataVault lets them co-train AI models
without moving a single raw record. Let me show you the whole loop live."*

## Minute 1–2 — Dashboard tour

3. **Dashboard**: KPIs (organizations, active models, federation rounds,
   protected updates, rewards distributed, privacy events), the model
   progression charts — point at **Cancer Risk: 83.6% → 89.0%** (baseline vs
   current), fraud **90.8% → 91.5%**, crop **R² 0.65 → 0.69**.
   *"These curves are real training telemetry: 3 hospitals that never
   exchanged a patient record."*
4. Show the live **raw data shared: 0 bytes** widget.

## Minute 2–3 — Initialize Demo Network (the reset-proof beat)

5. **Admin & Demo Controls** → **Initialize Demo Network**. The backend
   wipes and rebuilds the whole demo network: 10 organizations, 10 users,
   9 synthetic datasets (written *only* into each
   `data/participants/<slug>/` folder), 3 federated models with silo
   baselines, and **real historical federation rounds**. (~1–2 min —
   narrate the console-style progress; alternatively pre-seed and show this
   only if judges ask for the reset).

## Minute 3–5 — Run a Federated Round (the centerpiece)

6. **Federation** → pick **Cancer Risk Prediction** → defaults
   (epochs 5, batch 32, lr 0.1) → **Start Federated Round**.
7. Watch the **live event stream** (SSE) walk through the real pipeline:

   - `MODEL_DISTRIBUTED` → v1.9 to 3 participants
   - `PARTICIPANT_TRAINING` → Apollo 62% (epoch 3/5, loss 0.31…) — real SGD
   - `LOCAL_UPDATE_GENERATED` → weight deltas, ‖Δ‖
   - `UPDATE_ENCRYPTED` → masked (+ GCM in ENCRYPTION mode), SHA-256 proof
   - `UPDATE_SUBMITTED` → only protected updates travel
   - `SECURE_AGGREGATION` → *masks cancel — individual updates never visible*
   - `GLOBAL_MODEL_UPDATED` → v1.20, accuracy before → after
   - `REWARD_CALCULATED` → e.g. 371.9 / 322.4 / 305.7 DATA
   - `BLOCKCHAIN_RECORDED` → block #N mined with 6 transactions
   - `ROUND_COMPLETED`

**Say**: *"Raw CSVs never left the participant folders; the aggregator only
ever saw masked vectors; the new global model is evaluated back at each
hospital — metrics only."*

Tip: flip **Privacy Mode → ENCRYPTION** (round config) to show real
AES-256-GCM sealed payloads.

## Minute 5–6 — Privacy Center

8. **Privacy Center**: the posture card —
   `raw_data_shared: false · model_update_only: true ·
   secure_aggregation: true · mode: DEMO|ENCRYPTION`, the three layers,
   `rawDataSharedBytes: 0`.
9. **Datasets** → any hospital dataset → **Attempt raw access** → the guard
   fires: `RAW_ACCESS_BLOCKED`, a new privacy event + BLOCKED audit entry
   appear live. *"Even the platform admin cannot pull raw rows — and every
   attempt is evidence."*

## Minute 6–7 — Blockchain verify

10. **Blockchain**: the local test network explorer — blocks, PoW (difficulty
    3), transaction table filtered by `RECORD_CONTRIBUTION` /
    `ALLOCATE_REWARD` / `CLAIM_REWARD`. Click the round's block to see the
    contribution proofs (update hashes).
11. Hit **Verify Chain** → full re-verification: every block hash + prev-link
    recomputed → **valid**. *"Tamper-evident by construction — change one
    transaction and verification breaks at that block."*

## Minute 7–8 — Rewards & claim

12. **Rewards**: the transparent formula card —
    `raw = 0.35·sample_share + 0.25·quality + 0.25·improvement + 0.15·participation`,
    `reward = 1000 DATA × normalized score` — then the per-org wallet table
    (pending / claimed / total earned).
13. Log out → log in as **`alice@apollo.demo`** (ORG_ADMIN, hospital-a) →
    **Rewards** → **Claim rewards** → wallet pending → balance, a
    `CLAIM_REWARD` transaction mined into a new block, tx hash attached.

## Minute 8–9 — Marketplace

14. Log back in as admin (or use `viewer@datavault.demo`).
15. **Marketplace**: listings are **models and collaboration opportunities —
    never raw datasets**. Open "Cancer Risk Prediction": privacy method
    (FEDERATED_AVERAGING / SECURE_AGGREGATION / HE + SECURE_AGG),
    performance, participating orgs, access policy.
16. **Request access** as an outsider org → PENDING request (appears in the
    org admin's queue).

## Minute 9–10 — Admin export & reset

17. **Admin & Demo Controls** → **Export Demo Report** → self-contained HTML
    report with the real numbers, chain + audit verification stamps
    (spec §57). Open it — it's designed to be dropped in a slide.
18. *(Only if time/asked)* **Reset Demo** → wipes DB + participant folders,
    proving nothing is hardcoded.

**Closing line**: *"Cancer risk accuracy up 5.4 points, zero patient
records shared, every contribution provable, every reward on-chain. Train
together, share nothing. DataVault is a research demonstration — production
needs per-org deployments, DH-based masking, and CKKS everywhere — the
architecture is already wired for it."*

---

## Cheat sheet

| Beat | Where | What to click |
| --- | --- | --- |
| Login | `/#/auth` | admin@datavault.demo / demo1234 |
| Dashboard tour | `/#/dashboard` | KPIs + model progression |
| Initialize network | `/#/admin` | Initialize Demo Network |
| Federated round | `/#/federation` | pick model → Start Federated Round |
| Privacy proof | `/#/privacy` + `/#/datasets` | posture card; Attempt raw access |
| Chain verify | `/#/blockchain` | Verify Chain |
| Claim rewards | `/#/rewards` (as alice@apollo.demo) | Claim rewards |
| Marketplace | `/#/marketplace` | listing → Request access |
| Export report | `/#/admin` | Export Demo Report |
| Reset | `/#/admin` | Reset Demo |

## If something breaks (recovery table)

| Symptom | Fix |
| --- | --- |
| Empty dashboards | Admin → Initialize Demo Network (auto-seeds on first request otherwise) |
| "A federation round is already running" (409) | wait ~10 s (run lock) or refresh federation status |
| SSE stream idle | refresh the page (EventSource reconnects; stream auto-closes after 10 min) |
| Login rate limited (429) | wait 60 s (12 attempts/min) or another demo user |
| Full reset | Admin → Reset Demo → Initialize Demo Network, or `bun scripts/seed.ts reset` |

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — what's under the hood
- [PRIVACY.md](./PRIVACY.md) — masking math + the RAW_ACCESS_BLOCKED guard
- [BLOCKCHAIN.md](./BLOCKCHAIN.md) — ledger + contract
- [FEDERATED_LEARNING.md](./FEDERATED_LEARNING.md) — the numbers behind the story
- [API.md](./API.md) — every endpoint
