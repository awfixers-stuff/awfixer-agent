from __future__ import annotations

import asyncio
import logging

import asyncpg

from prwatch.config import Settings
from prwatch.db import ClaimedJob, load_job_context
from prwatch.github_auth import GitHubAppAuth
from prwatch.github_client import GitHubClient
from prwatch.host_tools import ReviewBindings
from prwatch.kernel_sandbox import KernelBrowserStub
from prwatch.review_driver import run_review
from prwatch.review_persona import build_kickoff_prompt
from prwatch.sandbox_exec import SandboxRunner
from prwatch.worktree import WorktreeManager

log = logging.getLogger(__name__)


async def run_review_job(
    pool: asyncpg.Pool,
    settings: Settings,
    job: ClaimedJob,
    sandbox: SandboxRunner,
) -> None:
    ctx = await load_job_context(pool, job.id)
    if ctx is None:
        raise RuntimeError(f"job context missing for id={job.id}")

    auth = GitHubAppAuth(
        app_id=settings.github_app_id,
        private_key_pem=settings.github_app_private_key,
    )
    token = await auth.installation_token(ctx.installation_id)
    github = GitHubClient(token)

    repo = await github.get_repo(ctx.repo_full_name)
    pr = await github.get_pull_request(ctx.repo_full_name, ctx.pr_number)
    files = await github.list_pr_files(ctx.repo_full_name, ctx.pr_number)

    worktree_mgr = WorktreeManager(settings.workspace_root)
    worktree = worktree_mgr.ensure_pr_workspace(ctx, clone_url=repo.clone_url, token=token)
    await sandbox.ensure_session(worktree.repo_dir)

    kernel = KernelBrowserStub(enabled=ctx.needs_browser, api_key=settings.kernel_api_key)
    await kernel.ensure_session()
    try:
        loop = asyncio.get_running_loop()
        bindings = ReviewBindings(
            job_id=ctx.job_id,
            repo_full_name=ctx.repo_full_name,
            pr_number=ctx.pr_number,
            head_sha=ctx.head_sha,
            github=github,
            sandbox=sandbox,
            pool=pool,
            loop=loop,
        )
        prompt = build_kickoff_prompt(ctx, pr, files)
        result = await run_review(settings, ctx, worktree, sandbox, bindings, prompt)
        log.info(
            "review complete",
            extra={
                "job_id": job.id,
                "findings": result.findings_count,
                "posted": result.posted,
            },
        )
        if not result.posted:
            raise RuntimeError("agent finished without calling post_review")
    finally:
        await kernel.close()
