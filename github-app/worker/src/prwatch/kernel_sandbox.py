from __future__ import annotations

import logging

log = logging.getLogger(__name__)


class KernelBrowserStub:
    """Opt-in Kernel browser plumbing (v1 stub)."""

    def __init__(self, *, enabled: bool, api_key: str) -> None:
        self._enabled = enabled
        self._api_key = api_key.strip()

    async def ensure_session(self) -> None:
        if not self._enabled:
            return
        if not self._api_key:
            log.warning("needs_browser set but KERNEL_API_KEY is unset; skipping browser session")
            return
        log.info("kernel browser session stub (v1.1)")

    async def close(self) -> None:
        return
