"""Reward engine tests — the canonical 1000 DATA × 0.45/0.30/0.25 split."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.reward_engine import ROUND_REWARD_POOL, score_contributions


def _input(pid: str, samples: int, quality: float = 0.0, improvement: float = 0.0, participation: float = 0.0) -> dict:
    return {"participantId": pid, "organizationName": pid.upper(), "roundNumber": 1,
            "sampleCount": samples, "quality": quality, "improvement": improvement,
            "participation": participation}


def test_reward_split_45_30_25() -> None:
    scored = score_contributions([_input("a", 45), _input("b", 30), _input("c", 25)])
    assert [s["rewardAmount"] for s in scored] == [450.0, 300.0, 250.0]
    assert [s["normalizedScore"] for s in scored] == [0.45, 0.30, 0.25]
    assert sum(s["rewardAmount"] for s in scored) == ROUND_REWARD_POOL == 1000


def test_reward_split_45_30_25_at_scale() -> None:
    # proportional sample counts (900/600/500) → same 45/30/25 split
    scored = score_contributions([_input("a", 900), _input("b", 600), _input("c", 500)])
    assert [s["rewardAmount"] for s in scored] == [450.0, 300.0, 250.0]


def test_equal_bonus_terms_pull_split_toward_equality() -> None:
    # constant quality/improvement/participation for all participants adds the
    # same constant to every raw score → normalized split tightens toward equal
    scored = score_contributions([_input("a", 450, 0.8, 0.6, 1.0),
                                  _input("b", 300, 0.8, 0.6, 1.0),
                                  _input("c", 250, 0.8, 0.6, 1.0)])
    assert abs(sum(s["rewardAmount"] for s in scored) - ROUND_REWARD_POOL) < 0.01
    assert scored[0]["normalizedScore"] > scored[1]["normalizedScore"] > scored[2]["normalizedScore"]  # order kept
    assert scored[0]["normalizedScore"] < 0.45  # biggest share shrinks toward equal
    assert scored[2]["normalizedScore"] > 0.25  # smallest share grows toward equal


def test_normalized_scores_sum_to_one() -> None:
    scored = score_contributions([_input("a", 600, 0.9, 0.4, 1.0),
                                  _input("b", 300, 0.7, 0.9, 0.5),
                                  _input("c", 100, 0.5, 0.0, 0.25)])
    assert abs(sum(s["normalizedScore"] for s in scored) - 1.0) < 1e-9
    assert abs(sum(s["rewardAmount"] for s in scored) - ROUND_REWARD_POOL) < 0.01


def test_quality_and_improvement_break_ties() -> None:
    scored = score_contributions([_input("a", 100, 0.9, 0.9, 1.0), _input("b", 100, 0.1, 0.1, 0.0)])
    assert scored[0]["rewardAmount"] > scored[1]["rewardAmount"]


def test_formula_weights() -> None:
    # single participant with quality=q etc: raw = 0.35·1 + 0.25q + 0.25i + 0.15p
    scored = score_contributions([_input("solo", 100, 0.8, 0.6, 0.4)])
    assert scored[0]["rawScore"] == round(0.35 + 0.25 * 0.8 + 0.25 * 0.6 + 0.15 * 0.4, 6)
    assert scored[0]["rewardAmount"] == ROUND_REWARD_POOL  # normalized to 1.0


def test_clamping_of_out_of_range_inputs() -> None:
    scored = score_contributions([_input("a", 10, 5.0, -3.0, 2.0), _input("b", 10, 0.5, 0.5, 0.5)])
    assert scored[0]["qualityScore"] == 1.0 and scored[0]["improvementScore"] == 0.0
    assert scored[0]["participationScore"] == 1.0
