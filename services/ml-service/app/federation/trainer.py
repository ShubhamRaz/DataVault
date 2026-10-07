"""FederatedTrainer — orchestrates a REAL federated round (spec §13, §14, §65).

Flow (mirrors ``src/server/federation/orchestrator.ts``): distribute global
model → local training (real SGD) → pairwise zero-sum masked updates
(optional AES-256-GCM) → secure aggregation (masks cancel) → FedAvg → new
global model → real evaluation → contribution scoring + 1000 DATA rewards →
PoW-3 hash-chain proofs → 11 event types: ROUND_STARTED, MODEL_DISTRIBUTED,
PARTICIPANT_TRAINING, LOCAL_UPDATE_GENERATED, UPDATE_ENCRYPTED,
UPDATE_SUBMITTED, SECURE_AGGREGATION, GLOBAL_MODEL_UPDATED,
REWARD_CALCULATED, BLOCKCHAIN_RECORDED, ROUND_COMPLETED.
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

import numpy as np

from app.config import Settings
from app.datasets.generators import MODELS, ORG_NAMES
from app.federation.ledger import (CLAMP, PLATFORM_WALLET, R2, ROUND_REWARD_POOL, derive_wallet_address,
                                    mine_block, score_contributions, tx_hash)
from app.federation.participant import ParticipantNode
from app.models.mlp import MLPConfig, MLPModel, apply_delta, serialize_weights, unflatten_weights
from app.privacy.encryption import EncryptionService, backends_status
from app.privacy.secure_aggregation import SecureAggregator

@dataclass
class RoundConfig:
    epochs: int = 5
    batch_size: int = 32
    lr: float = 0.1
    privacy_mode: str = "DEMO"
    l2: float = 0.0005
    seed: int = 42

    def validate(self) -> None:
        if self.privacy_mode not in ("DEMO", "ENCRYPTION"):
            raise ValueError(f"privacyMode must be DEMO or ENCRYPTION (got {self.privacy_mode!r})")
        if self.epochs < 1 or self.epochs > 100:
            raise ValueError("epochs must be in [1, 100]")
        if not (0 < self.lr <= 1.0):
            raise ValueError("lr must be in (0, 1.0]")


class FederatedTrainer:
    """Runs real federated rounds over the seeded participant environments."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.aggregator = SecureAggregator()
        self.encryption = EncryptionService(settings.secret)
        self._locks: Dict[str, threading.Lock] = {}
        self._lock_guard = threading.Lock()
        self.rounds_completed = 0

    # ── per-model state (weights + version + participation), persisted to disk ──
    def _state_path(self, slug: str) -> Path:
        return self.settings.models_dir / f"{slug}.state.json"

    def _load_state(self, slug: str) -> Dict:
        path = self._state_path(slug)
        if path.exists():
            try:
                return json.loads(path.read_text())
            except Exception:
                pass
        return {"version": "v1.0", "accuracy": None, "rounds": 0, "blocks": 0, "participation": {}, "weights": None}

    def _save_state(self, slug: str, state: Dict) -> None:
        self.settings.models_dir.mkdir(parents=True, exist_ok=True)
        self._state_path(slug).write_text(json.dumps(state))

    def _lock(self, slug: str) -> threading.Lock:
        with self._lock_guard:
            return self._locks.setdefault(slug, threading.Lock())

    def is_running(self, slug: str) -> bool:
        return self._lock(slug).locked()

    # ── the round ──
    def run_round(self, model_slug: str, round_number: int, config: RoundConfig, actor: str = "ml-service") -> Dict:
        spec = next((m for m in MODELS if m["slug"] == model_slug), None)
        if spec is None:
            raise ValueError(f"Unknown model {model_slug!r} (known: {[m['slug'] for m in MODELS]})")
        config.validate()
        with self._lock(model_slug):
            return self._execute(spec, round_number, config, actor)

    def _execute(self, spec: Dict, round_number: int, config: RoundConfig, actor: str) -> Dict:
        t0 = time.time()
        task = spec["taskType"]
        events: List[Dict] = []

        def emit(event_type: str, message: str, **fields) -> None:
            events.append({"type": event_type, "message": message,
                           "timestamp": datetime.now(timezone.utc).isoformat(), **fields})

        state = self._load_state(spec["slug"])
        nodes = [ParticipantNode(s, ORG_NAMES[s], self.settings.data_root) for s in spec["participants"]]
        global_model = (MLPModel.deserialize(state["weights"]) if state["weights"] else
                        MLPModel(MLPConfig(input_dim=nodes[0].feature_count, hidden_dim=16, task=task, seed=config.seed)))

        # 1. ROUND_STARTED — baseline: evaluate the current global model everywhere
        evals_before = [n.evaluate_on_local_test(global_model) for n in nodes]
        total_n = sum(e["n"] for e in evals_before) or 1
        metrics_before = sum(e["primary"] * e["n"] / total_n for e in evals_before)
        emit("ROUND_STARTED", f"Federated round #{round_number} started for {spec['name']}",
             actor=actor, data={"metricsBefore": R2(metrics_before, 4), "version": state["version"]})

        # 2. MODEL_DISTRIBUTED
        emit("MODEL_DISTRIBUTED", f"Global model {state['version']} distributed to {len(nodes)} participants",
             data={"participants": [n.org_name for n in nodes], "version": state["version"]})

        # 3. LOCAL TRAINING + UPDATE PROTECTION
        counts = {n.slug: n.train_size for n in nodes}
        before = {n.slug: e["primary"] for n, e in zip(nodes, evals_before)}
        round_seed = f"round:{spec['slug']}:{round_number}"
        subs = []
        for node in nodes:
            emit("PARTICIPANT_TRAINING", f"{node.org_name}: local training started",
                 participantId=node.slug, participantName=node.org_name, progress=5)
            result = node.train(global_model, config.epochs, config.batch_size, config.lr,
                                on_epoch=lambda ep, loss, _n=node.org_name, _t=config.epochs: emit(
                                    "PARTICIPANT_TRAINING",
                                    f"{_n}: local training {round(ep / _t * 100)}% (epoch {ep}/{_t}, loss {loss:.4f})",
                                    participantId=node.slug, participantName=_n, progress=min(98, round(ep / _t * 100))))
            emit("PARTICIPANT_TRAINING", f"{node.org_name}: local training completed ({result.sample_count} samples, {result.duration_ms}ms)",
                 participantId=node.slug, participantName=node.org_name, progress=100, data={"localMetrics": result.local_metrics})
            norm = float(np.sqrt(np.sum(result.update_vector ** 2)))
            emit("LOCAL_UPDATE_GENERATED", f"{node.org_name}: model update generated (‖Δ‖ = {norm:.4f})",
                 participantId=node.slug, participantName=node.org_name,
                 data={"sampleCount": result.sample_count, "localMetrics": result.local_metrics, "updateNorm": R2(norm, 6)})

            mask = self.aggregator.participant_mask(node.slug, counts, round_seed, len(result.update_vector))
            masked_vec = result.update_vector + mask
            payload_json = json.dumps([float(v) for v in masked_vec])
            encrypted, size_bytes = False, len(payload_json.encode())
            if config.privacy_mode == "ENCRYPTION":
                enc = self.encryption.encrypt(payload_json)
                payload_json = self.encryption.payload_to_json(enc)
                encrypted, size_bytes = True, enc.bytes
            emit("UPDATE_ENCRYPTED", f"{node.org_name}: update {'encrypted (AES-256-GCM) + masked' if encrypted else 'masked (secure aggregation)'} — hash {result.update_hash[:18]}…",
                 participantId=node.slug, participantName=node.org_name,
                 data={"algo": "AES-256-GCM + additive mask" if encrypted else "additive mask (zero-sum)",
                       "updateHash": result.update_hash, "bytes": size_bytes})
            emit("UPDATE_SUBMITTED", f"{node.org_name}: protected update submitted to aggregator",
                 participantId=node.slug, participantName=node.org_name,
                 data={"updateHash": result.update_hash, "sampleCount": result.sample_count})
            subs.append({"node": node, "result": result, "masked": masked_vec, "encrypted": encrypted,
                         "sizeBytes": size_bytes, "payload": payload_json, "globalBefore": before[node.slug],
                         "norm": norm})

        # 4. SECURE AGGREGATION (masks cancel — only the aggregate is recoverable)
        emit("SECURE_AGGREGATION", f"Secure aggregation of {len(subs)} protected updates (masks cancel — individual updates never visible)",
             data={"participants": len(subs), "zeroSum": True})
        aggregate_vec = self.aggregator.aggregate_masked([s["masked"] for s in subs], [s["result"].sample_count for s in subs])
        aggregate_delta = unflatten_weights(aggregate_vec, global_model.config.input_dim, global_model.config.hidden_dim)

        # 5. GLOBAL_MODEL_UPDATED + real evaluation
        new_model = global_model.clone()
        new_model.set_weights(apply_delta(global_model.weights, aggregate_delta))
        evals_after = [n.evaluate_on_local_test(new_model) for n in nodes]
        total_after = sum(e["n"] for e in evals_after) or 1
        metrics_after = sum(e["primary"] * e["n"] / total_after for e in evals_after)
        improvement = metrics_after - metrics_before
        keys = list(evals_after[0]["metrics"].keys())
        avg_metrics = {k: R2(sum(e["metrics"][k] * e["n"] / total_after for e in evals_after), 4) for k in keys}
        per_participant = [{"organization": s["node"].org_name, "metrics": e["metrics"], "primary": R2(e["primary"], 4)}
                           for s, e in zip(subs, evals_after)]
        weights_json = serialize_weights(new_model.weights)
        model_hash = "0x" + hashlib.sha256(f"{weights_json}::{spec['slug']}::{round_number}".encode()).hexdigest()
        new_version = f"v1.{round_number}"
        metric_name = "R²" if task == "REGRESSION" else "accuracy"
        emit("GLOBAL_MODEL_UPDATED", f"Global model updated → {new_version} — {metric_name} {metrics_after * 100:.1f}% ({improvement:+.1f} pts)",
             data={"newVersion": new_version, "accuracy": R2(metrics_after, 4), "improvement": R2(improvement, 4),
                   "metrics": avg_metrics, "perParticipant": per_participant, "modelHash": model_hash})

        # 6. CONTRIBUTION SCORING + REWARDS (real training telemetry)
        emit("REWARD_CALCULATED", f"Computing transparent contribution scores and allocating the {ROUND_REWARD_POOL} DATA round reward pool")
        contributions = [{
            "participantId": s["node"].slug, "organizationName": s["node"].org_name, "roundNumber": round_number,
            "sampleCount": s["result"].sample_count,
            "quality": CLAMP(max(0.0, s["result"].local_primary) if task == "REGRESSION" else s["result"].local_primary),
            "improvement": max(0.0, 0.5 + (s["result"].local_primary - s["globalBefore"])),
            "participation": (min(1.0, state["participation"].get(s["node"].slug, 0) / max(1, round_number - 1))
                              if round_number > 1 else 1.0),
        } for s in subs]
        scored = score_contributions(contributions)
        emit("REWARD_CALCULATED", "Rewards allocated: " + " · ".join(f"{s['organizationName']} {s['rewardAmount']:.0f} DATA" for s in scored),
             data={"rewards": [{"org": s["organizationName"], "score": s["normalizedScore"], "reward": s["rewardAmount"]} for s in scored],
                   "pool": ROUND_REWARD_POOL})

        # 7. BLOCKCHAIN RECORDING (PoW hash chain, local test network)
        emit("BLOCKCHAIN_RECORDED", "Recording contribution proofs and reward allocations on the local test network")
        txs: List[Dict] = []
        for s, sc in zip(subs, scored):
            common = {"from": PLATFORM_WALLET, "to": derive_wallet_address(s["node"].slug), "roundNumber": round_number,
                      "model": spec["name"], "participant": s["node"].org_name}
            txs.append({**common, "action": "RECORD_CONTRIBUTION", "amount": 0,
                        "metadata": {"updateHash": s["result"].update_hash, "samples": s["result"].sample_count,
                                     "score": sc["normalizedScore"]}})
            txs.append({**common, "action": "ALLOCATE_REWARD", "amount": sc["rewardAmount"],
                        "metadata": {"pool": ROUND_REWARD_POOL}})
        tx_hashes = [tx_hash(t, i) for i, t in enumerate(txs)]
        header = f"{state.get('lastBlockHash', '0x' + '0' * 64)}|{spec['slug']}|{round_number}|{json.dumps(tx_hashes)}"
        block = mine_block(header)
        block_number = int(state.get("blocks", 0)) + 1
        emit("BLOCKCHAIN_RECORDED", f"Block #{block_number} mined with {len(txs)} transactions — contribution proofs anchored on-chain",
             data={"blockNumber": block_number, "txHashes": tx_hashes, "blockHash": block["hash"], "nonce": block["nonce"]})

        # 8. ROUND_COMPLETED
        duration_ms = int((time.time() - t0) * 1000)
        emit("ROUND_COMPLETED", f"Round #{round_number} complete — {metric_name} {metrics_after * 100:.1f}%, rewards on-chain in block #{block_number}",
             data={"accuracy": R2(metrics_after, 4), "improvement": R2(improvement, 4), "blockNumber": block_number,
                   "durationMs": duration_ms,
                   "rewards": [{"org": s["organizationName"], "amount": s["rewardAmount"]} for s in scored]})

        participation = {**state.get("participation", {}),
                         **{s["node"].slug: state.get("participation", {}).get(s["node"].slug, 0) + 1 for s in subs}}
        state.update({"version": new_version, "accuracy": R2(metrics_after, 4),
                      "rounds": max(int(state.get("rounds", 0)), round_number), "blocks": block_number,
                      "lastBlockHash": block["hash"], "participation": participation, "weights": new_model.serialize()})
        self._save_state(spec["slug"], state)
        self.rounds_completed += 1

        return {
            "model": spec["slug"], "modelName": spec["name"], "taskType": task, "roundNumber": round_number,
            "status": "COMPLETED", "actor": actor, "config": {"epochs": config.epochs, "batchSize": config.batch_size,
            "lr": config.lr, "privacyMode": config.privacy_mode},
            "metrics": {"before": R2(metrics_before, 4), "after": R2(metrics_after, 4), "improvement": R2(improvement, 4),
                        "primaryMetric": "r2" if task == "REGRESSION" else "accuracy", "avg": avg_metrics,
                        "perParticipant": per_participant, "testSamples": total_after},
            "participants": [{"participantId": s["node"].slug, "organization": s["node"].org_name,
                              "sampleCount": s["result"].sample_count, "localMetrics": s["result"].local_metrics,
                              "updateHash": s["result"].update_hash, "encrypted": s["encrypted"],
                              "sizeBytes": s["sizeBytes"], "updateNorm": R2(s["norm"], 6),
                              "durationMs": s["result"].duration_ms, "walletAddress": derive_wallet_address(s["node"].slug)} for s in subs],
            "rewards": scored, "blockchain": {"blockNumber": block_number, "blockHash": block["hash"], "txHashes": tx_hashes,
                                              "transactions": txs},
            "globalModel": {"version": new_version, "modelHash": model_hash, "paramCount": new_model.weights.param_count()},
            "events": events, "durationMs": duration_ms, "privacy": backends_status(),
        }
