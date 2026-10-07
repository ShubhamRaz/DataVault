"""/api/dashboard/stats — platform KPIs (spec §10, §24)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import (AuditLog, BlockchainTransaction, Contribution, Dataset, FederatedRound, Model,
                    ModelUpdate, Organization, Participant, Reward, User, Wallet, get_db)
from app.services.ml_client import MLServiceError, ml_client

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)) -> dict:
    count = lambda rows: int(rows or 0)  # noqa: E731

    orgs = count((await db.execute(select(func.count(Organization.id)))).scalar_one())
    users = count((await db.execute(select(func.count(User.id)))).scalar_one())
    datasets = count((await db.execute(select(func.count(Dataset.id)))).scalar_one())
    samples = count((await db.execute(select(func.sum(Dataset.sample_count)))).scalar_one())
    models = count((await db.execute(select(func.count(Model.id)))).scalar_one())
    participants = count((await db.execute(select(func.count(Participant.id)))).scalar_one())
    rounds = count((await db.execute(select(func.count(FederatedRound.id)))).scalar_one())
    rounds_completed = count((await db.execute(select(func.count(FederatedRound.id))
                              .where(FederatedRound.status == "COMPLETED"))).scalar_one())
    updates = count((await db.execute(select(func.count(ModelUpdate.id)))).scalar_one())
    encrypted = count((await db.execute(select(func.count(ModelUpdate.id))
                       .where(ModelUpdate.encrypted.is_(True)))).scalar_one())
    rewards_total = (await db.execute(select(func.count(Reward.id)))).scalar_one() or 0
    rewards_amount = float((await db.execute(select(func.sum(Reward.amount)))).scalar_one() or 0)
    rewards_claimed = float((await db.execute(select(func.sum(Reward.amount))
                            .where(Reward.status == "CLAIMED"))).scalar_one() or 0)
    txs = count((await db.execute(select(func.count(BlockchainTransaction.id)))).scalar_one())
    blocks = count((await db.execute(select(func.max(BlockchainTransaction.block_number)))).scalar_one())
    audit_events = count((await db.execute(select(func.count(AuditLog.id)))).scalar_one())
    contributions = count((await db.execute(select(func.count(Contribution.id)))).scalar_one())
    wallets_pending = float((await db.execute(select(func.sum(Wallet.pending)))).scalar_one() or 0)

    model_rows = (await db.execute(select(Model))).scalars().all()
    models_summary = [{"id": m.id, "name": m.name, "slug": m.slug, "taskType": m.task_type,
                       "status": m.status, "currentVersion": m.current_version,
                       "currentAccuracy": m.current_accuracy} for m in model_rows]
    try:
        ml_health = await ml_client.health()
    except MLServiceError:
        ml_health = None

    return {
        "organizations": orgs, "users": users,
        "datasets": {"count": datasets, "totalSamples": samples},
        "models": models, "modelsSummary": models_summary,
        "participants": participants, "contributions": contributions,
        "rounds": {"total": rounds, "completed": rounds_completed},
        "updates": {"total": updates, "encrypted": encrypted},
        "rewards": {"count": int(rewards_total), "totalAmount": rewards_amount,
                    "claimedAmount": rewards_claimed, "pendingAmount": wallets_pending},
        "blockchain": {"transactions": txs, "latestBlock": blocks,
                       "network": "DataVault Local Test Network"},
        "audit": {"events": audit_events},
        "mlService": ml_health,
    }
