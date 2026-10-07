"""/api/blockchain/transactions — proof explorer from the DB (spec §22, §24)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import BlockchainTransaction, get_db

router = APIRouter(prefix="/api/blockchain", tags=["blockchain"])


@router.get("/transactions")
async def list_transactions(action: Optional[str] = None, model: Optional[str] = None,
                            participant: Optional[str] = None, round_number: Optional[int] = None,
                            limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)) -> dict:
    query = select(BlockchainTransaction)
    if action:
        query = query.where(BlockchainTransaction.action == action.upper())
    if model:
        query = query.where(BlockchainTransaction.model_name == model)
    if participant:
        query = query.where(BlockchainTransaction.participant_name == participant)
    if round_number:
        query = query.where(BlockchainTransaction.round_number == round_number)
    total = (await db.execute(select(func.count(BlockchainTransaction.id))
             .select_from(BlockchainTransaction))).scalar_one()
    rows = (await db.execute(query.order_by(BlockchainTransaction.created_at.desc())
            .limit(min(limit, 500)).offset(max(offset, 0)))).scalars().all()
    latest_block = (await db.execute(select(func.max(BlockchainTransaction.block_number)))).scalar_one_or_none() or 0
    return {
        "transactions": [{
            "id": t.id, "txHash": t.tx_hash, "from": t.from_address, "to": t.to_address,
            "action": t.action, "amount": float(t.amount), "roundNumber": t.round_number,
            "modelName": t.model_name, "participantName": t.participant_name, "metadata": t.metadata_json,
            "blockNumber": t.block_number, "createdAt": t.created_at.isoformat(),
        } for t in rows],
        "total": int(total or 0), "latestBlock": int(latest_block),
        "network": "DataVault Local Test Network (PoW-3 hash chain)",
    }
