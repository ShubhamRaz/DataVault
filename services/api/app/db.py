"""SQLAlchemy async ORM — core DataVault metadata tables (spec §23).

The API gateway owns metadata only: organizations, users, wallets, models,
rounds, participant telemetry, contributions, rewards, blockchain
transactions, a hash-chained audit log and system settings. Raw participant
datasets are NEVER stored here — they live in the ml-service's
``data/participants/<slug>/`` environments (spec §15).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import (JSON, Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    type: Mapped[str] = mapped_column(String(64), default="")
    industry: Mapped[str] = mapped_column(String(64), default="")
    location: Mapped[str] = mapped_column(String(64), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    domain: Mapped[str] = mapped_column(String(32), default="RESEARCH")
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Wallet(Base):
    __tablename__ = "wallets"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    address: Mapped[str] = mapped_column(String(42), unique=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    pending: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    claimed: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    email: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(32))  # ADMIN | ORG_ADMIN | ML_OPERATOR | PARTICIPANT | VIEWER
    organization_id: Mapped[Optional[str]] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Dataset(Base):
    """Dataset METADATA only — raw rows stay participant-side (spec §15)."""
    __tablename__ = "datasets"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    owner_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    domain: Mapped[str] = mapped_column(String(32))
    task: Mapped[str] = mapped_column(String(16))
    privacy_classification: Mapped[str] = mapped_column(String(32), default="RESTRICTED")
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    feature_count: Mapped[int] = mapped_column(Integer, default=0)
    target_name: Mapped[str] = mapped_column(String(64), default="")
    metadata_hash: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(64), default="REGISTERED")  # REGISTERED | ENCRYPTED_UPDATES_ONLY
    last_round_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Model(Base):
    __tablename__ = "models"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    use_case: Mapped[str] = mapped_column(Text, default="")
    industry: Mapped[str] = mapped_column(String(64), default="")
    task_type: Mapped[str] = mapped_column(String(16))  # CLASSIFICATION | REGRESSION
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    current_version: Mapped[str] = mapped_column(String(32), default="v1.0")
    current_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    model_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class FederatedRound(Base):
    __tablename__ = "federated_rounds"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id"), index=True)
    round_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="RUNNING")  # RUNNING | COMPLETED | FAILED
    config: Mapped[Optional[Dict]] = mapped_column(JSON, nullable=True)
    privacy_mode: Mapped[str] = mapped_column(String(32), default="DEMO")
    metrics_before: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metrics_after: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    improvement: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    encrypted_updates: Mapped[int] = mapped_column(Integer, default=0)
    aggregate_metrics: Mapped[Optional[Dict]] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class Participant(Base):
    __tablename__ = "participants"
    __table_args__ = (UniqueConstraint("model_id", "organization_id", name="uq_participant_model_org"),)
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id"), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    rounds_participated: Mapped[int] = mapped_column(Integer, default=0)
    lifetime_score: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_round_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class ModelUpdate(Base):
    __tablename__ = "model_updates"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    round_id: Mapped[str] = mapped_column(ForeignKey("federated_rounds.id"), index=True)
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.id"), index=True)
    organization_name: Mapped[str] = mapped_column(String(128))
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    update_hash: Mapped[str] = mapped_column(String(128))
    encrypted: Mapped[bool] = mapped_column(Boolean, default=False)
    privacy_mode: Mapped[str] = mapped_column(String(32), default="DEMO")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    update_norm: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    metrics: Mapped[Optional[Dict]] = mapped_column(JSON, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Contribution(Base):
    __tablename__ = "contributions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    round_id: Mapped[str] = mapped_column(ForeignKey("federated_rounds.id"), index=True)
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.id"), index=True)
    round_number: Mapped[int] = mapped_column(Integer)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    raw_score: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    normalized_score: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    sample_share: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    quality_score: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    improvement_score: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    participation_score: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Reward(Base):
    __tablename__ = "rewards"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    round_id: Mapped[str] = mapped_column(ForeignKey("federated_rounds.id"), index=True)
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.id"), index=True)
    organization_name: Mapped[str] = mapped_column(String(128))
    round_number: Mapped[int] = mapped_column(Integer)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    score: Mapped[float] = mapped_column(Numeric(12, 6), default=0)
    status: Mapped[str] = mapped_column(String(32), default="AVAILABLE")  # AVAILABLE | CLAIMED
    tx_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BlockchainTransaction(Base):
    __tablename__ = "blockchain_transactions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    tx_hash: Mapped[str] = mapped_column(String(128), unique=True)
    from_address: Mapped[str] = mapped_column(String(42))
    to_address: Mapped[str] = mapped_column(String(42))
    action: Mapped[str] = mapped_column(String(32))  # RECORD_CONTRIBUTION | ALLOCATE_REWARD | CLAIM_REWARD
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    round_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    model_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    participant_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[Optional[Dict]] = mapped_column("metadata", JSON, nullable=True)
    block_number: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    seq: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    actor: Mapped[str] = mapped_column(String(128))
    actor_role: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    organization: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    resource: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="SUCCESS")
    metadata_json: Mapped[Optional[Dict]] = mapped_column("metadata", JSON, nullable=True)
    payload_hash: Mapped[str] = mapped_column(String(128))
    prev_hash: Mapped[str] = mapped_column(String(130))
    entry_hash: Mapped[str] = mapped_column(String(130))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SystemSetting(Base):
    __tablename__ = "system_settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


engine = create_async_engine(settings.async_database_url(), echo=False, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> Any:
    """FastAPI dependency — one session per request."""
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Postgres-only sequence for audit seq (kept harmless elsewhere)
        try:
            await conn.execute(text("CREATE SEQUENCE IF NOT EXISTS audit_seq START 1"))
        except Exception:
            pass
