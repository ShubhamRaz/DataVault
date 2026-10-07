"""Reward engine — transparent contribution scoring (spec §36, §37).

    raw_score        = 0.35·sample_share + 0.25·quality
                     + 0.25·improvement + 0.15·participation
    normalized_score = raw_score / Σ raw_scores
    reward           = ROUND_REWARD_POOL × normalized_score   (2 dp)

Identical formula to the TS engine and the ml-service — nothing is
hardcoded per-user.
"""
from __future__ import annotations

from typing import Dict, List

ROUND_REWARD_POOL = 1000  # DATA tokens per round


def _clamp01(v: float) -> float:
    try:
        v = float(v or 0.0)
    except (TypeError, ValueError):
        return 0.0
    return min(1.0, max(0.0, v))


def _round(v: float, d: int) -> float:
    try:
        v = float(v)
    except (TypeError, ValueError):
        return 0.0
    return round(v, d) if v == v else 0.0  # NaN → 0


def _raw_score(item: Dict, total_samples: int) -> float:
    share = (item["sampleCount"] / total_samples) if total_samples else 0.0
    return (0.35 * share + 0.25 * _clamp01(item.get("quality"))
            + 0.25 * _clamp01(item.get("improvement")) + 0.15 * _clamp01(item.get("participation")))


def score_contributions(inputs: List[Dict]) -> List[Dict]:
    total_samples = sum(int(i.get("sampleCount", 0)) for i in inputs) or 1
    total_raw = sum(_raw_score(i, total_samples) for i in inputs) or 1e-9
    scored: List[Dict] = []
    for i in inputs:
        raw = _raw_score(i, total_samples)
        norm = raw / total_raw
        scored.append({
            **i,
            "rawScore": _round(raw, 6),
            "normalizedScore": _round(norm, 6),
            "sampleShare": _round(int(i.get("sampleCount", 0)) / total_samples, 6),
            "qualityScore": _round(_clamp01(i.get("quality")), 6),
            "improvementScore": _round(_clamp01(i.get("improvement")), 6),
            "participationScore": _round(_clamp01(i.get("participation")), 6),
            "rewardAmount": _round(ROUND_REWARD_POOL * norm, 2),
        })
    return scored
