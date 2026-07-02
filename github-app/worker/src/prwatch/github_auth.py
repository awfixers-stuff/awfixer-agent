from __future__ import annotations

import time
from dataclasses import dataclass

import httpx
import jwt


@dataclass(slots=True)
class CachedToken:
    token: str
    expires_at: float


class GitHubAppAuth:
    """Mint and cache GitHub App installation access tokens."""

    def __init__(
        self,
        *,
        app_id: int,
        private_key_pem: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._app_id = app_id
        self._private_key_pem = private_key_pem.replace("\\n", "\n")
        self._cache: dict[int, CachedToken] = {}
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url="https://api.github.com",
            transport=self._transport,
            timeout=httpx.Timeout(30.0, connect=10.0),
            headers={
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "prwatch/0.1",
            },
        )

    def _mint_jwt(self) -> str:
        now = int(time.time())
        payload = {"iat": now - 60, "exp": now + 9 * 60, "iss": str(self._app_id)}
        return jwt.encode(payload, self._private_key_pem, algorithm="RS256")

    async def installation_token(self, installation_id: int) -> str:
        cached = self._cache.get(installation_id)
        if cached is not None and time.time() < cached.expires_at:
            return cached.token

        app_jwt = self._mint_jwt()
        async with self._client() as client:
            resp = await client.post(
                f"/app/installations/{installation_id}/access_tokens",
                headers={"Authorization": f"Bearer {app_jwt}"},
            )
            resp.raise_for_status()
            data = resp.json()

        token = str(data["token"])
        expires_at = time.time() + 50 * 60
        if raw := data.get("expires_at"):
            try:
                from datetime import datetime

                parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                expires_at = parsed.timestamp() - 5 * 60
            except ValueError:
                pass
        self._cache[installation_id] = CachedToken(token=token, expires_at=expires_at)
        return token
