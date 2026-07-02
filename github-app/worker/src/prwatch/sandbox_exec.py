"""Untrusted command execution in E2B (Railway worker stays credential-bearing)."""

from __future__ import annotations

import io
import logging
import tarfile
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

log = logging.getLogger(__name__)

SANDBOX_ROOT = "/home/user/pr"


@dataclass(frozen=True, slots=True)
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str


class SandboxRunner(Protocol):
    async def ensure_session(self, worktree_path: str | Path) -> None: ...
    async def run(self, command: str, *, cwd_hint: str | None = None) -> SandboxResult: ...
    async def close(self) -> None: ...


class StubSandboxRunner:
    """Unit-test / local dev stub when E2B_API_KEY is unset."""

    async def ensure_session(self, worktree_path: str | Path) -> None:
        _ = worktree_path

    async def run(self, command: str, *, cwd_hint: str | None = None) -> SandboxResult:
        _ = cwd_hint
        return SandboxResult(
            exit_code=0,
            stdout=f"[stub sandbox] refused to run untrusted command: {command!r}",
            stderr="",
        )

    async def close(self) -> None:
        return


def build_sandbox_runner(api_key: str) -> SandboxRunner:
    if not api_key.strip():
        return StubSandboxRunner()
    return E2BSandboxRunner(api_key=api_key)


def _tar_worktree(repo_dir: Path) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for path in sorted(repo_dir.rglob("*")):
            if path.is_dir():
                continue
            rel = path.relative_to(repo_dir)
            archive.add(path, arcname=str(rel))
    return buffer.getvalue()


class E2BSandboxRunner:
    """Fresh E2B microVM per review job; sync worktree before run()."""

    def __init__(self, *, api_key: str) -> None:
        self._api_key = api_key
        self._sandbox = None

    async def ensure_session(self, worktree_path: str | Path) -> None:
        try:
            from e2b_code_interpreter import Sandbox  # type: ignore[import-untyped]
        except ImportError as exc:
            raise RuntimeError("install prwatch[e2b] for E2B execution") from exc

        repo_dir = Path(worktree_path)
        payload = _tar_worktree(repo_dir)
        self._sandbox = Sandbox(api_key=self._api_key)
        remote_tar = f"{SANDBOX_ROOT}.tar.gz"
        files = self._sandbox.files
        files.write(remote_tar, payload)
        proc = self._sandbox.commands.run(f"mkdir -p {SANDBOX_ROOT} && tar -xzf {remote_tar} -C {SANDBOX_ROOT}")
        raw_exit = getattr(proc, "exit_code", 1)
        if int(1 if raw_exit is None else raw_exit) != 0:
            stderr = str(getattr(proc, "stderr", "") or "")
            raise RuntimeError(f"E2B worktree extract failed: {stderr}")

    async def run(self, command: str, *, cwd_hint: str | None = None) -> SandboxResult:
        if self._sandbox is None:
            return SandboxResult(exit_code=1, stdout="", stderr="sandbox not initialized")
        cwd = cwd_hint or SANDBOX_ROOT
        proc = self._sandbox.commands.run(command, cwd=cwd)
        raw_exit = getattr(proc, "exit_code", 0)
        return SandboxResult(
            exit_code=int(0 if raw_exit is None else raw_exit),
            stdout=str(getattr(proc, "stdout", "") or ""),
            stderr=str(getattr(proc, "stderr", "") or ""),
        )

    async def close(self) -> None:
        if self._sandbox is not None:
            close = getattr(self._sandbox, "kill", None)
            if callable(close):
                close()
            self._sandbox = None
