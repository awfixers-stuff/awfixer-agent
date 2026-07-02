from __future__ import annotations

import subprocess
from pathlib import Path

from prwatch.db import JobContext
from prwatch.worktree import WorktreeManager


def _init_remote_with_pr_ref(base: Path) -> tuple[str, str]:
    remote = base / "remote.git"
    remote.mkdir()
    subprocess.run(["git", "init", "--bare", str(remote)], check=True, capture_output=True)

    work = base / "seed"
    work.mkdir()
    subprocess.run(["git", "init"], cwd=work, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "t@example.com"], cwd=work, check=True)
    subprocess.run(["git", "config", "user.name", "test"], cwd=work, check=True)
    (work / "README.md").write_text("feature\n", encoding="utf-8")
    subprocess.run(["git", "add", "README.md"], cwd=work, check=True)
    subprocess.run(["git", "commit", "-m", "feature"], cwd=work, check=True)
    feature_head = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=work, check=True, capture_output=True, text=True
    ).stdout.strip()
    subprocess.run(["git", "push", str(remote), "HEAD:refs/pull/1/head"], cwd=work, check=True)
    subprocess.run(["git", "push", str(remote), "HEAD:refs/heads/main"], cwd=work, check=True)
    return str(remote), feature_head


def test_worktree_checkout_matches_pr_head(tmp_path: Path) -> None:
    remote, feature_head = _init_remote_with_pr_ref(tmp_path)
    ctx = JobContext(
        job_id=1,
        pr_id=1,
        head_sha=feature_head,
        trigger_event="pull_request.opened",
        needs_browser=False,
        attempts=1,
        max_attempts=3,
        pr_number=1,
        pr_title="feat",
        pr_author="dev",
        base_ref="main",
        head_ref="feature",
        repo_full_name="acme/demo",
        default_branch="main",
        installation_id=1,
        account_login="acme",
    )
    mgr = WorktreeManager(tmp_path / "ws")
    worktree = mgr.ensure_pr_workspace(ctx, clone_url=remote, token="")
    checked = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=worktree.repo_dir,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    assert checked == feature_head
