"""Environment settings for the DataVault API gateway."""
from __future__ import annotations

import os

API_PORT = 8000
ROLES = ("ADMIN", "ORG_ADMIN", "ML_OPERATOR", "PARTICIPANT", "VIEWER")


def _env(key: str, default: str) -> str:
    return os.getenv(key, default)


class Settings:
    def __init__(self) -> None:
        self.database_url: str = _env("DATABASE_URL", "postgresql+asyncpg://datavault:datavault@localhost:5432/datavault")
        self.jwt_secret: str = _env("JWT_SECRET", "datavault-dev-secret-change-me-please-32b")
        self.jwt_algorithm: str = "HS256"
        self.jwt_expires_hours: int = int(_env("JWT_EXPIRES_HOURS", "24"))
        self.ml_service_url: str = _env("ML_SERVICE_URL", "http://localhost:8001").rstrip("/")
        self.seed_demo: bool = _env("SEED_DEMO", "true").lower() in ("1", "true", "yes")
        self.round_reward_pool: int = int(_env("ROUND_REWARD_POOL", "1000"))
        self.blockchain_rpc_url: str = _env("BLOCKCHAIN_RPC_URL", "")  # optional Hardhat node
        self.host: str = _env("HOST", "0.0.0.0")
        self.port: int = int(_env("PORT", str(API_PORT)))

    def async_database_url(self) -> str:
        """Normalize DATABASE_URL for SQLAlchemy async drivers.

        postgres:// / postgresql:// → postgresql+asyncpg (production, Docker)
        sqlite://                   → sqlite+aiosqlite (local dev)
        file:/path (Prisma-style)   → sqlite+aiosqlite fallback (dev sandbox)
        """
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("sqlite://"):
            return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        if url.startswith("file:"):
            path = url[5:]
            return f"sqlite+aiosqlite:///{path.lstrip('/')}" if path.startswith("/") else f"sqlite+aiosqlite:///{path}"
        return url


settings = Settings()
