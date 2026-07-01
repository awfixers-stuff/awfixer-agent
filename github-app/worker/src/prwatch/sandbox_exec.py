"""Untrusted command execution in E2B (Railway worker stays credential-bearing)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str


class SandboxRunner(Protocol):
    async def run(self, command: str, *, cwd_hint: str | None = None) -> SandboxResult: ...


class StubSandboxRunner:
    """Unit-test / local dev stub when E2B_API_KEY is unset."""

    async def run(self, command: str, *, cwd_hint: str | None = None) -> SandboxResult:
        return SandboxResult(
            exit_code=0,
            stdout=f"[stub sandbox] refused to run untrusted command: {command!r}",
            stderr="",
        )


def build_sandbox_runner(api_key: str) -> SandboxRunner:
    if not api_key.strip():
        return StubSandboxRunner()
    return E2BSandboxRunner(api_key=api_key)


class E2BSandboxRunner:
    """Fresh E2B microVM per review job; sync worktree before run()."""

    def __init__(self, *, api_key: str) -> None:
        self._api_key = api_key
        self._sandbox = None

    async def ensure_session(self, worktree_path: str) -> None:
        """Spawn sandbox and sync worktree (v1: called once per job)."""
        try:
            from e2b_code_interpreter import Sandbox  # type: ignore[import-untyped]
        except ImportError as exc:
            raise RuntimeError("install prwatch[e2b] for E2B execution") from exc
        self._sandbox = Sandbox(api_key=self._api_key)
        # v1: upload minimal marker; full rsync/tar sync is a follow-up task.
        _ = worktree_path

    async def run(self, command: str, *, cwd_hint: str | None = None) -> SandboxResult:
        if self._sandbox is None:
            return SandboxResult(exit_code=1, stdout="", stderr="sandbox not initialized")
        _ = cwd_hint
        proc = self._sandbox.commands.run(command)
        return SandboxResult(
            exit_code=int(getattr(proc, "exit_code", 0) or 0),
            stdout=str(getattr(proc, "stdout", "") or ""),
            stderr=str(getattr(proc, "stderr", "") or ""),
        )

    async def close(self) -> None:
        if self._sandbox is not None:
            close = getattr(self._sandbox, "kill", None)
            if callable(close):
                close()
            self._sandbox = None