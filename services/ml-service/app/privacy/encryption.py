"""LAYER 2 — Privacy Computing (spec §5 Layer 2, §34, §64).

``EncryptionService``  — AES-256-GCM authenticated encryption (REAL, via the
                          ``cryptography`` package), key derived exactly like
                          the TS engine: sha256("datavault::<secret>").
``CKKSService``         — optional TenSEAL homomorphic encryption of model
                          update vectors. Import-guarded: when TenSEAL is not
                          installed the service transparently falls back to
                          the AES-256-GCM + additive-mask pipeline (spec §64
                          fallback rule — documented, never fatal).
"""
from __future__ import annotations

import hashlib
import os
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

try:  # spec §64: TenSEAL is optional — guarded import, stable fallback below
    import tenseal as ts  # type: ignore

    TENSEAL_AVAILABLE = True
except Exception:  # pragma: no cover - exercised only when tenseal is absent
    ts = None  # type: ignore
    TENSEAL_AVAILABLE = False


@dataclass
class EncryptedPayload:
    algo: str
    iv: str  # hex
    authTag: str  # hex
    ciphertext: str  # hex
    plaintextHash: str  # sha256 of plaintext (safe integrity proof)
    bytes: int


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class EncryptionService:
    """AES-256-GCM — mirrors TS EncryptionService field-for-field."""

    def __init__(self, secret: str) -> None:
        self.key = hashlib.sha256(f"datavault::{secret}".encode()).digest()

    def encrypt(self, plaintext: str) -> EncryptedPayload:
        iv = os.urandom(12)
        ct = AESGCM(self.key).encrypt(iv, plaintext.encode("utf-8"), None)
        return EncryptedPayload(
            algo="AES-256-GCM",
            iv=iv.hex(),
            authTag=ct[-16:].hex(),  # GCM tag is the trailing 16 bytes
            ciphertext=ct[:-16].hex(),
            plaintextHash=_sha256_hex(plaintext.encode("utf-8")),
            bytes=len(ct),
        )

    def decrypt(self, payload: EncryptedPayload) -> str:
        ct = bytes.fromhex(payload.ciphertext) + bytes.fromhex(payload.authTag)
        pt = AESGCM(self.key).decrypt(bytes.fromhex(payload.iv), ct, None)
        return pt.decode("utf-8")

    def payload_to_json(self, payload: EncryptedPayload) -> str:
        import json

        return json.dumps(asdict(payload), separators=(",", ":"))


class CKKSService:
    """TenSEAL CKKS homomorphic encryption for model-update vectors.

    Only used when ``tenseal`` is importable (ENCRYPTION mode upgrade path).
    The demo default is AES-256-GCM + additive masking, per spec §64.
    """

    POLY_MODULUS_DEGREE = 8192
    COEFF_BIT_SIZES = [60, 40, 40, 60]

    def __init__(self) -> None:
        if not TENSEAL_AVAILABLE:  # pragma: no cover
            raise RuntimeError("TenSEAL is not installed (spec §64 fallback active)")
        self._context = ts.context(ts.SCHEME_CKKS, self.POLY_MODULUS_DEGREE, self.COEFF_BIT_SIZES)
        self._context.global_scale = 2.0 ** 40
        self._context.generate_galois_keys()

    def encrypt_vector(self, vec: List[float]) -> bytes:
        return self._context.encrypt(ts.plain_vector(vec)).serialize()

    def decrypt_vector(self, blob: bytes) -> List[float]:
        return ts.ckks_vector_from(self._context, blob).decrypt()

    def encrypted_sum(self, blobs: List[bytes]) -> List[float]:
        """Homomorphic aggregation of encrypted update vectors (demo of §5)."""
        acc = ts.ckks_vector_from(self._context, blobs[0])
        for b in blobs[1:]:
            acc = acc + ts.ckks_vector_from(self._context, b)
        return acc.decrypt()


def try_create_ckks() -> Optional[CKKSService]:
    if not TENSEAL_AVAILABLE:
        return None
    try:  # pragma: no cover - depends on optional dependency
        return CKKSService()
    except Exception:
        return None


def backends_status() -> Dict:
    """Machine-readable backend report for /privacy/status (spec §64)."""
    return {
        "aes256Gcm": True,
        "tensealCkks": TENSEAL_AVAILABLE,
        "fallback": "AES-256-GCM + pairwise additive masking (documented per spec §64)"
        if not TENSEAL_AVAILABLE
        else None,
    }
