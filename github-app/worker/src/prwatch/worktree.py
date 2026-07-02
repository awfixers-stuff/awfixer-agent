from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from prwatch.db import JobContext
from prwatch.git_ops import add_detached_worktree, ensure_pool_clone, fetch_pr_head


@dataclass(frozen=True, slots=True)
class Worktree:
    root: Path
    repo_dir: Path
    session_dir: Path


def workspace_key(repo_full_name: str, pr_number: int) -> str:
    return f"{repo_full_name.replace('/', '__')}__{pr_number}"


class WorktreeManager:
    def __init__(self, workspace_root: str | Path) -> None:
        self._root = Path(workspace_root)
        self._pool = self._root / "_pool"

    def ensure_pr_workspace(
        self,
        ctx: JobContext,
        *,
        clone_url: str,
        token: str,
    ) -> Worktree:
        pool_dir = self._pool / ctx.repo_full_name.replace("/", "__")
        ensure_pool_clone(
            clone_url=clone_url,
            target=pool_dir,
            default_branch=ctx.default_branch,
            token=token,
        )
        ws_root = self._root / workspace_key(ctx.repo_full_name, ctx.pr_number)
        repo_dir = ws_root / "repo"
        session_dir = ws_root / ".agent-session"
        session_dir.mkdir(parents=True, exist_ok=True)

        if not (repo_dir / ".git").exists():
            fetch_pr_head(pool_dir=pool_dir, pr_number=ctx.pr_number, token=token)
            add_detached_worktree(pool_dir=pool_dir, repo_dir=repo_dir)

        return Worktree(root=ws_root, repo_dir=repo_dir, session_dir=session_dir)
