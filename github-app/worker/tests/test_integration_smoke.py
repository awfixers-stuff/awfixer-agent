from __future__ import annotations

import os

import asyncpg
import pytest

from tests.support import seed_review_job


@pytest.mark.asyncio
async def test_enqueue_fixture_job_is_claimable(db_pool: asyncpg.Pool) -> None:
    if os.environ.get("PRWATCH_INTEGRATION") != "1":
        pytest.skip("set PRWATCH_INTEGRATION=1 for integration smoke")

    from prwatch.db import claim_next_job, finish_job

    job_id = await seed_review_job(db_pool, delivery_id="integration-smoke-1")
    claimed = await claim_next_job(db_pool, "integration-worker")
    assert claimed is not None
    assert claimed.id == job_id
    await finish_job(db_pool, job_id, ok=True)
    row = await db_pool.fetchrow("SELECT state FROM review_jobs WHERE id = $1", job_id)
    assert row is not None
    assert row["state"] == "done"
