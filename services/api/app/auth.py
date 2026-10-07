"""Auth: scrypt password hashing + JWT HS256 + RBAC (spec §26, §8).

Roles: ADMIN > ORG_ADMIN > ML_OPERATOR > PARTICIPANT > VIEWER.
Tokens are `Authorization: Bearer <jwt>` (HS256, PyJWT).
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import User, get_db

ROLE_LEVELS = {"ADMIN": 5, "ORG_ADMIN": 4, "ML_OPERATOR": 3, "PARTICIPANT": 2, "VIEWER": 1}
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2 ** 14, 8, 1


# ── scrypt password hashing (mirrors the TS engine's scheme) ─────────────────

def hash_password(password: str, salt: Optional[bytes] = None) -> str:
    salt = salt or os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=64)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_hex, dk_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        dk = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex),
                            n=int(n), r=int(r), p=int(p), dklen=len(bytes.fromhex(dk_hex)))
        return hmac.compare_digest(dk, bytes.fromhex(dk_hex))
    except Exception:
        return False


# ── JWT (HS256) ───────────────────────────────────────────────────────────────

@dataclass
class TokenUser:
    id: str
    email: str
    name: str
    role: str
    organization_id: Optional[str]


def create_token(user: TokenUser) -> tuple[str, int]:
    exp = int(time.time()) + settings.jwt_expires_hours * 3600
    payload = {"sub": user.id, "email": user.email, "name": user.name, "role": user.role,
               "org": user.organization_id, "iat": int(time.time()), "exp": exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), exp


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def _extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get("datavault_token") or request.query_params.get("token")


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = (await db.execute(select(User).where(User.id == payload.get("sub")))).scalar_one_or_none()
    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def require_role(minimum: str):
    """RBAC dependency factory: requires at least `minimum` (ADMIN, ORG_ADMIN,
    ML_OPERATOR, PARTICIPANT, VIEWER)."""

    async def _check(user: User = Depends(get_current_user)) -> User:
        if ROLE_LEVELS.get(user.role, 0) < ROLE_LEVELS[minimum]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires role {minimum} or higher")
        return user

    return _check


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requires ADMIN role")
    return user
