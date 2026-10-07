"""Synthetic dataset generators — semantic port of ``src/server/synthetic-data.ts``
+ ``src/server/demo-specs.ts`` (spec §15). PRNG (mulberry32), gaussian sampler,
feature ranges, ground-truth weights and per-participant non-IID bias shifts
are identical to the TypeScript engine — dataset metadata hashes match for a
given seed (verified cross-engine).
"""
from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, List, Optional

# ── deterministic PRNG (mulberry32) — mirrors TS `rng()` ──────────────────────


def rng(seed: int) -> Callable[[], float]:
    a = seed & 0xFFFFFFFF

    def rand() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((a ^ (a >> 15)) * (a | 1)) & 0xFFFFFFFF
        u = ((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF
        v = ((u + t) & 0xFFFFFFFF) ^ t
        return ((v ^ (v >> 14)) & 0xFFFFFFFF) / 4294967296

    return rand


def gauss(r: Callable[[], float], mu: float = 0.0, sigma: float = 1.0) -> float:
    """Box-Muller — mirrors TS `gauss()` including the 1e-9 clamp."""
    u = max(1e-9, r())
    v = max(1e-9, r())
    return mu + sigma * math.sqrt(-2.0 * math.log(u)) * math.cos(2.0 * math.pi * v)


# ── generative ground truth (the signal the federated MLP must learn) ────────

GROUND_TRUTH = {
    "HEALTHCARE": {"w": [0.9, 0.75, 0.62, 0.85, 1.25, 0.95, 1.05, 0.8, 1.1, 0.7, 0.55, 0.62], "b": 0.0, "signal": 0.5},
    "FINANCE": {"w": [1.4, 0.6, 0.9, -0.5, 0.85, 1.05, 0.55, 1.2], "b": -1.1, "signal": 0.7},
    "AGRICULTURE": {"w": [0.34, 0.46, -0.22, 0.38, 0.29, 0.0, 0.18], "b": 0.0, "signal": 1.25},
}

FEATURE_RANGES: dict[str, list[tuple[float, float]]] = {
    "HEALTHCARE": [
        (22, 85), (16, 42), (95, 165), (65, 210), (0.4, 8.5), (1, 12),
        (8, 32), (0, 1), (0, 1), (0, 4), (0, 3), (0, 3),
    ],
    "FINANCE": [
        (5, 2400), (0, 1), (1, 40), (0, 12), (0, 1), (0, 1), (0, 24), (0, 1),
    ],
    "AGRICULTURE": [
        (400, 1900), (0.12, 0.55), (4.8, 8.4), (16, 38), (20, 140), (0, 3), (0.4, 12),
    ],
}

FEATURE_NAMES: dict[str, list[str]] = {
    "HEALTHCARE": [
        "age", "bmi", "blood_pressure", "glucose", "tumor_size", "cell_texture",
        "cell_radius", "family_risk", "smoking", "biomarker_a", "biomarker_b", "biomarker_c",
    ],
    "FINANCE": [
        "amount", "merchant_risk", "txn_frequency", "account_age", "location_risk",
        "device_risk", "txn_hour", "prior_fraud_score",
    ],
    "AGRICULTURE": ["rainfall", "soil_moisture", "soil_ph", "temperature", "fertilizer", "crop_type", "land_area"],
}

TARGET_NAMES = {"HEALTHCARE": "cancer_risk", "FINANCE": "is_fraud", "AGRICULTURE": "yield_t_per_ha"}


# ── demo network specs (demo-specs.ts PARTICIPANT_SPECS, verbatim) ───────────

@dataclass(frozen=True)
class DatasetSpec:
    domain: str
    target_name: str
    task: str  # CLASSIFICATION | REGRESSION
    samples: int
    seed: int
    feature_shifts: tuple[float, ...]
    class_prior_shift: float
    noise: float
    feature_names: tuple[str, ...] = field(default_factory=tuple)


def _spec(domain: str, task: str, samples: int, seed: int, shifts: list[float], prior: float, noise: float) -> DatasetSpec:
    return DatasetSpec(
        domain=domain,
        target_name=TARGET_NAMES[domain],
        task=task,
        samples=samples,
        seed=seed,
        feature_shifts=tuple(shifts),
        class_prior_shift=prior,
        noise=noise,
        feature_names=tuple(FEATURE_NAMES[domain]),
    )


PARTICIPANT_SPECS: dict[str, DatasetSpec] = {
    "hospital-a": _spec("HEALTHCARE", "CLASSIFICATION", 900, 1101,
                        [12, 2.5, 8, 25, 0.6, 1.5, 3, 0, 0.08, 0.4, 0.2, 0.3], 0.42, 0.26),
    "hospital-b": _spec("HEALTHCARE", "CLASSIFICATION", 650, 1102,
                        [-6, 4, -10, -18, -0.4, -1.2, -2.5, 0, -0.05, -0.3, -0.1, -0.2], -0.38, 0.34),
    "hospital-c": _spec("HEALTHCARE", "CLASSIFICATION", 1100, 1103,
                        [3, -1.5, 4, 10, 0.2, 0.5, 1, 0, 0.02, 0.1, 0, 0.1], 0.08, 0.22),
    "bank-a": _spec("FINANCE", "CLASSIFICATION", 1400, 2201,
                    [180, 0.12, 3, 0.8, 0.08, 0.05, 2, 0.07], 0.2, 0.3),
    "bank-b": _spec("FINANCE", "CLASSIFICATION", 1000, 2202,
                    [-220, -0.1, -2, -0.5, -0.06, -0.04, -3, -0.05], -0.3, 0.36),
    "bank-c": _spec("FINANCE", "CLASSIFICATION", 1200, 2203,
                    [60, 0.03, 1, 0.2, 0, 0, 1, 0.02], 0.05, 0.27),
    "farm-a": _spec("AGRICULTURE", "REGRESSION", 800, 3301,
                    [150, 0.06, 0.5, 2.5, 15, 0, 1.5], 0.14, 0.32),
    "farm-b": _spec("AGRICULTURE", "REGRESSION", 700, 3302,
                    [-180, -0.05, -0.6, -2, -12, 0, -1.2], -0.12, 0.35),
    "farm-c": _spec("AGRICULTURE", "REGRESSION", 950, 3303,
                    [40, 0.02, 0.2, 1, 6, 0, 0.5], 0.04, 0.28),
}

# Federated model registry (demo-specs.ts MODELS)
ORG_NAMES: dict[str, str] = {
    "hospital-a": "Apollo Demo Hospital",
    "hospital-b": "AIIMS Demo Center",
    "hospital-c": "Max Demo Research Lab",
    "bank-a": "HDFC Demo Bank",
    "bank-b": "ICICI Demo Bank",
    "bank-c": "SBI Demo Regional",
    "farm-a": "Green Valley Farm Group",
    "farm-b": "Deccan Agri Collective",
    "farm-c": "Punjab Farm Co-op",
    "datavault-core": "DataVault Research Core",
}

MODELS: list[dict] = [
    {"name": "Cancer Risk Prediction", "slug": "cancer-risk", "taskType": "CLASSIFICATION", "industry": "Healthcare",
     "useCase": "Binary classification of elevated cancer risk from synthetic biomarkers", "seedRounds": 7,
     "participants": ["hospital-a", "hospital-b", "hospital-c"]},
    {"name": "Card Fraud Detection", "slug": "fraud-detection", "taskType": "CLASSIFICATION", "industry": "Finance",
     "useCase": "Real-time fraud vs legitimate transaction classification", "seedRounds": 4,
     "participants": ["bank-a", "bank-b", "bank-c"]},
    {"name": "Crop Yield Prediction", "slug": "crop-yield", "taskType": "REGRESSION", "industry": "Agriculture",
     "useCase": "Regional crop yield regression (t/ha) from soil & weather features", "seedRounds": 5,
     "participants": ["farm-a", "farm-b", "farm-c"]},
]


@dataclass
class GeneratedDataset:
    X: List[List[float]]
    y: List[float]
    feature_names: List[str]
    target_name: str
    task: str
    domain: str
    metadata_hash: str
    sample_count: int
    feature_count: int


def generate_dataset(spec: DatasetSpec) -> GeneratedDataset:
    """Mirror of TS generateDataset(): z-scored linear signal + gaussian noise."""
    r = rng(spec.seed)
    truth = GROUND_TRUTH[spec.domain]
    ranges = FEATURE_RANGES[spec.domain]
    n, d = spec.samples, len(FEATURE_NAMES[spec.domain])
    X: List[List[float]] = []
    y: List[float] = []

    for _ in range(n):
        row: List[float] = []
        for j in range(d):
            lo, hi = ranges[j]
            v = lo + r() * (hi - lo)
            v += (spec.feature_shifts[j] if j < len(spec.feature_shifts) else 0.0) * r() * 0.5
            row.append(v)

        z = truth["b"]
        for j in range(d):
            lo, hi = ranges[j]
            mid, span = (lo + hi) / 2, (hi - lo) / 2
            zj = (row[j] - mid) / span
            z += truth["signal"] * truth["w"][j] * zj
        z += gauss(r, 0.0, spec.noise) + spec.class_prior_shift

        if spec.task == "CLASSIFICATION":
            y.append(1.0 if z > 0 else 0.0)
        else:
            y.append(max(0.4, 3.2 + 2.4 * z + gauss(r, 0.0, 0.28 + spec.noise * 0.2)))
        X.append(row)

    return GeneratedDataset(
        X=X, y=y,
        feature_names=list(FEATURE_NAMES[spec.domain]),
        target_name=TARGET_NAMES[spec.domain],
        task=spec.task, domain=spec.domain,
        metadata_hash=hash_dataset(X, y, spec.seed),
        sample_count=n, feature_count=d,
    )


def _js_num(v: float) -> str:
    """JS String(number): integral floats print without a decimal point."""
    if v == int(v) and abs(v) < 1e21:
        return str(int(v))
    return repr(v)


def hash_dataset(X: List[List[float]], y: List[float], seed: int) -> str:
    h = hashlib.sha256()
    h.update(f"seed={seed};n={len(X)};d={len(X[0]) if X else 0};".encode())
    step = max(1, len(X) // 64)
    for i in range(0, len(X), step):
        h.update((",".join(f"{v:.4f}" for v in X[i]) + "|" + _js_num(y[i])).encode())
    return h.hexdigest()


def participant_path(data_root: Path, slug: str) -> Path:
    return Path(data_root) / slug / "data.csv"


def persist_participant_dataset(data_root: Path, slug: str, ds: GeneratedDataset) -> Path:
    """Write the CSV inside the participant's own folder (spec §15: raw data
    is only ever stored participant-side, never centrally)."""
    path = participant_path(data_root, slug)
    path.parent.mkdir(parents=True, exist_ok=True)
    header = ",".join(ds.feature_names + [ds.target_name])
    lines = [header]
    for row, target in zip(ds.X, ds.y):
        lines.append(",".join(f"{v:.4f}" for v in row) + "," + _js_num(target))
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def generate_all(data_root: Optional[Path] = None) -> dict:
    """Generate + persist all 9 participant datasets."""
    from app.config import settings

    root = Path(data_root) if data_root else settings.data_root
    out: dict = {"dataRoot": str(root), "datasets": []}
    for slug, spec in PARTICIPANT_SPECS.items():
        ds = generate_dataset(spec)
        path = persist_participant_dataset(root, slug, ds)
        positives = sum(1 for v in ds.y if v > 0) if spec.task == "CLASSIFICATION" else 0
        out["datasets"].append({
            "slug": slug, "path": str(path), "samples": ds.sample_count, "features": ds.feature_count,
            "task": ds.task, "domain": ds.domain, "target": ds.target_name, "metadataHash": ds.metadata_hash,
            "positiveRate": round(positives / ds.sample_count, 4) if spec.task == "CLASSIFICATION" else None,
        })
    return out


def ensure_datasets(data_root: Optional[Path] = None) -> None:
    """Generate any missing participant CSVs (used at service startup)."""
    from app.config import settings

    root = Path(data_root) if data_root else settings.data_root
    missing = [s for s in PARTICIPANT_SPECS if not participant_path(root, s).exists()]
    if missing:
        generate_all(root)


if __name__ == "__main__":
    import json
    import sys

    root = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    print(json.dumps(generate_all(root), indent=2))
