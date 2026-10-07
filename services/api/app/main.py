"""DataVault API gateway — FastAPI (port 8000, spec §24).

Routers: /api/auth, /api/organizations, /api/models, /api/federation,
/api/privacy, /api/rewards, /api/blockchain, /api/audit, /api/dashboard.
Federated compute is delegated to the ml-service (ML_SERVICE_URL); metadata,
rewards, proofs and the audit chain live in PostgreSQL.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import SessionLocal, engine, init_db
from app.routers import audit as audit_router
from app.routers import auth as auth_router
from app.routers import blockchain as blockchain_router
from app.routers import dashboard as dashboard_router
from app.routers import federation as federation_router
from app.routers import models as models_router
from app.routers import organizations as orgs_router
from app.routers import privacy as privacy_router
from app.routers import rewards as rewards_router
from app.services.seed import seed_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    if settings.seed_demo:
        async with SessionLocal() as session:
            await seed_if_empty(session)
    yield
    await engine.dispose()


app = FastAPI(title="DataVault API", version="1.0.0",
              description="Privacy-First AI Marketplace — federated learning gateway",
              lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

for router in (auth_router, orgs_router, models_router, federation_router,
               privacy_router, rewards_router, blockchain_router, audit_router,
               dashboard_router):
    app.include_router(router.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "api", "version": "1.0.0",
            "mlServiceUrl": settings.ml_service_url}
