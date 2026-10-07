"""/api/audit — hash-chained audit trail (spec §21, §52)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AuditLog, get_db
from app.services.audit import verify_chain

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
async def list_audit(event_type: Optional[str] = None, actor: Optional[str] = None,
                     limit: int = 100, offset: int = 0, verify: bool = False,
                     db: AsyncSession = Depends(get_db)) -> dict:
    query = select(AuditLog)
    if event_type:
        query = query.where(AuditLog.event_type == event_type.upper())
    if actor:
        query = query.where(AuditLog.actor == actor)
    total = (await db.execute(select(func.count(AuditLog.id)).select_from(AuditLog))).scalar_one()
    rows = (await db.execute(query.order_by(AuditLog.seq.desc())
            .limit(min(limit, 500)).offset(max(offset, 0)))).scalars().all()
    payload = {
        "events": [{
            "id": e.id, "seq": e.seq, "actor": e.actor, "actorRole": e.actor_role,
            "organization": e.organization, "eventType": e.event_type, "resource": e.resource,
            "status": e.status, "metadata": e.metadata_json, "payloadHash": e.payload_hash,
            "prevHash": e.prev_hash, "entryHash": e.entry_hash, "createdAt": e.created_at.isoformat(),
        } for e in rows],
        "total": int(total or 0),
        "chain": await verify_chain(db) if verify else None,
    }
    return payload
