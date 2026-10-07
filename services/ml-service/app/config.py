"""Environment settings for the DataVault ML service (spec §14, §5)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ML_SERVICE_PORT = 8001


@dataclass(frozen=True)
class Settings:
    """All knobs come from the environment so the Docker image stays generic."""

    data_root: Path
    models_dir: Path
    epochs: int
    batch_size: int
    lr: float
    l2: float
    privacy_mode: str  # DEMO | ENCRYPTION (spec §5 Layer 2)
    secret: str
    host: str
    port: int

    @property
    def privacy_modes(self) -> list[str]:
        return ["DEMO", "ENCRYPTION"]


def _load() -> Settings:
    # default DATA_ROOT resolves to <repo>/data/participants when the service is
    # started from services/ml-service (matches spec §15 participant storage)
    data_root = Path(os.getenv("DATA_ROOT", "../../data/participants")).resolve()
    models_dir = Path(os.getenv("MODELS_DIR", str(data_root.parent / "models"))).resolve()
    mode = os.getenv("PRIVACY_MODE", os.getenv("ML_MODE", "DEMO")).upper()
    return Settings(
        data_root=data_root,
        models_dir=models_dir,
        epochs=int(os.getenv("EPOCHS", "5")),
        batch_size=int(os.getenv("BATCH_SIZE", "32")),
        lr=float(os.getenv("LR", "0.1")),
        l2=float(os.getenv("L2", "0.0005")),
        privacy_mode=mode if mode in ("DEMO", "ENCRYPTION") else "DEMO",
        secret=os.getenv("ML_SECRET", os.getenv("JWT_SECRET", "datavault")),
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", str(ML_SERVICE_PORT))),
    )


settings = _load()

DEFAULT_ROUND_CONFIG: dict = {
    "epochs": settings.epochs,
    "batchSize": settings.batch_size,
    "lr": settings.lr,
    "privacyMode": settings.privacy_mode,
}
