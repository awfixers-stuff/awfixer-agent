from __future__ import annotations

import asyncio
import logging

import asyncpg

from prwatch.config import Settings
from prwatch.db import claim_next_job, finish_job
from prwatch.sandbox_exec import build_sandbox_runner

log = logging.getLogger(__name__)


async def run_worker_loop(settings: Settings) -> None:
    pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=4)
    sandbox_factory = build_sandbox_runner(settings.e2b_api_key)
    sem = asyncio.Semaphore(settings.max_concurrency)
    try:
        while True:
            job = await claim_next_job(pool, settings.worker_id)
            if job is None:
                await asyncio.sleep(1.0)
                continue
            await sem.acquire()
            asyncio.create_task(_process_job(pool, settings, sandbox_factory, job, sem))
    finally:
        await pool.close()


async def _process_job(
    pool: asyncpg.Pool,
    settings: Settings,
    sandbox_factory,
    job,
    sem: asyncio.Semaphore,
) -> None:
    try:
        log.info(
            "claimed review job",
            extra={"job_id": job.id, "pr_id": job.pr_id, "sha": job.head_sha[:8]},
        )
        # v1 scaffold: omp-RPC + GitHub post + check run wired in follow-up tasks.
        runner = sandbox_factory
        if hasattr(runner, "ensure_session"):
            await runner.ensure_session(settings.workspace_root)
        _ = settings.omp_command
        await finish_job(pool, job.id, ok=True)
    except Exception as exc:
        log.exception("review job failed", extra={"job_id": job.id})
        await finish_job(pool, job.id, ok=False, last_error=str(exc)[:2000])
    finally:
        close = getattr(sandbox_factory, "close", None)
        if callable(close):
            await close()
        sem.release()