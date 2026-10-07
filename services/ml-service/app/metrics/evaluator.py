"""REAL model metrics (spec §35) — port of ``src/server/ml/metrics.ts``.

Classification: accuracy, precision, recall, F1, ROC-AUC (Mann-Whitney U with
tie handling), confusion matrix, log-loss. Regression: MAE, RMSE, R².
"""
from __future__ import annotations

from typing import Dict, List, Sequence, Tuple

import numpy as np


def _round(v: float, d: int) -> float:
    if not np.isfinite(v):
        return 0.0
    return round(float(v), d)


def roc_auc(y_true: Sequence[float], scores: Sequence[float]) -> float:
    """Mann-Whitney U with tie handling (average ranks) — mirrors TS rocAuc."""
    pairs: List[Tuple[float, float]] = sorted(zip(scores, y_true), key=lambda p: p[0])
    n = len(pairs)
    if n == 0:
        return 0.5
    pos = sum(1 for _, y in pairs if y == 1)
    neg = n - pos
    if pos == 0 or neg == 0:
        return 0.5
    ranks = np.zeros(n)
    i = 0
    while i < n:
        j = i
        while j < n and pairs[j][0] == pairs[i][0]:
            j += 1
        avg_rank = (i + j + 1) / 2.0  # 1-based
        ranks[i:j] = avg_rank
        i = j
    sum_pos_ranks = float(sum(ranks[k] for k in range(n) if pairs[k][1] == 1))
    u = sum_pos_ranks - (pos * (pos + 1)) / 2.0
    return u / (pos * neg)


def evaluate_classification(y_true: Sequence[float], p_pred: Sequence[float]) -> Dict:
    y = np.asarray(y_true, dtype=np.float64)
    p = np.asarray(p_pred, dtype=np.float64)
    pred = (p >= 0.5).astype(int)
    truth = (y >= 0.5).astype(int)
    tp = int(np.sum((pred == 1) & (truth == 1)))
    fp = int(np.sum((pred == 1) & (truth == 0)))
    tn = int(np.sum((pred == 0) & (truth == 0)))
    fn = int(np.sum((pred == 0) & (truth == 1)))
    n = len(y) or 1
    pc = np.clip(p, 1e-7, 1 - 1e-7)
    loss = float(-np.mean(truth * np.log(pc) + (1 - truth) * np.log(1 - pc)))
    precision = tp / (tp + fp) if tp + fp > 0 else 0.0
    recall = tp / (tp + fn) if tp + fn > 0 else 0.0
    return {
        "accuracy": (tp + tn) / n,
        "precision": precision,
        "recall": recall,
        "f1": (2 * precision * recall / (precision + recall)) if precision + recall > 0 else 0.0,
        "rocAuc": roc_auc(truth, p),
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "loss": loss,
        "n": len(y),
    }


def evaluate_regression(y_true: Sequence[float], y_pred: Sequence[float]) -> Dict:
    y = np.asarray(y_true, dtype=np.float64)
    p = np.asarray(y_pred, dtype=np.float64)
    n = len(y) or 1
    err = p - y
    ae = float(np.sum(np.abs(err)))
    se = float(np.sum(err * err))
    mean = float(np.mean(y)) if len(y) else 0.0
    ss_tot = float(np.sum((y - mean) ** 2)) or 1.0
    return {"mae": ae / n, "rmse": float(np.sqrt(se / n)), "r2": 1.0 - se / ss_tot, "n": len(y)}


def primary_metric(task: str, metrics: Dict) -> float:
    """Accuracy for classification, R² for regression (TS primaryMetric)."""
    if task == "REGRESSION":
        return float(metrics["r2"])
    return float(metrics["accuracy"])


def metrics_to_display(task: str, metrics: Dict) -> Dict:
    """Rounded metric bundle used by events + persistence (TS metricsToDisplay)."""
    if task == "REGRESSION":
        return {"mae": _round(metrics["mae"], 3), "rmse": _round(metrics["rmse"], 3), "r2": _round(metrics["r2"], 4)}
    return {
        "accuracy": _round(metrics["accuracy"], 4),
        "precision": _round(metrics["precision"], 4),
        "recall": _round(metrics["recall"], 4),
        "f1": _round(metrics["f1"], 4),
        "rocAuc": _round(metrics["rocAuc"], 4),
    }


def evaluate_predictions(task: str, y_true: Sequence[float], y_pred: Sequence[float]) -> Tuple[Dict, float, int]:
    """Evaluate a model's raw predictions → (raw metrics, primary, n)."""
    if task == "REGRESSION":
        m = evaluate_regression(y_true, y_pred)
    else:
        m = evaluate_classification(y_true, y_pred)
    return m, primary_metric(task, m), m["n"]
