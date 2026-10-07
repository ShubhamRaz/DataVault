"""/api/rewards — list + claim (spec §6, §37)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import User, get_current_user, require_role
from app.db import FederatedRound, Model, Participant, Reward, User, Wallet, get_db, utcnow
from app.services.audit import audit
from app.services.ml_client import ml_client
from app.config import settings

router = APIRouter(prefix="/api/rewards", tags=["rewards"])


class ClaimRequest(BaseModel):
    rewardId: str


async def _serialize(db: AsyncSession, r: Reward) -> dict:
    row = (await db.execute(select(Reward, Participant, FederatedRound, Model)
            .join(Participant, Reward.participant_id == Participant.id)
            .join(FederatedRound, Reward.round_id == FederatedRound.id)
            .join(Model, FederatedRound.model_id == Model.id)
            .where(Reward.id == r.id))).first()
    _, _, rnd, model = row if row else (None, None, None, None)
    return {
        "id": r.id, "roundId": r.round_id, "roundNumber": r.round_number,
        "modelName": model.name if model else None, "participantId": r.participant_id,
        "organization": r.organization_name, "amount": float(r.amount), "score": float(r.score),
        "status": r.status, "txHash": r.tx_hash,
        "claimedAt": r.claimed_at.isoformat() if r.claimed_at else None,
        "createdAt": r.created_at.isoformat(),
    }


@router.get("")
async def list_rewards(status: Optional[str] = None, organization: Optional[str] = None,
                       limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)) -> dict:
    query = select(Reward)
    if status:
        query = query.where(Reward.status == status.upper())
    if organization:
        query = query.where(Reward.organization_name == organization)
    total = (await db.execute(select(func.count(Reward.id)).select_from(Reward))).scalar_one()
    rows = (await db.execute(query.order_by(Reward.created_at.desc())
            .limit(min(limit, 500)).offset(max(offset, 0)))).scalars().all()
    return {"rewards": [await _serialize(db, r) for r in rows], "total": int(total or 0),
            "poolPerRound": settings.round_reward_pool}


@router.post("/claim")
async def claim_reward(body: ClaimRequest, db: AsyncSession = Depends(get_db),
                       user: User = Depends(require_role("PARTICIPANT"))) -> dict:
    reward = (await db.execute(select(Reward).where(Reward.id == body.rewardId))).scalar_one_or_none()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    if reward.status == "CLAIMED":
        raise HTTPException(status_code=409, detail="Reward already claimed")

    part = (await db.execute(select(Participant).where(Participant.id == reward.participant_id))).scalar_one_or_none()
    own = part and (part.organization_id == user.organization_id)
    if not own and user.role not in ("ADMIN", "ML_OPERATOR"):
        raise HTTPException(status_code=403, detail="Only the owning organization (or an admin) may claim this reward")

    reward.status = "CLAIMED"
    reward.claimed_at = utcnow()
    if part:
        wallet = (await db.execute(select(Wallet).where(Wallet.organization_id == part.organization_id))).scalar_one_or_none()
        if wallet:
            amount = float(reward.amount)
            wallet.pending = round(max(0.0, float(wallet.pending) - amount), 2)
            wallet.claimed = round(float(wallet.claimed) + amount, 2)
    try:  # notify the ml-service so its registry state stays consistent
        await ml_client.health()
    except Exception:
        pass
    await audit(db, user.email, "REWARD_CLAIMED", actor_role=user.role,
                resource=f"{reward.organization_name} reward {reward.id}",
                metadata={"amount": float(reward.amount), "roundNumber": reward.round_number})
    await db.commit()
    return {"id": reward.id, "status": reward.status, "amount": float(reward.amount),
            "claimedAt": reward.claimed_at.isoformat(), "txHash": reward.tx_hash}
