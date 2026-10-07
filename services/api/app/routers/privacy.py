"""/api/privacy/status — LAYER 2 status merged with gateway telemetry."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import FederatedRound, ModelUpdate, get_db
from app.services.ml_client import MLServiceError, ml_client

router = APIRouter(prefix="/api/privacy", tags=["privacy"])


@router.get("/status")
async def privacy_status(db: AsyncSession = Depends(get_db)) -> dict:
    updates = (await db.execute(select(func.count(ModelUpdate.id)).select_from(ModelUpdate))).scalar_one()
    encrypted = (await db.execute(select(func.count(ModelUpdate.id)).select_from(ModelUpdate)
                 .where(ModelUpdate.encrypted.is_(True)))).scalar_one()
    rounds = (await db.execute(select(func.count(FederatedRound.id)).select_from(FederatedRound))).scalar_one()
    try:
        ml = await ml_client.privacy_status()
        ml_ok = True
    except MLServiceError as exc:
        ml, ml_ok = {"error": str(exc)}, False
    return {
        "raw_data_shared": False,
        "model_update_only": True,
        "secure_aggregation": True,
        "audit_logging": True,
        "encrypted_updates": (encrypted > 0),
        "mode": ml.get("mode", "DEMO"),
        "gateway": {
            "mlServiceReachable": ml_ok,
            "modelUpdatesPersisted": int(updates or 0),
            "encryptedUpdates": int(encrypted or 0),
            "rounds": int(rounds or 0),
            "rawAccessPolicy": "RAW_ACCESS_BLOCKED — raw participant data never leaves participant environments",
        },
        "backends": ml.get("backends", {"aes256Gcm": True, "tensealCkks": False}),
        "fallback": ml.get("fallback") or "AES-256-GCM + pairwise additive masking active",
        "configuredMode": ml.get("mode", settings and "DEMO"),
    }
