"""httpx client for the ml-service (spec §14)."""
from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from app.config import settings


class MLServiceError(Exception):
    def __init__(self, message: str, status: int = 502) -> None:
        super().__init__(message)
        self.status = status


class MLClient:
    """Thin async wrapper — all federation compute happens in the ml-service."""

    def __init__(self, base_url: Optional[str] = None, timeout: float = 120.0) -> None:
        self.base_url = (base_url or settings.ml_service_url).rstrip("/")
        self.timeout = timeout

    async def _request(self, method: str, path: str, json_body: Optional[Dict] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.request(method, url, json=json_body)
        except httpx.HTTPError as exc:
            raise MLServiceError(f"ml-service unreachable at {url}: {exc}") from exc
        if resp.status_code >= 400:
            detail = resp.text[:300]
            raise MLServiceError(f"ml-service error {resp.status_code}: {detail}", status=resp.status_code)
        return resp.json()

    async def health(self) -> Dict[str, Any]:
        return await self._request("GET", "/health")

    async def privacy_status(self) -> Dict[str, Any]:
        return await self._request("GET", "/privacy/status")

    async def list_models(self) -> Dict[str, Any]:
        return await self._request("GET", "/federation/models")

    async def run_round(self, model: str, round_number: Optional[int], config: Optional[Dict],
                        actor: str) -> Dict[str, Any]:
        body: Dict[str, Any] = {"model": model, "actor": actor}
        if round_number is not None:
            body["roundNumber"] = round_number
        if config:
            body["config"] = config
        return await self._request("POST", "/federation/rounds", body)


ml_client = MLClient()
