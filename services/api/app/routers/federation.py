"""/api/federation/rounds — POST runs a real round via the ml-service and
persists the full trail (updates, contributions, rewards, blockchain txs,
audit); GET returns history from the DB (spec §13, §24)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import User, require_role
from app.db import (BlockchainTransaction, Contribution, FederatedRound, Model, ModelUpdate, Organization,
                    Participant, Reward, User, Wallet, get_db, utcnow)
from app.services.audit import audit
from app.services.ml_client import MLServiceError, ml_client
from app.services.seed import derive_wallet_address

router = APIRouter(prefix="/api/federation", tags=["federation"])


class RoundConfigBody(BaseModel):
    epochs: Optional[int] = Field(default=None, ge=1, le=100)
    batchSize: Optional[int] = Field(default=None, ge=1, le=512)
    lr: Optional[float] = Field(default=None, gt=0, le=1.0)
    privacyMode: Optional[str] = None


class RoundStartBody(BaseModel):
    model: str
    roundNumber: Optional[int] = Field(default=None, ge=1)
    config: Optional[RoundConfigBody] = None


def _config_dict(cfg: Optional[RoundConfigBody]) -> Optional[dict]:
    if cfg is None:
        return None
    return {k: v for k, v in {"epochs": cfg.epochs, "batchSize": cfg.batchSize,
                              "lr": cfg.lr, "privacyMode": cfg.privacyMode}.items() if v is not None}


async def _serialize_round(db: AsyncSession, rnd: FederatedRound, model: Model) -> dict:
    return {
        "id": rnd.id, "modelId": rnd.model_id, "modelName": model.name, "modelSlug": model.slug,
        "roundNumber": rnd.round_number, "status": rnd.status, "config": rnd.config,
        "privacyMode": rnd.privacy_mode, "metricsBefore": rnd.metrics_before,
        "metricsAfter": rnd.metrics_after, "improvement": rnd.improvement,
        "encryptedUpdates": rnd.encrypted_updates, "aggregateMetrics": rnd.aggregate_metrics,
        "durationMs": rnd.duration_ms, "error": rnd.error,
        "startedAt": rnd.started_at.isoformat(), "completedAt": rnd.completed_at.isoformat() if rnd.completed_at else None,
    }


@router.get("/rounds")
async def list_rounds(model: Optional[str] = None, status: Optional[str] = None,
                      limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)) -> dict:
    query = select(FederatedRound, Model).join(Model, FederatedRound.model_id == Model.id)
    if model:
        query = query.where((Model.slug == model) | (Model.id == model))
    if status:
        query = query.where(FederatedRound.status == status.upper())
    total = (await db.execute(select(func.count(FederatedRound.id)).select_from(FederatedRound)
             .join(Model, FederatedRound.model_id == Model.id))
             if not model else
             await db.execute(select(func.count(FederatedRound.id)).select_from(FederatedRound)
             .join(Model, FederatedRound.model_id == Model.id)
             .where((Model.slug == model) | (Model.id == model)))).scalar_one()
    rows = (await db.execute(query.order_by(FederatedRound.started_at.desc()).limit(min(limit, 200)).offset(max(offset, 0)))).all()
    return {"rounds": [await _serialize_round(db, r, m) for r, m in rows], "total": int(total or 0)}


@router.get("/rounds/{round_id}")
async def get_round(round_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    row = (await db.execute(select(FederatedRound, Model).join(Model, FederatedRound.model_id == Model.id)
            .where(FederatedRound.id == round_id))).first()
    if not row:
        raise HTTPException(status_code=404, detail="Round not found")
    rnd, model = row
    updates = (await db.execute(select(ModelUpdate).where(ModelUpdate.round_id == rnd.id))).scalars().all()
    rewards = (await db.execute(select(Reward).where(Reward.round_id == rnd.id))).scalars().all()
    contributions = (await db.execute(select(Contribution).where(Contribution.round_id == rnd.id))).scalars().all()
    txs = (await db.execute(select(BlockchainTransaction).where(BlockchainTransaction.round_number == rnd.round_number))).scalars().all()
    payload = await _serialize_round(db, rnd, model)
    payload["updates"] = [{"participantId": u.participant_id, "organization": u.organization_name,
                           "sampleCount": u.sample_count, "updateHash": u.update_hash, "encrypted": u.encrypted,
                           "privacyMode": u.privacy_mode, "sizeBytes": u.size_bytes,
                           "updateNorm": float(u.update_norm), "metrics": u.metrics} for u in updates]
    payload["contributions"] = [{"participantId": c.participant_id, "roundNumber": c.round_number,
                                 "sampleCount": c.sample_count, "rawScore": float(c.raw_score),
                                 "normalizedScore": float(c.normalized_score), "sampleShare": float(c.sample_share),
                                 "qualityScore": float(c.quality_score), "improvementScore": float(c.improvement_score),
                                 "participationScore": float(c.participation_score)} for c in contributions]
    payload["rewards"] = [{"id": r.id, "participantId": r.participant_id, "organization": r.organization_name,
                           "amount": float(r.amount), "score": float(r.score), "status": r.status,
                           "txHash": r.tx_hash} for r in rewards]
    payload["transactions"] = [{"txHash": t.tx_hash, "action": t.action, "amount": float(t.amount),
                                "from": t.from_address, "to": t.to_address, "blockNumber": t.block_number} for t in txs]
    return payload


@router.post("/rounds")
async def start_round(body: RoundStartBody, db: AsyncSession = Depends(get_db),
                      actor: User = Depends(require_role("ML_OPERATOR"))) -> dict:
    model = (await db.execute(select(Model).where((Model.slug == body.model) | (Model.id == body.model)))).scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail=f"Model {body.model!r} not found")

    round_number = body.roundNumber
    if round_number is None:
        last = (await db.execute(select(func.max(FederatedRound.round_number))
                 .where(FederatedRound.model_id == model.id))).scalar_one_or_none()
        round_number = int(last or 0) + 1

    try:
        result = await ml_client.run_round(model.slug, round_number, _config_dict(body.config), actor.email)
    except MLServiceError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc

    rnd = FederatedRound(id=f"rnd_{model.slug}_{round_number}", model_id=model.id, round_number=round_number,
                         status=result.get("status", "COMPLETED"), config=result.get("config"),
                         privacy_mode=result.get("config", {}).get("privacyMode", "DEMO"),
                         metrics_before=result["metrics"]["before"], metrics_after=result["metrics"]["after"],
                         improvement=result["metrics"]["improvement"],
                         encrypted_updates=sum(1 for p in result["participants"] if p["encrypted"]),
                         aggregate_metrics={"global": result["metrics"]["avg"],
                                            "perParticipant": result["metrics"]["perParticipant"],
                                            "samples": result["metrics"]["testSamples"]},
                         duration_ms=result["durationMs"], completed_at=utcnow())
    db.add(rnd)
    await audit(db, actor.email, "ROUND_STARTED", actor_role=actor.role,
                resource=f"{model.name} #{round_number}", metadata={"roundId": rnd.id, "model": model.slug})

    orgs = {o.slug: o for o in (await db.execute(select(Organization).where(
        Organization.slug.in_([p["participantId"] for p in result["participants"]])))).scalars().all()}
    reward_rows = []
    parts_by_org = {}
    if orgs:
        part_rows = (await db.execute(select(Participant, Organization)
                     .join(Organization, Participant.organization_id == Organization.id)
                     .where(Participant.model_id == model.id,
                            Organization.slug.in_(list(orgs.keys()))))).all()
        parts_by_org = {o.slug: p for p, o in part_rows}

    def _participant_id(pslug: str) -> str:
        part = parts_by_org.get(pslug)
        return part.id if part else f"prt_{model.slug}_{pslug}"

    for p in result["participants"]:
        pslug = p["participantId"]
        part = parts_by_org.get(pslug)
        if part:
            part.rounds_participated += 1
            part.last_round_at = utcnow()
        db.add(ModelUpdate(id=f"upd_{model.slug}_{round_number}_{pslug}", round_id=rnd.id,
                           participant_id=_participant_id(pslug),
                           organization_name=p["organization"], sample_count=p["sampleCount"],
                           update_hash=p["updateHash"], encrypted=p["encrypted"],
                           privacy_mode=result["config"].get("privacyMode", "DEMO"),
                           size_bytes=p["sizeBytes"], update_norm=p["updateNorm"], metrics=p["localMetrics"]))
        await audit(db, p["organization"], "UPDATE_SUBMITTED", organization=p["organization"],
                    resource=f"round #{round_number}",
                    metadata={"updateHash": p["updateHash"], "samples": p["sampleCount"]})

    for sc in result["rewards"]:
        pslug = sc["participantId"]
        part = parts_by_org.get(pslug)
        if part:
            part.lifetime_score = round(float(part.lifetime_score) + sc["normalizedScore"], 6)
        db.add(Contribution(id=f"ctr_{model.slug}_{round_number}_{pslug}", round_id=rnd.id,
                            participant_id=_participant_id(pslug),
                            round_number=round_number, sample_count=sc["sampleCount"], raw_score=sc["rawScore"],
                            normalized_score=sc["normalizedScore"], sample_share=sc["sampleShare"],
                            quality_score=sc["qualityScore"], improvement_score=sc["improvementScore"],
                            participation_score=sc["participationScore"]))
        reward = Reward(id=f"rew_{model.slug}_{round_number}_{pslug}", round_id=rnd.id,
                        participant_id=_participant_id(pslug),
                        organization_name=sc["organizationName"], round_number=round_number,
                        amount=sc["rewardAmount"], score=sc["normalizedScore"], status="AVAILABLE")
        db.add(reward)
        reward_rows.append((reward, sc["organizationName"]))
        org = orgs.get(pslug)
        if org:
            wallet = (await db.execute(select(Wallet).where(Wallet.organization_id == org.id))).scalar_one_or_none()
            if wallet:
                wallet.pending = round(float(wallet.pending) + sc["rewardAmount"], 2)
                wallet.total_earned = round(float(wallet.total_earned) + sc["rewardAmount"], 2)

    blockchain = result.get("blockchain", {})
    reward_txs = {}
    for i, tx in enumerate(blockchain.get("transactions", [])):
        tx_hash = blockchain["txHashes"][i]
        db.add(BlockchainTransaction(id=f"tx_{model.slug}_{round_number}_{i}",
                                     tx_hash=tx_hash, from_address=tx["from"], to_address=tx["to"],
                                     action=tx["action"], amount=tx["amount"], round_number=round_number,
                                     model_name=model.name, participant_name=tx.get("participant"),
                                     metadata_json=tx.get("metadata"), block_number=blockchain.get("blockNumber", 1)))
        if tx["action"] == "ALLOCATE_REWARD":
            reward_txs[tx.get("participant")] = tx_hash
    for reward, org_name in reward_rows:
        reward.tx_hash = reward_txs.get(org_name)

    await audit(db, "ml-service", "AGGREGATION_COMPLETED", resource=f"{model.name} #{round_number}",
                metadata={"newVersion": result["globalModel"]["version"], "accuracy": result["metrics"]["after"]})
    await audit(db, "blockchain-service", "BLOCKCHAIN_RECORDED", resource=f"round #{round_number}",
                metadata={"blockNumber": blockchain.get("blockNumber"), "txs": len(blockchain.get("txHashes", []))})
    await audit(db, actor.email, "ROUND_COMPLETED", actor_role=actor.role, resource=f"{model.name} #{round_number}",
                metadata={"accuracy": result["metrics"]["after"], "improvement": result["metrics"]["improvement"]})

    model.current_version = result["globalModel"]["version"]
    model.current_accuracy = result["metrics"]["after"]
    model.model_hash = result["globalModel"]["modelHash"]
    await db.commit()
    return {**result, "roundId": rnd.id, "roundStatus": rnd.status}
