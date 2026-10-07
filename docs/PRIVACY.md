# DataVault — Privacy Model

> **DataVault is a research and hackathon demonstration.** It is not legal or
> regulatory compliance advice. Production deployments must undergo
> organization-specific privacy, security, legal, and regulatory review.
> (spec §2, §55)

**Core invariant — RAW DATA NEVER LEAVES THE DATA OWNER.** Everything below
exists to enforce and *prove* that single sentence.

## 1. Participant data isolation

Each organization's dataset lives **only** in its own environment folder:

```
data/
└── participants/
    ├── hospital-a/data.csv     ← Apollo Demo Hospital (synthetic oncology records)
    ├── hospital-b/data.csv     ← AIIMS Demo Center
    ├── hospital-c/data.csv     ← Max Demo Research Lab
    ├── bank-a/data.csv … bank-c/data.csv
    └── farm-a/data.csv … farm-c/data.csv
```

- The central platform stores **metadata only** (`Dataset` rows: name,
  sampleCount, featureCount, feature names, privacy classification,
  `metadataHash`). Zero record content.
- `ParticipantNode` (`src/server/federation/participant-node.ts`) loads the
  CSV *from the participant's own folder* and exposes exactly four things:
  masked update vectors, sample counts, metrics, and feature statistics.
- In Docker/production mode this boundary becomes a separate process /
  container per organization (the `services/ml-service` deployment pattern).
- Datasets are classified `RESTRICTED | CONFIDENTIAL | INTERNAL` and move
  through states `LOCAL_ONLY → ENCRYPTED_UPDATES_ONLY` as they join training.

## 2. Layer 2a — Pairwise zero-sum masking (secure aggregation)

Real additive masking with pairwise construction
(`src/server/privacy/privacy-engine.ts`, `SecureAggregator`):

For each unordered pair of participants `(i, j)`, `i < j` (lexicographic):

```
r_ij = PRF(roundSeed, i, j)            // HMAC-SHA256-derived value, |r| ≤ 0.02
```

Each participant builds its mask by summing its pairs with a sign:

```
mask_i = Σ_{j>i} +r_ij  −  Σ_{j<i} r_ij
mask_j = Σ_{j>i} +r_jk  −  Σ_{k<i} r_kj        (the pair (i,j) enters with −r_ij for the "larger" id)
```

The construction guarantees **masks cancel exactly**:

```
Σᵢ mask_i = 0        (verified by SecureAggregator.verifyZeroSum, tolerance 1e-12)
```

What the coordinator observes is only `Δᵢ + maskᵢ`; the aggregate

```
Δ_agg = Σᵢ (nᵢ/Σnⱼ)·(Δᵢ + maskᵢ) = Σᵢ (nᵢ/Σnⱼ)·Δᵢ
```

recovers the FedAvg result while individual updates remain hidden in the sum.
**Demo-grade caveat**: `r_ij` is derived from a *shared round seed* known to
the orchestrator, which keeps the demo fast and deterministic — production
derives `r_ij` via pairwise **Diffie–Hellman** keys so no coordinator can ever
reconstruct a single participant's update. This is explicitly documented as a
demo simplification (spec §64 honest-fallback rule).

## 3. Layer 2b — AES-256-GCM (ENCRYPTION mode)

In `PRIVACY_MODE=ENCRYPTION` (per-round `privacyMode: "ENCRYPTION"`):

1. The masked update vector is serialized (`JSON` of the Float64 vector).
2. It is sealed with **AES-256-GCM** (Node `crypto`, 96-bit random IV,
   128-bit auth tag) using a key derived via `SHA-256("datavault::" + secret)`.
3. The stored `ModelUpdate.payload` is the ciphertext envelope:

```json
{ "algo": "AES-256-GCM", "iv": "…hex", "authTag": "…hex",
  "ciphertext": "…hex", "plaintextHash": "…sha256", "bytes": 1234 }
```

- `plaintextHash` is an **integrity proof** (safe to expose — proves the
  payload content without revealing it).
- GCM gives authenticated encryption: any tampering with ciphertext or tag
  fails at decrypt time.
- This is real cryptography, but the key lives server-side for the demo —
  a production system uses per-participant keys / threshold decryption.

## 4. Layer 2c — TenSEAL CKKS (production path)

The Docker-mode `services/ml-service` implements the ENCRYPTION production
path with **homomorphic encryption** (TenSEAL / CKKS):

```
local model → compute update → serialize selected tensors
           → CKKS-encrypt (participant public key)
           → send ciphertext
           → secure aggregation OVER ciphertexts (CKKS supports addition)
           → decrypt only the aggregate (coordinator + threshold key holders)
           → global model
```

We do **not** pretend encrypting a whole neural network is trivial: the
documented scope is **selected update tensors** (the flattened delta vector
and per-layer weight groups), with the round config recording exactly which
tensors were encrypted (`ModelUpdate.privacyMode`,
`PrivacyEvent.metadata.algo`). DEMO mode skips CKKS for speed and
determinism; the interfaces (`PrivacyEngine`, `EncryptionService`,
`SecureAggregator`) are identical across both modes.

## 5. What is and isn't shared

| Artifact | Shared? | Form |
| --- | --- | --- |
| Raw records (rows of `data.csv`) | **NEVER — 0 bytes** | n/a (RAW_ACCESS_BLOCKED) |
| Model updates (weight deltas) | **YES** | masked (+ AES-256-GCM in ENCRYPTION mode); never plaintext |
| Sample counts | yes | integer |
| Local metrics (loss, accuracy) | yes | numbers |
| Feature names / statistics | yes | metadata for the federated standardizer |
| Dataset metadata hash | yes | SHA-256 |
| Global model weights | yes (post-aggregation) | shareable model artifact |
| Contribution scores | yes | 6-decimal normalized score |
| On-chain data | hashes, scores, amounts ONLY | see [BLOCKCHAIN.md](./BLOCKCHAIN.md) |

The Privacy Center (`GET /api/privacy/status`) surfaces exactly this table as
booleans: `raw_data_shared: false`, `model_update_only: true`,
`secure_aggregation: true`, `encrypted_updates: <mode>`, plus a
`rawDataSharedBytes: 0` counter that the dashboard renders as
“Raw data shared: 0 bytes”.

## 6. The RAW_ACCESS_BLOCKED guard

`GET /api/datasets/[id]/raw` is the executable proof of the core invariant
(`src/app/api/datasets/[id]/raw/route.ts`):

- The endpoint **always refuses** to return records — for every role,
  including ADMIN, even for the dataset's own owner.
- Every attempt is logged **twice**: a `RAW_ACCESS_BLOCKED` row in the privacy
  event log (visible in the Privacy Center) and a status `BLOCKED` entry in
  the hash-chained audit log.
- The response itself teaches the model: it returns the policy
  ("raw records never leave the data owner's environment") and the
  what-is-shared table above.
- Try it in the demo: Datasets → any dataset → "Attempt raw access" →
  watch the privacy event appear live in the Privacy Center.

## 7. India / DPDP positioning

DataVault is designed for privacy-conscious collaborative AI in **India's
data-rich but siloed ecosystem** (healthcare, banking, agriculture,
insurance, research, public sector). No unsupported compliance claims are
made: DPDP readiness is a *design goal* (data minimization, purpose
limitation, auditability), not a certification. The in-app disclaimer (spec
§55) appears on login, in the Privacy Center, and in the exported report.

## 8. Honest limitations

1. **Single-process simulation**: participant silos are in-process
   environments with strict API boundaries — not separate machines. The
   masking math is real, but a compromised host could inspect memory.
2. **Demo-grade mask derivation**: the shared round seed means the
   orchestrator *could* reconstruct individual updates in the demo. Production
   uses pairwise DH keys (documented above).
3. **Server-side encryption key**: AES-256-GCM is real, but the demo key is
   derived from a server secret (JWT_SECRET) rather than participant-held keys.
4. **No differential privacy yet**: updates are masked, not DP-noised; the
   aggregate itself could leak in pathological cases. Roadmap: DP-SGD.
5. **Not audited**: research code, no external security review — exactly why
   the disclaimer above exists.
6. Ledger/contract store only hashes/scores/amounts — but the demo chain is
   local (see [BLOCKCHAIN.md](./BLOCKCHAIN.md) §7).
