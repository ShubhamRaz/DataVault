"""DataVault ML service — FastAPI (port 8001, spec §14).

Endpoints:
  GET  /health                — liveness + backend report
  GET  /privacy/status        — LAYER 2 status (spec §5, §34)
  GET  /federation/models     — model registry + current versions
  POST /federation/rounds     — run a REAL federated round → metrics + events
  POST /datasets/regenerate   — re-create the 9 synthetic participant datasets
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import DEFAULT_ROUND_CONFIG, settings
from app.datasets.generators import MODELS, PARTICIPANT_SPECS, ensure_datasets, generate_all
from app.federation.trainer import FederatedTrainer, RoundConfig
from app.privacy.encryption import TENSEAL_AVAILABLE, try_create_ckks


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_datasets()  # generate any missing data/participants/<slug>/data.csv
    yield


app = FastAPI(title="DataVault ML Service", version="1.0.0",
              description="Privacy-first federated learning service (PyTorch, CPU only)",
              lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

trainer = FederatedTrainer(settings)


class RoundConfigPatch(BaseModel):
    epochs: Optional[int] = Field(default=None, ge=1, le=100)
    batchSize: Optional[int] = Field(default=None, ge=1, le=512)
    lr: Optional[float] = Field(default=None, gt=0, le=1.0)
    privacyMode: Optional[str] = None


class RoundRequest(BaseModel):
    model: str
    roundNumber: Optional[int] = Field(default=None, ge=1)
    config: Optional[RoundConfigPatch] = None
    actor: str = "ml-service"


def _round_config(patch: Optional[RoundConfigPatch]) -> RoundConfig:
    base = DEFAULT_ROUND_CONFIG
    cfg = RoundConfig(
        epochs=patch.epochs if patch and patch.epochs else base["epochs"],
        batch_size=patch.batchSize if patch and patch.batchSize else base["batchSize"],
        lr=patch.lr if patch and patch.lr else base["lr"],
        privacy_mode=(patch.privacyMode.upper() if patch and patch.privacyMode else base["privacyMode"]),
    )
    return cfg


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok", "service": "ml-service", "version": "1.0.0",
        "privacyMode": settings.privacy_mode,
        "participants": len(PARTICIPANT_SPECS), "models": len(MODELS),
        "roundsCompleted": trainer.rounds_completed,
    }


@app.get("/privacy/status")
def privacy_status() -> dict:
    ckks = try_create_ckks()
    return {
        "raw_data_shared": False, "model_update_only": True,
        "encrypted_updates": settings.privacy_mode == "ENCRYPTION",
        "secure_aggregation": True, "audit_logging": True,
        "mode": settings.privacy_mode,
        "backends": {"aes256Gcm": True, "tensealCkks": TENSEAL_AVAILABLE and ckks is not None},
        "fallback": None if TENSEAL_AVAILABLE else
        "TenSEAL not installed — running AES-256-GCM + pairwise additive masking (spec §64 fallback)",
    }


@app.get("/federation/models")
def federation_models() -> dict:
    out = []
    for spec in MODELS:
        state = trainer._load_state(spec["slug"])
        out.append({k: spec[k] for k in ("name", "slug", "taskType", "industry", "useCase", "participants", "seedRounds")}
                   | {"currentVersion": state["version"], "currentAccuracy": state["accuracy"],
                      "roundsRun": state["rounds"], "inputDim": len(PARTICIPANT_SPECS[spec["participants"][0]].feature_names)})
    return {"models": out}


@app.post("/federation/rounds")
def federation_round(req: RoundRequest) -> dict:
    if trainer.is_running(req.model):
        raise HTTPException(status_code=409, detail=f"A federation round is already running for {req.model}")
    round_number = req.roundNumber or (trainer._load_state(req.model)["rounds"] + 1)
    try:
        return trainer.run_round(req.model, round_number, _round_config(req.config), actor=req.actor)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/regenerate")
def datasets_regenerate() -> dict:
    return generate_all()
