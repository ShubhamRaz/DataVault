"""/api/models — list + create (creation validates against the ml-service)."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import User, require_role
from app.db import Model, Organization, Participant, get_db
from app.services.audit import audit
from app.services.ml_client import MLServiceError, ml_client

router = APIRouter(prefix="/api/models", tags=["models"])


class ModelCreate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    useCase: str = ""
    industry: str = ""
    taskType: str = "CLASSIFICATION"
    description: str = ""
    participants: List[str] = Field(min_length=1)  # organization slugs


async def _serialize(db: AsyncSession, model: Model) -> dict:
    parts = (await db.execute(
        select(Participant, Organization).join(Organization, Participant.organization_id == Organization.id)
        .where(Participant.model_id == model.id))).all()
    return {
        "id": model.id, "name": model.name, "slug": model.slug, "useCase": model.use_case,
        "industry": model.industry, "taskType": model.task_type, "description": model.description,
        "status": model.status, "currentVersion": model.current_version,
        "currentAccuracy": model.current_accuracy, "modelHash": model.model_hash,
        "createdAt": model.created_at.isoformat(),
        "participants": [{"participantId": p.id, "organization": o.name, "slug": o.slug,
                          "status": p.status, "roundsParticipated": p.rounds_participated,
                          "lifetimeScore": float(p.lifetime_score)} for p, o in parts],
    }


@router.get("")
async def list_models(industry: Optional[str] = None, db: AsyncSession = Depends(get_db)) -> dict:
    query = select(Model).order_by(Model.created_at.asc())
    if industry:
        query = query.where(Model.industry == industry)
    models = (await db.execute(query)).scalars().all()
    return {"models": [await _serialize(db, m) for m in models], "count": len(models)}


@router.get("/{model_id}")
async def get_model(model_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    model = (await db.execute(select(Model).where((Model.id == model_id) | (Model.slug == model_id)))).scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return await _serialize(db, model)


@router.post("", status_code=201)
async def create_model(body: ModelCreate, db: AsyncSession = Depends(get_db),
                       operator: User = Depends(require_role("ML_OPERATOR"))) -> dict:
    if body.taskType not in ("CLASSIFICATION", "REGRESSION"):
        raise HTTPException(status_code=400, detail="taskType must be CLASSIFICATION or REGRESSION")
    clash = (await db.execute(select(Model).where(Model.slug == body.slug))).scalar_one_or_none()
    if clash:
        raise HTTPException(status_code=409, detail=f"Model slug {body.slug!r} already exists")

    # cross-check the federated registry in the ml-service (participants + dims)
    registry = {}
    try:
        registry = {m["slug"]: m for m in (await ml_client.list_models()).get("models", [])}
    except MLServiceError:
        registry = {}
    known = registry.get(body.slug)
    if known and known["taskType"] != body.taskType:
        raise HTTPException(status_code=400, detail="taskType disagrees with the ml-service registry")

    orgs = (await db.execute(select(Organization).where(Organization.slug.in_(body.participants)))).scalars().all()
    if len(orgs) != len(set(body.participants)):
        missing = set(body.participants) - {o.slug for o in orgs}
        raise HTTPException(status_code=400, detail=f"Unknown participant organizations: {sorted(missing)}")

    model = Model(id=f"mdl_{body.slug.replace('-', '_')}", name=body.name, slug=body.slug,
                  use_case=body.useCase, industry=body.industry, task_type=body.taskType,
                  description=body.description)
    db.add(model)
    for org in orgs:
        db.add(Participant(id=f"prt_{body.slug.replace('-', '_')}_{org.slug.replace('-', '_')}",
                           model_id=model.id, organization_id=org.id))
    await audit(db, operator.email, "MODEL_CREATED", actor_role=operator.role, resource=body.name,
                metadata={"slug": body.slug, "taskType": body.taskType, "participants": body.participants})
    await db.commit()
    return await _serialize(db, model)
