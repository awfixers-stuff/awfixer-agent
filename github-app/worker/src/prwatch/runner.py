from __future__ import annotations

import asyncio
import logging

import asyncpg

from prwatch.config import Settings
from prwatch.db import claim_next_job, finish_job, requeue_or_fail, reset_stuck_running, setup_job_listener
from prwatch.git_ops import redact_credentials
from prwatch.pipeline import run_review_job
from prwatch.sandbox_exec import build_sandbox_runner

log = logging.getLogger(__name__)

NOTIFY_CHANNEL = "review_job_queued"


async def run_worker_loop(settings: Settings) -> None:
    pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=6)
    sem = asyncio.Semaphore(settings.max_concurrency)
    loop = asyncio.get_running_loop()
    wakeup = asyncio.Event()

    def on_notify(_conn, _pid, _channel, _payload) -> None:
        loop.call_soon_threadsafe(wakeup.set)

    listener = await setup_job_listener(pool, NOTIFY_CHANNEL, on_notify)
    recovered = await reset_stuck_running(pool)
    if recovered:
        log.info("recovered stuck review jobs", extra={"count": recovered})

    try:
        while True:
            job = await claim_next_job(pool, settings.worker_id)
            if job is None:
                try:
                    await asyncio.wait_for(wakeup.wait(), timeout=1.0)
                except TimeoutError:
                    pass
                wakeup.clear()
                continue
            await sem.acquire()
            asyncio.create_task(_process_job(pool, settings, job, sem))
    finally:
        await pool.release(listener)
        await pool.close()


async def _process_job(
    pool: asyncpg.Pool,
    settings: Settings,
    job,
    sem: asyncio.Semaphore,
) -> None:
    sandbox = build_sandbox_runner(settings.e2b_api_key)
    try:
        log.info(
            "claimed review job",
            extra={"job_id": job.id, "pr_id": job.pr_id, "sha": job.head_sha[:8]},
        )
        if settings.stub_pipeline:
            await finish_job(pool, job.id, ok=True)
            return
        await run_review_job(pool, settings, job, sandbox)
        await finish_job(pool, job.id, ok=True)
    except Exception as exc:
        log.exception("review job failed", extra={"job_id": job.id})
        err = redact_credentials(str(exc))[:2000]
        state = await requeue_or_fail(pool, job.id, last_error=err)
        if state == "queued":
            log.warning("review job requeued", extra={"job_id": job.id})
    finally:
        close = getattr(sandbox, "close", None)
        if callable(close):
            await close()
        sem.release()
