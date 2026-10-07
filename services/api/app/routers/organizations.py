"""/api/organizations — list + create (spec §24, §11)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import User, require_admin
from app.db import Dataset, Organization, User, Wallet, get_db
from app.services.audit import audit
from app.services.seed import derive_wallet_address

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    type: str = ""
    industry: str = ""
    location: str = ""
    domain: str = "RESEARCH"
    description: str = ""


async def _serialize(db: AsyncSession, org: Organization) -> dict:
    wallet = (await db.execute(select(Wallet).where(Wallet.organization_id == org.id))).scalar_one_or_none()
    users = (await db.execute(select(func.count(User.id)).where(User.organization_id == org.id))).scalar_one()
    datasets = (await db.execute(select(func.count(Dataset.id)).where(Dataset.owner_id == org.id))).scalar_one()
    return {
        "id": org.id, "name": org.name, "slug": org.slug, "type": org.type, "industry": org.industry,
        "location": org.location, "domain": org.domain, "description": org.description, "status": org.status,
        "createdAt": org.created_at.isoformat(), "userCount": int(users or 0), "datasetCount": int(datasets or 0),
        "wallet": ({"address": wallet.address, "pending": float(wallet.pending),
                    "totalEarned": float(wallet.total_earned), "claimed": float(wallet.claimed)}
                   if wallet else None),
    }


@router.get("")
async def list_organizations(domain: str | None = None, db: AsyncSession = Depends(get_db)) -> dict:
    query = select(Organization).order_by(Organization.created_at.asc(), Organization.name.asc())
    if domain:
        query = query.where(Organization.domain == domain.upper())
    orgs = (await db.execute(query)).scalars().all()
    return {"organizations": [await _serialize(db, o) for o in orgs], "count": len(orgs)}


@router.get("/{org_id}")
async def get_organization(org_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    org = (await db.execute(select(Organization).where(
        (Organization.id == org_id) | (Organization.slug == org_id)))).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return await _serialize(db, org)


@router.post("", status_code=201)
async def create_organization(body: OrganizationCreate, db: AsyncSession = Depends(get_db),
                              admin: User = Depends(require_admin)) -> dict:
    clash = (await db.execute(select(Organization).where(Organization.slug == body.slug))).scalar_one_or_none()
    if clash:
        raise HTTPException(status_code=409, detail=f"Slug {body.slug!r} already exists")
    if body.domain not in ("HEALTHCARE", "FINANCE", "AGRICULTURE", "RESEARCH"):
        raise HTTPException(status_code=400, detail="domain must be HEALTHCARE|FINANCE|AGRICULTURE|RESEARCH")
    org = Organization(id=f"org_{body.slug.replace('-', '_')}", name=body.name, slug=body.slug,
                       type=body.type, industry=body.industry, location=body.location,
                       domain=body.domain, description=body.description, status="ACTIVE")
    db.add(org)
    db.add(Wallet(id=f"wal_{body.slug.replace('-', '_')}", address=derive_wallet_address(body.slug),
                  organization_id=org.id))
    await audit(db, admin.email, "ORGANIZATION_REGISTERED", actor_role=admin.role,
                resource=body.name, metadata={"slug": body.slug, "domain": body.domain})
    await db.commit()
    return await _serialize(db, org)
