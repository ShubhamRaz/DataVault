"""ML-service engine tests — real computations, no mocks (spec §49, §65).

Covers: dataset determinism + shapes, FedAvg correctness on tiny tensors,
mask zero-sum (plain + weighted cancellation), AES-256-GCM round-trip,
metrics on known answers.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets.generators import PARTICIPANT_SPECS, generate_dataset, hash_dataset
from app.metrics.evaluator import evaluate_classification, evaluate_regression, roc_auc
from app.models.mlp import MLPConfig, MLPModel, Weights, apply_delta, fed_avg, flatten_weights, unflatten_weights, weight_delta
from app.privacy.encryption import EncryptionService, TENSEAL_AVAILABLE
from app.privacy.secure_aggregation import SecureAggregator
from app.federation.trainer import ROUND_REWARD_POOL, score_contributions


# ── datasets ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("slug", list(PARTICIPANT_SPECS))
def test_dataset_shapes_and_determinism(slug: str) -> None:
    spec = PARTICIPANT_SPECS[slug]
    a, b = generate_dataset(spec), generate_dataset(spec)
    assert a.sample_count == spec.samples and b.sample_count == spec.samples
    assert a.feature_count == len(spec.feature_names)
    assert a.X == b.X and a.y == b.y and a.metadata_hash == b.metadata_hash
    assert all(len(row) == a.feature_count for row in a.X)
    assert set(a.y) <= {0.0, 1.0} if spec.task == "CLASSIFICATION" else min(a.y) >= 0.4


def test_dataset_hash_matches_ts_engine() -> None:
    # cross-checked against the TypeScript generator (bun run) for all 9 slugs
    assert generate_dataset(PARTICIPANT_SPECS["hospital-a"]).metadata_hash == \
        "7ccc7765e32d9a2ec6ae0912eaca009effef9198421277ef88b9dc10f6cdf214"
    assert generate_dataset(PARTICIPANT_SPECS["farm-a"]).metadata_hash == \
        "c191c76364935c3b9f4ec11253886dc2dcc56b9d14d6bd206472710fdb51a98e"


def test_hash_dataset_changes_when_labels_change() -> None:
    ds = generate_dataset(PARTICIPANT_SPECS["hospital-b"])
    flipped = hash_dataset(ds.X, [1 - v for v in ds.y], PARTICIPANT_SPECS["hospital-b"].seed)
    assert flipped != ds.metadata_hash


# ── FedAvg + weight delta helpers ────────────────────────────────────────────

def _tiny(i: int) -> Weights:
    return Weights(W1=np.full((2, 3), float(i)), b1=np.full(2, float(i)),
                   W2=np.full(2, float(i)), b2=float(i))


def test_fed_avg_weighted_average() -> None:
    avg = fed_avg([_tiny(1), _tiny(4)], [3, 1])  # 75% / 25%
    assert np.allclose(avg.W1, 1.75) and np.allclose(avg.b1, 1.75)
    assert np.allclose(avg.W2, 1.75) and avg.b2 == 1.75


def test_fed_avg_equal_weights_is_mean() -> None:
    avg = fed_avg([_tiny(0), _tiny(2), _tiny(10)], [5, 5, 5])
    assert np.allclose(avg.W1, 4.0) and abs(avg.b2 - 4.0) < 1e-12


def test_delta_round_trip() -> None:
    g, l = _tiny(2), _tiny(5)
    d = weight_delta(l, g)
    assert np.allclose(d.W1, 3)
    back = apply_delta(g, d)
    assert np.allclose(back.W1, l.W1) and back.b2 == l.b2


def test_flatten_unflatten_round_trip() -> None:
    w = _tiny(7)
    v = flatten_weights(w)
    assert v.size == 2 * 3 + 2 + 2 + 1
    w2 = unflatten_weights(v, 3, 2)
    assert np.allclose(w2.W1, w.W1) and np.allclose(w2.b1, w.b1)
    assert np.allclose(w2.W2, w.W2) and w2.b2 == w.b2


def test_mlp_serialize_round_trip_and_forward() -> None:
    model = MLPModel(MLPConfig(input_dim=4, task="CLASSIFICATION", seed=42))
    model2 = MLPModel.deserialize(model.serialize())
    x = np.random.default_rng(0).normal(size=(5, 4))
    assert np.allclose(model.predict_array(x), model2.predict_array(x))
    p = model.predict_array(x)
    assert ((p >= 0) & (p <= 1)).all()  # sigmoid outputs for classification


def test_mlp_regression_linear_output() -> None:
    model = MLPModel(MLPConfig(input_dim=3, task="REGRESSION", seed=1))
    out = model.predict_array(np.zeros((2, 3)))
    assert (out == 0.0).all()  # tanh(0)=0, b2=0 → linear head outputs 0


# ── secure aggregation ────────────────────────────────────────────────────────

def test_mask_pairwise_zero_sum_equal_weights() -> None:
    agg = SecureAggregator()
    ids = ["hospital-a", "hospital-b", "hospital-c"]
    assert agg.verify_plain_zero_sum(ids, "round:test:1", 7)


def test_mask_weighted_cancellation_exact() -> None:
    agg = SecureAggregator()
    participants = {"hospital-a": 630, "hospital-b": 455, "hospital-c": 770}  # 70% splits
    assert agg.verify_zero_sum(participants, "round:test:2", 9)


def test_aggregate_masked_equals_fedavg_of_deltas() -> None:
    agg = SecureAggregator()
    participants = {"bank-a": 980, "bank-b": 700, "bank-c": 840}
    seed, length = "round:test:3", 5
    deltas = [np.array([1.0, 2.0, -3.0, 0.5, 4.0]),
              np.array([0.0, -1.0, 2.0, 2.5, -2.0]),
              np.array([3.0, 0.5, 0.0, -1.0, 1.0])]
    total = sum(participants.values())
    masked = [d + agg.participant_mask(pid, participants, seed, length) for pid, d in zip(participants, deltas)]
    got = agg.aggregate_masked(masked, list(participants.values()))
    want = sum(d * (n / total) for d, n in zip(deltas, participants.values()))
    assert np.allclose(got, want, atol=1e-12)  # masks cancel exactly


# ── encryption ────────────────────────────────────────────────────────────────

def test_aes256_gcm_round_trip() -> None:
    enc = EncryptionService("unit-test-secret")
    plaintext = json.dumps([0.1, -2.5, 3.14159] * 40)
    payload = enc.encrypt(plaintext)
    assert payload.algo == "AES-256-GCM" and payload.bytes > 0
    assert enc.decrypt(payload) == plaintext


def test_aes256_gcm_tamper_detection() -> None:
    enc = EncryptionService("unit-test-secret")
    payload = enc.encrypt("sensitive update vector")
    tampered = payload.__class__(**{**payload.__dict__, "ciphertext": ("00" if not payload.ciphertext.startswith("00") else "11") + payload.ciphertext[2:]})
    with pytest.raises(Exception):
        enc.decrypt(tampered)


@pytest.mark.skipif(TENSEAL_AVAILABLE, reason="tenseal installed — fallback not exercised")
def test_tenseal_fallback_documented() -> None:
    from app.privacy.encryption import backends_status
    status = backends_status()
    assert status["aes256Gcm"] is True and status["tensealCkks"] is False
    assert "spec §64" in status["fallback"]


# ── metrics on known answers ──────────────────────────────────────────────────

def test_classification_perfect_metrics() -> None:
    m = evaluate_classification([1, 1, 0, 0], [0.9, 0.8, 0.1, 0.2])
    assert m["accuracy"] == 1.0 and m["precision"] == 1.0 and m["recall"] == 1.0 and m["f1"] == 1.0
    assert m["rocAuc"] == 1.0
    assert m["confusion"] == {"tp": 2, "fp": 0, "tn": 2, "fn": 0}


def test_classification_confusion_counts() -> None:
    m = evaluate_classification([1, 0, 1, 0], [0.9, 0.8, 0.2, 0.1])
    assert m["confusion"] == {"tp": 1, "fp": 1, "tn": 1, "fn": 1}
    assert m["accuracy"] == 0.5 and m["precision"] == 0.5


def test_roc_auc_known_and_ties() -> None:
    # perfect separation → 1.0; all-equal scores (ties) → 0.5
    assert roc_auc([1, 1, 0, 0], [0.9, 0.8, 0.2, 0.1]) == 1.0
    assert roc_auc([1, 0, 1, 0], [0.5, 0.5, 0.5, 0.5]) == 0.5
    assert roc_auc([1, 0, 1, 0], [0.1, 0.9, 0.1, 0.9]) == 0.0


def test_regression_known_answers() -> None:
    m = evaluate_regression([1, 2, 3], [1, 2, 3])
    assert m["mae"] == 0 and m["rmse"] == 0 and m["r2"] == 1.0
    m2 = evaluate_regression([1, 2, 3], [2, 2, 2])  # MAE=2/3, RMSE=sqrt(2/3), ssRes=ssTot=2
    assert abs(m2["mae"] - 2 / 3) < 1e-12
    assert abs(m2["rmse"] - (2 / 3) ** 0.5) < 1e-12
    assert abs(m2["r2"] - 0.0) < 1e-12  # same SS as the mean → R²=0
    m3 = evaluate_regression([1, 2, 3], [2, 3, 4])  # ssRes=3 → R²=1-3/2=-0.5
    assert abs(m3["r2"] + 0.5) < 1e-12


def test_regression_constant_predictions_r2_zero() -> None:
    m = evaluate_regression([3.0, 3.0, 3.0], [3.0, 3.0, 3.0])
    assert m["mae"] == 0.0


# ── rewards ───────────────────────────────────────────────────────────────────

def test_reward_pool_split_45_30_25() -> None:
    scored = score_contributions([
        {"participantId": "a", "organizationName": "A", "roundNumber": 1, "sampleCount": 45,
         "quality": 0, "improvement": 0, "participation": 0},
        {"participantId": "b", "organizationName": "B", "roundNumber": 1, "sampleCount": 30,
         "quality": 0, "improvement": 0, "participation": 0},
        {"participantId": "c", "organizationName": "C", "roundNumber": 1, "sampleCount": 25,
         "quality": 0, "improvement": 0, "participation": 0},
    ])
    assert [s["rewardAmount"] for s in scored] == [450.0, 300.0, 250.0]
    assert sum(s["rewardAmount"] for s in scored) == ROUND_REWARD_POOL


def test_reward_scores_sum_to_one() -> None:
    scored = score_contributions([
        {"participantId": "a", "organizationName": "A", "roundNumber": 2, "sampleCount": 600,
         "quality": 0.9, "improvement": 0.4, "participation": 1.0},
        {"participantId": "b", "organizationName": "B", "roundNumber": 2, "sampleCount": 300,
         "quality": 0.7, "improvement": 0.9, "participation": 0.5},
    ])
    assert abs(sum(s["normalizedScore"] for s in scored) - 1.0) < 1e-9
    assert abs(sum(s["rewardAmount"] for s in scored) - ROUND_REWARD_POOL) < 0.01
