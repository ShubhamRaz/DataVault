"""ParticipantNode — the participant environment (spec §5 Layer 1, §14).

Each node loads its local CSV from ``data/participants/<slug>/data.csv``,
splits it 70/15/15 (train/val/test, seeded), trains a copy of the global model
with real SGD and returns ONLY weight deltas + metrics. Raw data never leaves
this class — there is no accessor for the underlying matrix and any attempt
to reach it raises ``RAW_ACCESS_BLOCKED``.
"""
from __future__ import annotations

import csv
import hashlib
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np

from app.datasets.generators import rng as mulberry32
from app.metrics.evaluator import evaluate_predictions, metrics_to_display, primary_metric
from app.models.mlp import MLPConfig, MLPModel, Weights, flatten_weights, serialize_weights, train_local, weight_delta


@dataclass
class LocalTrainingResult:
    """Everything the coordinator is allowed to see (deltas + telemetry)."""

    delta: Weights
    update_vector: np.ndarray
    serialized_delta: str
    update_hash: str
    sample_count: int
    local_metrics: Dict
    local_primary: float
    primary_metric_name: str
    duration_ms: int
    epoch_logs: List[Dict]


@dataclass
class _Split:
    X: np.ndarray
    y: np.ndarray


class ParticipantNode:
    """One organization's training silo. Raw data stays inside."""

    def __init__(self, slug: str, org_name: str, data_root: Path) -> None:
        self.slug = slug
        self.org_name = org_name
        self._path = Path(data_root) / slug / "data.csv"
        self._X, self._y, self._feature_names, self._target_name = self._load_csv(self._path)
        self._train, self._val, self._test = self._split(self._X, self._y)
        self._mean, self._std = self._fit_standardizer(self._train.X)
        # public metadata (safe to share)
        self.sample_count = int(len(self._y))
        self.feature_count = int(self._X.shape[1])
        self.dataset_hash = hashlib.sha256(self._path.read_bytes()).hexdigest() if self._path.exists() else ""

    # ── loading & splitting (private: raw data never escapes) ──
    @staticmethod
    def _load_csv(path: Path) -> Tuple[np.ndarray, np.ndarray, List[str], str]:
        with open(path, "r", encoding="utf-8", newline="") as fh:
            reader = csv.reader(fh)
            header = next(reader)
            rows = [r for r in reader if r]
        feature_names, target_name = header[:-1], header[-1]
        data = np.asarray([[float(v) for v in row] for row in rows], dtype=np.float64)
        return data[:, :-1], data[:, -1], feature_names, target_name

    @staticmethod
    def _split(X: np.ndarray, y: np.ndarray) -> Tuple[_Split, _Split, _Split]:
        """70/15/15 with a seeded Fisher-Yates shuffle — mirrors TS splitDataset."""
        n = len(X)
        r = mulberry32(n + 7)
        idx = list(range(n))
        for i in range(n - 1, 0, -1):
            j = int(r() * (i + 1))
            idx[i], idx[j] = idx[j], idx[i]
        n_train = int(n * 0.7)
        n_val = int(n * 0.15)
        pick = lambda a, b: _Split(X=np.array([X[idx[k]] for k in range(a, b)], dtype=np.float64),
                                   y=np.array([y[idx[k]] for k in range(a, b)], dtype=np.float64))
        return pick(0, n_train), pick(n_train, n_train + n_val), pick(n_train + n_val, n)

    @staticmethod
    def _fit_standardizer(X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        mean = X.mean(axis=0) if len(X) else np.zeros(X.shape[1])
        std = X.std(axis=0) if len(X) else np.ones(X.shape[1])
        std = np.where(std == 0, 1.0, std)
        return mean, std

    def _standardize(self, X: np.ndarray) -> np.ndarray:
        return (X - self._mean) / self._std

    # ── privacy guard (spec §5, §15: raw data never shared) ──
    def raw_data(self) -> None:
        raise PermissionError(
            "RAW_ACCESS_BLOCKED — raw participant data never leaves the participant environment"
        )

    @property
    def train_size(self) -> int:
        return len(self._train.y)

    @property
    def test_size(self) -> int:
        return len(self._test.y)

    @property
    def task_hint(self) -> str:
        return "REGRESSION" if self._target_name == "yield_t_per_ha" else "CLASSIFICATION"

    # ── local training (real SGD on local data only) ──
    def train(
        self,
        global_model: MLPModel,
        epochs: int,
        batch_size: int,
        lr: float,
        on_epoch: Optional[Callable[[int, float], None]] = None,
    ) -> LocalTrainingResult:
        started = time.time()
        cfg = MLPConfig(
            input_dim=global_model.config.input_dim,
            hidden_dim=global_model.config.hidden_dim,
            task=global_model.config.task,
            lr=lr, batch_size=batch_size, epochs=epochs,
            l2=global_model.config.l2, seed=global_model.config.seed,
        )
        local = MLPModel(cfg, global_model.weights)
        logs = train_local(
            local, self._standardize(self._train.X), self._train.y,
            on_epoch=(lambda log: on_epoch(log.epoch, log.loss)) if on_epoch else None,
        )
        delta = weight_delta(local.weights, global_model.weights)
        update_vector = flatten_weights(delta)
        serialized = serialize_weights(delta)
        update_hash = "0x" + hashlib.sha256(serialized.encode()).hexdigest()
        # local metrics on val split; primary measured on the held-out test
        # split so it is directly comparable with global-model evaluations
        val_metrics = self._evaluate_raw(local)
        _, local_primary, _ = evaluate_predictions(
            cfg.task, self._test.y, local.predict_array(self._standardize(self._test.X))
        )
        return LocalTrainingResult(
            delta=delta,
            update_vector=update_vector,
            serialized_delta=serialized,
            update_hash=update_hash,
            sample_count=self.train_size,
            local_metrics=metrics_to_display(cfg.task, val_metrics),
            local_primary=local_primary,
            primary_metric_name="r2" if cfg.task == "REGRESSION" else "accuracy",
            duration_ms=int((time.time() - started) * 1000),
            epoch_logs=[{"epoch": lg.epoch, "loss": round(lg.loss, 4)} for lg in logs],
        )

    # ── evaluation of any model on the local held-out test split ──
    def evaluate_on_local_test(self, model: MLPModel) -> Dict:
        raw, primary, n = evaluate_predictions(
            model.config.task, self._test.y, model.predict_array(self._standardize(self._test.X))
        )
        return {"metrics": metrics_to_display(model.config.task, raw), "primary": primary, "n": n}

    def _evaluate_raw(self, model: MLPModel) -> Dict:
        task = model.config.task
        raw, _, _ = evaluate_predictions(task, self._val.y, model.predict_array(self._standardize(self._val.X)))
        return raw

    def __repr__(self) -> str:  # never leak data via repr
        return f"ParticipantNode(slug={self.slug!r}, samples={self.sample_count}, features={self.feature_count})"
