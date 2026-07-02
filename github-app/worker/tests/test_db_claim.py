from __future__ import annotations

import asyncio

import asyncpg
import pytest

from prwatch.db import claim_next_job, reset_stuck_running
from tests.support import seed_review_job


@pytest.mark.asyncio
async def test_claim_transitions_queued_to_running(db_pool: asyncpg.Pool) -> None:
    job_id = await seed_review_job(db_pool, delivery_id="claim-1")
    claimed = await claim_next_job(db_pool, "worker-a")
    assert claimed is not None
    assert claimed.id == job_id
    assert claimed.pr_id > 0
    row = await db_pool.fetchrow("SELECT state, worker_id, attempts FROM review_jobs WHERE id = $1", job_id)
    assert row is not None
    assert row["state"] == "running"
    assert row["worker_id"] == "worker-a"
    assert int(row["attempts"]) == 1


@pytest.mark.asyncio
async def test_claim_skips_pr_with_running_job(db_pool: asyncpg.Pool) -> None:
    job_a = await seed_review_job(db_pool, delivery_id="running-block-a")
    async with db_pool.acquire() as conn:
        pr_id = await conn.fetchval("SELECT pr_id FROM review_jobs WHERE id = $1", job_a)
    await seed_review_job(db_pool, delivery_id="running-block-b", pr_id=pr_id)
    first = await claim_next_job(db_pool, "worker-a")
    assert first is not None
    second = await claim_next_job(db_pool, "worker-b")
    assert second is None


@pytest.mark.asyncio
async def test_reset_stuck_running_requeues(db_pool: asyncpg.Pool) -> None:
    job_id = await seed_review_job(db_pool, delivery_id="stuck-1", state="running")
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE review_jobs SET worker_id = 'dead-worker' WHERE id = $1",
            job_id,
        )
    recovered = await reset_stuck_running(db_pool)
    assert recovered == 1
    row = await db_pool.fetchrow("SELECT state, worker_id FROM review_jobs WHERE id = $1", job_id)
    assert row is not None
    assert row["state"] == "queued"
    assert row["worker_id"] is None


@pytest.mark.asyncio
async def test_notify_wakes_listener(db_pool: asyncpg.Pool) -> None:
    loop = asyncio.get_running_loop()
    wakeup = asyncio.Event()

    def on_notify(_conn, _pid, _channel, _payload) -> None:
        loop.call_soon_threadsafe(wakeup.set)

    conn = await db_pool.acquire()
    await conn.add_listener("review_job_queued", on_notify)
    await conn.execute("LISTEN review_job_queued")
    await seed_review_job(db_pool, delivery_id="notify-1")
    async with db_pool.acquire() as notify_conn:
        await notify_conn.execute("SELECT pg_notify('review_job_queued', '1')")
    await asyncio.wait_for(wakeup.wait(), timeout=5.0)
    await conn.remove_listener("review_job_queued", on_notify)
    await db_pool.release(conn)
