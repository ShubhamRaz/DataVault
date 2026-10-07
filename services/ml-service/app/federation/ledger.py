"""Federation side-car: reward scoring, wallet derivation and the PoW-3
hash-chain mini-ledger used for contribution proofs (spec §36, §37, §39).

Mirrors the TS engine's reward-engine.ts + ledger.ts observable semantics:
`raw = 0.35·share + 0.25·quality + 0.25·improvement + 0.15·participation`,
normalized across participants, `reward = pool × normalized` (2 dp); wallet
addresses derive from HMAC-SHA256 exactly like ``deriveWalletAddress``.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from typing import Dict, List

ROUND_REWARD_POOL = 1000  # DATA tokens per round (spec §6, §37)
PLATFORM_WALLET = "0x00000000000000000000000000000000000da0a"
BLOCK_DIFFICULTY = 3  # PoW-3 hash chain, mirrors the TS local ledger

CLAMP = lambda v: min(1.0, max(0.0, float(v or 0.0)))  # noqa: E731
R2 = lambda v, d: (round(v, d) if v == v else 0.0)  # noqa: E731 (NaN → 0)


def derive_wallet_address(slug: str) -> str:
    digest = hmac.new(b"datavault-wallet-derivation-v1", slug.encode(), hashlib.sha256).hexdigest()
    return f"0x{digest[:40]}"


def score_contributions(inputs: List[Dict]) -> List[Dict]:
    """Transparent contribution scoring (spec §36/§37) — same formula as the
    TS engine and the api gateway's reward engine."""
    total_samples = sum(i["sampleCount"] for i in inputs) or 1

    def raw_of(i: Dict) -> float:
        return (0.35 * (i["sampleCount"] / total_samples) + 0.25 * CLAMP(i["quality"])
                + 0.25 * CLAMP(i["improvement"]) + 0.15 * CLAMP(i["participation"]))

    total_raw = sum(raw_of(i) for i in inputs) or 1e-9
    out = []
    for i in inputs:
        raw, norm = raw_of(i), raw_of(i) / total_raw
        out.append({**i, "rawScore": R2(raw, 6), "normalizedScore": R2(norm, 6),
                    "sampleShare": R2(i["sampleCount"] / total_samples, 6),
                    "qualityScore": R2(CLAMP(i["quality"]), 6),
                    "improvementScore": R2(CLAMP(i["improvement"]), 6),
                    "participationScore": R2(CLAMP(i["participation"]), 6),
                    "rewardAmount": R2(ROUND_REWARD_POOL * norm, 2)})
    return out


def tx_hash(tx: Dict, nonce: int) -> str:
    blob = json.dumps({**tx, "nonce": nonce}, sort_keys=True, separators=(",", ":"))
    return "0x" + hashlib.sha256(blob.encode()).hexdigest()


def mine_block(header: str) -> Dict:
    """Hash-chain PoW: find a nonce so sha256(header::nonce) has 3 leading zeros."""
    nonce = 0
    while True:
        h = hashlib.sha256(f"{header}::{nonce}".encode()).hexdigest()
        if h.startswith("0" * BLOCK_DIFFICULTY):
            return {"hash": f"0x{h}", "nonce": nonce}
        nonce += 1
