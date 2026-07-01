from __future__ import annotations

from dataclasses import dataclass

import asyncpg


@dataclass(frozen=True, slots=True)
class ClaimedJob:
    id: int
    pr_id: int
    head_sha: str
    trigger_event: str
    needs_browser: bool


CLAIM_SQL = """
WITH candidate AS (
  SELECT j.id
  FROM review_jobs j
  WHERE j.state = 'queued'
    AND j.attempts < j.max_attempts
    AND NOT EXISTS (
      SELECT 1 FROM review_jobs j2
      WHERE j2.pr_id = j.pr_id AND j2.state = 'running'
    )
  ORDER BY j.enqueued_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE review_jobs j
SET state = 'running',
    claimed_at = now(),
    worker_id = $1,
    attempts = j.attempts + 1
FROM candidate
WHERE j.id = candidate.id
RETURNING j.id, j.pr_id, j.head_sha, j.trigger_event, j.needs_browser;
"""


async def claim_next_job(pool: asyncpg.Pool, worker_id: str) -> ClaimedJob | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(CLAIM_SQL, worker_id)
        if row is None:
            return None
        return ClaimedJob(
            id=int(row["id"]),
            pr_id=int(row["pr_id"]),
            head_sha=str(row["head_sha"]),
            trigger_event=str(row["trigger_event"]),
            needs_browser=bool(row["needs_browser"]),
        )


async def finish_job(pool: asyncpg.Pool, job_id: int, *, ok: bool, last_error: str | None = None) -> None:
    state = "done" if ok else "failed"
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE review_jobs
            SET state = $2, finished_at = now(), last_error = $3
            WHERE id = $1
            """,
            job_id,
            state,
            last_error,
        )


async def listen_for_jobs(pool: asyncpg.Pool, channel: str = "review_job_queued") -> asyncpg.Connection:
    conn = await pool.acquire()
    await conn.add_listener(channel, lambda *args: None)
    return conn