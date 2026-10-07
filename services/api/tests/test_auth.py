"""Auth tests — scrypt hash round-trip + JWT HS256 + RBAC levels."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import jwt
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth import ROLE_LEVELS, TokenUser, create_token, decode_token, hash_password, verify_password
from app.config import settings


def test_password_hash_round_trip() -> None:
    stored = hash_password("demo1234")
    assert stored.startswith("scrypt$")
    assert "demo1234" not in stored
    assert verify_password("demo1234", stored)
    assert not verify_password("wrong-password", stored)
    assert not verify_password("demo1234 ", stored)


def test_password_hashes_are_salted() -> None:
    assert hash_password("demo1234") != hash_password("demo1234")


def test_password_verify_rejects_malformed_hashes() -> None:
    assert not verify_password("demo1234", "not-a-hash")
    assert not verify_password("demo1234", "scrypt$1$2$3$zz$yy")


def _token_user() -> TokenUser:
    return TokenUser(id="usr_admin", email="admin@datavault.demo", name="Ada Platform",
                     role="ADMIN", organization_id="org_datavault_core")


def test_jwt_round_trip() -> None:
    token, exp = create_token(_token_user())
    payload = decode_token(token)
    assert payload["sub"] == "usr_admin"
    assert payload["email"] == "admin@datavault.demo"
    assert payload["role"] == "ADMIN"
    assert payload["exp"] == exp
    assert payload["exp"] > int(time.time())


def test_jwt_signature_is_enforced() -> None:
    token, _ = create_token(_token_user())
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(token, key="wrong-secret", algorithms=["HS256"])
    with pytest.raises(jwt.InvalidTokenError):
        jwt.decode(token, key="wrong-secret", algorithms=["HS256"])


def test_jwt_expiry() -> None:
    payload = {"sub": "u", "exp": int(time.time()) - 10}
    expired = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(expired)


def test_role_hierarchy_orders_rbac() -> None:
    assert ROLE_LEVELS["ADMIN"] > ROLE_LEVELS["ORG_ADMIN"] > ROLE_LEVELS["ML_OPERATOR"] \
           > ROLE_LEVELS["PARTICIPANT"] > ROLE_LEVELS["VIEWER"]
    assert set(ROLE_LEVELS) == {"ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER"}
