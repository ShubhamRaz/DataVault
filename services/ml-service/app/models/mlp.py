"""PyTorch MLP — mirrors the TS demo engine (spec §14, §65):
input → hidden(16, tanh) → 1 (sigmoid for CLASSIFICATION, linear for REGRESSION).
Weight layout, init PRNG and serialization mirror ``src/server/ml/mlp.ts``.
Real training = mini-batch SGD with autograd; L2 applies to weight matrices
only (biases excluded), matching the TS rule ``w -= lr*g + l2*w`` via torch
``weight_decay = l2 / lr``.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Callable, List, Optional

import numpy as np
import torch
import torch.nn as nn

from app.datasets.generators import rng as mulberry32

TASKS = ("CLASSIFICATION", "REGRESSION")


@dataclass
class MLPConfig:
    input_dim: int
    hidden_dim: int = 16
    task: str = "CLASSIFICATION"
    lr: float = 0.1
    batch_size: int = 32
    epochs: int = 5
    l2: float = 0.0005
    seed: int = 42


@dataclass
class Weights:
    """Flat weight container identical in layout to the TS engine."""

    W1: np.ndarray  # (hidden, input)
    b1: np.ndarray  # (hidden,)
    W2: np.ndarray  # (hidden,)
    b2: float

    def param_count(self) -> int:
        return self.W1.size + self.b1.size + self.W2.size + 1


def _weights_from(module: "MLPModel") -> Weights:
    return Weights(
        W1=module.fc1.weight.detach().numpy().astype(np.float64).copy(),
        b1=module.fc1.bias.detach().numpy().astype(np.float64).copy(),
        W2=module.fc2.weight.detach().numpy().astype(np.float64).ravel().copy(),
        b2=float(module.fc2.bias.detach().item()),
    )


class MLPModel(nn.Module):
    """input → 16 tanh → 1 (sigmoid for classification, linear for regression)."""

    def __init__(self, config: MLPConfig, weights: Optional[Weights] = None):
        super().__init__()
        self.config = config
        self.fc1 = nn.Linear(config.input_dim, config.hidden_dim)
        self.fc2 = nn.Linear(config.hidden_dim, 1)
        if weights is None:
            self._init_ts_style()
        else:
            self.set_weights(weights)

    def _init_ts_style(self) -> None:
        # mirrors TS initWeights: mulberry32 + Xavier-ish scale, biases zeroed
        rand = mulberry32(self.config.seed)
        s1 = math.sqrt(2 / (self.config.input_dim + self.config.hidden_dim))
        s2 = math.sqrt(2 / (self.config.hidden_dim + 1))
        with torch.no_grad():
            w1 = np.array([(rand() * 2 - 1) * s1 for _ in range(self.config.hidden_dim * self.config.input_dim)])
            w2 = np.array([(rand() * 2 - 1) * s2 for _ in range(self.config.hidden_dim)])
            self.fc1.weight.copy_(torch.from_numpy(w1.reshape(self.config.hidden_dim, self.config.input_dim).astype(np.float32)))
            self.fc1.bias.zero_()
            self.fc2.weight.copy_(torch.from_numpy(w2.reshape(1, self.config.hidden_dim).astype(np.float32)))
            self.fc2.bias.zero_()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Return logits (pre-sigmoid / raw regression output)."""
        return self.fc2(torch.tanh(self.fc1(x))).squeeze(-1)

    def predict_array(self, X: np.ndarray) -> np.ndarray:
        """Sigmoid probabilities for classification; raw outputs for regression."""
        with torch.no_grad():
            out = self.forward(torch.from_numpy(X.astype(np.float32))).numpy().astype(np.float64)
        if self.config.task == "CLASSIFICATION":
            return 1.0 / (1.0 + np.exp(-out))
        return out

    # ── weight accessors / serialization (JSON, same shape as TS) ──
    @property
    def weights(self) -> Weights:
        return _weights_from(self)

    def set_weights(self, w: Weights) -> None:
        with torch.no_grad():
            self.fc1.weight.copy_(torch.from_numpy(w.W1.astype(np.float32)))
            self.fc1.bias.copy_(torch.from_numpy(w.b1.astype(np.float32)))
            self.fc2.weight.copy_(torch.from_numpy(w.W2.reshape(1, -1).astype(np.float32)))
            self.fc2.bias.fill_(float(w.b2))

    def clone(self) -> "MLPModel":
        return MLPModel(self.config, self.weights)

    # ── serialization (JSON, same shape as TS MLPModel.serialize) ──
    def serialize(self) -> str:
        w = self.weights
        return json.dumps({
            "config": {"inputDim": self.config.input_dim, "hiddenDim": self.config.hidden_dim, "task": self.config.task},
            "weights": {"W1": w.W1.ravel().tolist(), "b1": w.b1.tolist(), "W2": w.W2.tolist(), "b2": w.b2},
        }, separators=(",", ":"))

    @classmethod
    def deserialize(cls, payload: str) -> "MLPModel":
        obj = json.loads(payload)
        cfg = MLPConfig(input_dim=obj["config"]["inputDim"], hidden_dim=obj["config"]["hiddenDim"], task=obj["config"]["task"])
        w = Weights(
            W1=np.asarray(obj["weights"]["W1"], dtype=np.float64).reshape(cfg.hidden_dim, cfg.input_dim),
            b1=np.asarray(obj["weights"]["b1"], dtype=np.float64),
            W2=np.asarray(obj["weights"]["W2"], dtype=np.float64),
            b2=float(obj["weights"]["b2"]),
        )
        return cls(cfg, w)


# ── delta / FedAvg helpers (mirror TS weightDelta / applyDelta / fedAvg) ──────

def weight_delta(local: Weights, global_: Weights) -> Weights:
    return Weights(W1=local.W1 - global_.W1, b1=local.b1 - global_.b1, W2=local.W2 - global_.W2, b2=local.b2 - global_.b2)


def apply_delta(global_: Weights, delta: Weights) -> Weights:
    return Weights(W1=global_.W1 + delta.W1, b1=global_.b1 + delta.b1, W2=global_.W2 + delta.W2, b2=global_.b2 + delta.b2)


def flatten_weights(w: Weights) -> np.ndarray:
    return np.concatenate([w.W1.ravel(), w.b1, w.W2, [w.b2]])


def unflatten_weights(v: np.ndarray, input_dim: int, hidden_dim: int) -> Weights:
    k = hidden_dim * input_dim
    return Weights(
        W1=v[:k].reshape(hidden_dim, input_dim).copy(),
        b1=v[k:k + hidden_dim].copy(),
        W2=v[k + hidden_dim:k + 2 * hidden_dim].copy(),
        b2=float(v[k + 2 * hidden_dim]),
    )


def weights_norm(w: Weights) -> float:
    v = flatten_weights(w)
    return float(np.sqrt(np.sum(v * v)))


def serialize_weights(w: Weights) -> str:
    return json.dumps({"W1": w.W1.ravel().tolist(), "b1": w.b1.tolist(), "W2": w.W2.tolist(), "b2": w.b2}, separators=(",", ":"))


def deserialize_weights(payload: str) -> Weights:
    o = json.loads(payload)
    w2 = np.asarray(o["W2"], dtype=np.float64)
    return Weights(
        W1=np.asarray(o["W1"], dtype=np.float64).reshape(-1, w2.size),
        b1=np.asarray(o["b1"], dtype=np.float64),
        W2=w2,
        b2=float(o["b2"]),
    )


def fed_avg(deltas: List[Weights], weights: List[float]) -> Weights:
    """REAL FedAvg: weighted average of weight deltas (spec §14, §65)."""
    total = float(sum(weights)) or 1.0
    acc = Weights(
        W1=np.zeros(deltas[0].W1.shape, dtype=np.float64),
        b1=np.zeros(deltas[0].b1.shape, dtype=np.float64),
        W2=np.zeros(deltas[0].W2.shape, dtype=np.float64),
        b2=0.0,
    )
    for d, wt in zip(deltas, weights):
        share = wt / total
        acc.W1 += d.W1 * share
        acc.b1 += d.b1 * share
        acc.W2 += d.W2 * share
        acc.b2 += d.b2 * share
    return acc


# ── local training (real SGD; runs INSIDE the participant environment) ───────

@dataclass
class EpochLog:
    epoch: int
    loss: float


def train_local(
    model: MLPModel,
    X_std: np.ndarray,
    y: np.ndarray,
    on_epoch: Optional[Callable[[EpochLog], None]] = None,
) -> List[EpochLog]:
    """Mini-batch SGD on pre-standardized features (the participant owns the
    standardizer). Deterministic epoch shuffling mirrors the TS engine."""
    cfg = model.config
    n = len(X_std)
    if n == 0:
        return []
    xs = torch.from_numpy(X_std.astype(np.float32))
    ys = torch.from_numpy(y.astype(np.float32))
    # TS applies l2*w directly; torch SGD applies lr*wd*w → wd = l2 / lr
    opt = torch.optim.SGD(
        [
            {"params": [model.fc1.weight, model.fc2.weight], "weight_decay": cfg.l2 / cfg.lr},
            {"params": [model.fc1.bias, model.fc2.bias], "weight_decay": 0.0},
        ],
        lr=cfg.lr,
    )
    bce = nn.BCEWithLogitsLoss(reduction="mean")
    mse = nn.MSELoss(reduction="mean")
    shuffle = mulberry32(cfg.seed * 31 + n)
    logs: List[EpochLog] = []

    for epoch in range(1, cfg.epochs + 1):
        order = list(range(n))
        for i in range(n - 1, 0, -1):
            j = int(shuffle() * (i + 1))
            order[i], order[j] = order[j], order[i]
        epoch_loss, batches = 0.0, 0
        for start in range(0, n, cfg.batch_size):
            batch = order[start:start + cfg.batch_size]
            idx = torch.tensor(batch, dtype=torch.long)
            xb, yb = xs[idx], ys[idx]
            opt.zero_grad()
            logits = model(xb)
            # MEAN-reduction loss → batch-mean gradient, exactly the TS update
            # rule (scale = lr / m); reported loss is the per-sample mean too.
            if cfg.task == "CLASSIFICATION":
                loss = bce(logits, yb)
            else:
                loss = 0.5 * mse(logits, yb)  # TS reports 0.5·(out−y)² per sample
            loss.backward()
            opt.step()
            epoch_loss += float(loss.item())
            batches += 1
        log = EpochLog(epoch=epoch, loss=epoch_loss / max(1, batches))
        logs.append(log)
        if on_epoch:
            on_epoch(log)
    return logs
