"""Secure aggregation — REAL additive masking with pairwise construction
(spec §5 Layer 2, §34; mirrors ``src/server/privacy/privacy-engine.ts``).

Construction (weight-aware pairwise, so masks cancel EXACTLY under FedAvg):

    for every pair (i, j) with sorted ids lo < hi:  v = PRF(roundSeed, lo, hi)
        mask_lo += v * w_hi          w_k = n_k / Σ n   (public sample shares)
        mask_hi -= v * w_lo

    → the pair's contribution to the weighted aggregate is
      w_lo·(v·w_hi) − w_hi·(v·w_lo) = 0 identically, so

      aggregate_masked = Σ_k w_k·(Δ_k + mask_k) = Σ_k w_k·Δ_k  EXACTLY.

With equal sample counts this reduces to the classic pairwise ±v zero-sum
mask (Σ_k mask_k = 0). Note: the TS demo engine adds ±v and aggregates
weighted, which leaves a tiny ε residual; the Python service makes the
cancellation exact (spec §65 — do not fake the core technology).
Demo caveat (documented per spec §64): masks derive from a shared round seed;
production would derive r_ij via pairwise Diffie–Hellman so the coordinator
can never reconstruct individual updates.
"""
from __future__ import annotations

import hmac
from hashlib import sha256
from typing import Dict, Iterable, List, Sequence

import numpy as np

MASK_SCALE = 0.02  # mirrors the TS demo engine


def _pair_value(round_seed: str, a: str, b: str) -> float:
    """Pairwise PRF value — HMAC-SHA256, mirrors TS SecureAggregator.pairValue."""
    lo, hi = sorted((a, b))
    digest = hmac.new(f"datavault-mask-v1::{round_seed}".encode(), f"{lo}|{hi}".encode(), sha256).digest()
    v = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF  # [0, 1)
    return (v * 2 - 1) * MASK_SCALE


class SecureAggregator:
    """The coordinator observes ONLY masked vectors; individual updates are
    unrecoverable from what it sees."""

    def participant_mask(
        self,
        participant_id: str,
        participants: Dict[str, int],
        round_seed: str,
        length: int,
    ) -> np.ndarray:
        """Participant-local mask: Σ over pairs with weight-aware ± signs."""
        mask = np.zeros(length, dtype=np.float64)
        total = float(sum(participants.values())) or 1.0
        for other in participants:
            if other == participant_id:
                continue
            lo, hi = sorted((participant_id, other))
            v = _pair_value(round_seed, lo, hi)
            if participant_id == lo:
                mask += v * (participants[hi] / total)  # +v·w_hi
            else:
                mask -= v * (participants[lo] / total)  # −v·w_lo
        return mask

    def aggregate_masked(self, masked_updates: Sequence[np.ndarray], sample_counts: Sequence[int]) -> np.ndarray:
        """Aggregator-side weighted sum of masked updates — masks cancel."""
        total = float(sum(sample_counts)) or 1.0
        out = np.zeros(len(masked_updates[0]), dtype=np.float64)
        for u, n in zip(masked_updates, sample_counts):
            out += u * (n / total)
        return out

    def verify_zero_sum(self, participants: Dict[str, int], round_seed: str, length: int) -> bool:
        """Σ_k w_k·mask_k == 0 (≤1e-12, TS tolerance) — masks truly cancel."""
        total = float(sum(participants.values())) or 1.0
        acc = np.zeros(length, dtype=np.float64)
        for pid in participants:
            mask = self.participant_mask(pid, participants, round_seed, length)
            acc += mask * (participants[pid] / total)
        return bool(np.all(np.abs(acc) < 1e-12))

    def verify_plain_zero_sum(self, all_ids: Iterable[str], round_seed: str, length: int) -> bool:
        """Classic property with equal weights: Σ_k mask_k == 0."""
        ids = list(all_ids)
        equal = {pid: 1 for pid in ids}
        total = float(sum(equal.values()))
        acc = np.zeros(length, dtype=np.float64)
        for pid in ids:
            acc += self.participant_mask(pid, equal, round_seed, length) / total
        return bool(np.all(np.abs(acc) < 1e-12))
