from __future__ import annotations

import asyncio

import asyncpg
import pytest

from prwatch.config import Settings
from prwatch.runner import _process_job
from tests.support import seed_review_job


@pytest.mark.asyncio
async def test_stub_pipeline_marks_job_done(
    db_pool: asyncpg.Pool,
    database_url: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = await seed_review_job(db_pool, delivery_id="stub-pipe-1")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("PRWATCH_STUB_PIPELINE", "true")
    monkeypatch.setenv("PRWATCH_WORKER_ID", "worker-stub")
    settings = Settings()
    from prwatch.db import claim_next_job

    claimed = await claim_next_job(db_pool, "worker-stub")
    assert claimed is not None
    assert claimed.id == job_id

    sem = asyncio.Semaphore(1)
    await sem.acquire()
    await _process_job(db_pool, settings, claimed, sem)

    row = await db_pool.fetchrow("SELECT state FROM review_jobs WHERE id = $1", job_id)
    assert row is not None
    assert row["state"] == "done"
