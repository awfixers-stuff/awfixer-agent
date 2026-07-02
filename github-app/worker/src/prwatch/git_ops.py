from __future__ import annotations

import base64
import logging
import os
import re
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)

AUTH_ENV_VAR = "PRWATCH_GIT_HTTP_AUTH"
_CRED_URL = re.compile(r"(https?://)([^:/@\s]+):([^@/\s]+)@")


def redact_credentials(text: str | None) -> str:
    if not text:
        return ""
    return _CRED_URL.sub(r"\1\2:***@", text)


@dataclass(slots=True)
class GitResult:
    returncode: int
    stdout: str
    stderr: str


class GitCommandError(RuntimeError):
    def __init__(self, command: Sequence[str], result: GitResult) -> None:
        super().__init__(
            f"git failed ({result.returncode}): {' '.join(command)}\n{redact_credentials(result.stderr)}"
        )
        self.command = tuple(command)
        self.result = result


def _git_env() -> dict[str, str]:
    env = dict(os.environ)
    for key in (AUTH_ENV_VAR, "GITHUB_TOKEN", "GH_TOKEN", "GITHUB_APP_PRIVATE_KEY", "DATABASE_URL", "E2B_API_KEY"):
        env.pop(key, None)
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_ASKPASS"] = ""
    return env


def _auth_header(token: str) -> str:
    encoded = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    return f"Authorization: basic {encoded}"


def run_git(
    args: Sequence[str],
    *,
    cwd: Path | None = None,
    token: str | None = None,
    check: bool = True,
    timeout: float = 300.0,
) -> GitResult:
    env = _git_env()
    command: list[str]
    if token:
        env[AUTH_ENV_VAR] = _auth_header(token)
        command = ["git", "--config-env", f"http.extraHeader={AUTH_ENV_VAR}", *args]
    else:
        command = ["git", *args]
    proc = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    result = GitResult(
        returncode=proc.returncode,
        stdout=redact_credentials(proc.stdout),
        stderr=redact_credentials(proc.stderr),
    )
    if check and result.returncode != 0:
        raise GitCommandError(command, result)
    return result


def ensure_pool_clone(
    *,
    clone_url: str,
    target: Path,
    default_branch: str,
    token: str,
) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if (target / ".git").exists() or (target / "HEAD").exists():
        run_git(["remote", "set-url", "origin", clone_url], cwd=target, token=token)
        run_git(["fetch", "origin", "--prune", "--filter=blob:none"], cwd=target, token=token)
        return
    run_git(
        [
            "clone",
            "--filter=blob:none",
            "--single-branch",
            "--branch",
            default_branch,
            clone_url,
            str(target),
        ],
        token=token,
    )


def fetch_pr_head(*, pool_dir: Path, pr_number: int, token: str) -> None:
    run_git(
        ["fetch", "origin", f"pull/{pr_number}/head"],
        cwd=pool_dir,
        token=token,
    )


def add_detached_worktree(*, pool_dir: Path, repo_dir: Path, ref: str = "FETCH_HEAD") -> None:
    repo_dir.parent.mkdir(parents=True, exist_ok=True)
    if (repo_dir / ".git").exists():
        return
    run_git(["worktree", "add", "--detach", str(repo_dir), ref], cwd=pool_dir)
