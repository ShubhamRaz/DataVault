"""/api/auth — login (JWT HS256) + current user (spec §24, §26)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import TokenUser, create_token, get_current_user, hash_password, verify_password
from app.db import User, get_db, utcnow
from app.services.audit import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = "VIEWER"
    organization_id: Optional[str] = None


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> dict:
    user = (await db.execute(select(User).where(User.email == body.email.lower().strip()))).scalar_one_or_none()
    if not user or not user.active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user.last_login_at = utcnow()
    await audit(db, user.email, "USER_LOGIN", actor_role=user.role, organization=user.organization_id,
                resource="login", metadata={"email": user.email})
    await db.commit()
    token, exp = create_token(TokenUser(id=user.id, email=user.email, name=user.name,
                                        role=user.role, organization_id=user.organization_id))
    return {
        "token": token, "tokenType": "Bearer", "expiresAt": exp,
        "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role,
                 "organizationId": user.organization_id},
    }


@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    existing = (await db.execute(select(User).where(User.email == body.email.lower().strip()))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    if body.role not in ("VIEWER", "PARTICIPANT"):
        raise HTTPException(status_code=400, detail="Self-registration allows VIEWER or PARTICIPANT only")
    user = User(id=f"usr_{body.email.split('@')[0].replace('.', '_')}", email=body.email.lower().strip(),
                name=body.name, password_hash=hash_password(body.password), role=body.role,
                organization_id=body.organization_id)
    db.add(user)
    await audit(db, user.email, "USER_REGISTERED", actor_role=user.role, resource=user.email)
    await db.commit()
    return {"id": user.id, "email": user.email, "role": user.role}


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role,
            "organizationId": user.organization_id, "active": user.active,
            "lastLoginAt": user.last_login_at.isoformat() if user.last_login_at else None}
