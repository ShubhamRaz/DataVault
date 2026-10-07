"""Hash-chained audit log (spec §21, §52) — mirrors the TS engine.

Every entry hashes (prevHash :: JSON-stable payload) → tamper-evident trail.
The payload is JSON-stable: ``{actor, eventType, resource (null if None),
status, metadata, ts}`` serialized with sorted keys + compact separators so
write-time and verify-time bytes match exactly. Writes are serialized with an
asyncio lock so the chain can never fork under concurrent events.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AuditLog

GENESIS = "0x" + "0" * 64
_chain_lock = asyncio.Lock()


def _stable_payload(actor: str, event_type: str, resource: Optional[str], status: str,
                    metadata: Optional[Dict], ts_ms: int) -> str:
    return json.dumps(
        {"actor": actor, "eventType": event_type, "resource": resource if resource is not None else None,
         "status": status, "metadata": metadata if metadata is not None else {}, "ts": ts_ms},
        sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str,
    )


async def audit(db: AsyncSession, actor: str, event_type: str, *,
                actor_role: Optional[str] = None, organization: Optional[str] = None,
                resource: Optional[str] = None, status: str = "SUCCESS",
                metadata: Optional[Dict] = None) -> str:
    """Append one hash-chained entry. Commits are left to the caller's flow."""
    async with _chain_lock:
        last = (await db.execute(select(AuditLog).order_by(AuditLog.seq.desc()).limit(1))).scalar_one_or_none()
        prev_hash = last.entry_hash if last else GENESIS
        seq = (last.seq + 1) if last else 1
        ts_ms = int(time.time() * 1000)
        # created_at derives from the same ts so write/verify payload bytes match
        ts_dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        payload = _stable_payload(actor, event_type, resource, status, metadata, ts_ms)
        entry_hash = "0x" + hashlib.sha256(f"{prev_hash}::{payload}".encode()).hexdigest()
        db.add(AuditLog(id=f"audit_{seq:08d}", seq=seq, actor=actor, actor_role=actor_role,
                        organization=organization, event_type=event_type, resource=resource,
                        status=status, metadata_json=metadata,
                        payload_hash="0x" + hashlib.sha256(payload.encode()).hexdigest(),
                        prev_hash=prev_hash, entry_hash=entry_hash, created_at=ts_dt))
        await db.flush()
        return entry_hash


async def verify_chain(db: AsyncSession) -> Dict[str, Any]:
    entries = (await db.execute(select(AuditLog).order_by(AuditLog.seq.asc()))).scalars().all()
    prev_hash, broken = GENESIS, None
    for e in entries:
        payload = _stable_payload(e.actor, e.event_type, e.resource, e.status, e.metadata_json,
                                  int(e.created_at.timestamp() * 1000))
        recomputed = "0x" + hashlib.sha256(f"{e.prev_hash}::{payload}".encode()).hexdigest()
        if recomputed != e.entry_hash or e.prev_hash != prev_hash:
            broken = e.id
            break
        prev_hash = e.entry_hash
    return {"valid": broken is None, "entries": len(entries), "brokenAtEntry": broken}


async def latest_seq(db: AsyncSession) -> int:
    val = (await db.execute(select(func.max(AuditLog.seq)))).scalar_one_or_none()
    return int(val or 0)
