from __future__ import annotations

from dataclasses import dataclass

import asyncpg

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


@dataclass(frozen=True, slots=True)
class ClaimedJob:
    id: int
    pr_id: int
    head_sha: str
    trigger_event: str
    needs_browser: bool


@dataclass(frozen=True, slots=True)
class JobContext:
    job_id: int
    pr_id: int
    head_sha: str
    trigger_event: str
    needs_browser: bool
    attempts: int
    max_attempts: int
    pr_number: int
    pr_title: str
    pr_author: str
    base_ref: str
    head_ref: str
    repo_full_name: str
    default_branch: str
    installation_id: int
    account_login: str


@dataclass(frozen=True, slots=True)
class FindingRow:
    path: str
    line: int
    side: str
    severity: str
    category: str
    message: str
    rule_id: str | None
    confidence: float | None


JOB_CONTEXT_SQL = """
SELECT j.id, j.pr_id, j.head_sha, j.trigger_event, j.needs_browser, j.attempts, j.max_attempts,
       p.number, p.title, p.author, p.base_ref, p.head_ref,
       r.full_name, r.default_branch, r.installation_id,
       i.account_login
FROM review_jobs j
JOIN pull_requests p ON p.id = j.pr_id
JOIN repos r ON r.id = p.repo_id
JOIN installations i ON i.installation_id = r.installation_id
WHERE j.id = $1
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


async def reset_stuck_running(pool: asyncpg.Pool) -> int:
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE review_jobs
            SET state = 'queued', worker_id = NULL
            WHERE state = 'running'
            """
        )
    return int(result.split()[-1])


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


async def requeue_or_fail(pool: asyncpg.Pool, job_id: int, *, last_error: str) -> str:
    """Return final state: 'queued' (retry) or 'failed'."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT attempts, max_attempts FROM review_jobs WHERE id = $1",
            job_id,
        )
        if row is None:
            return "failed"
        attempts = int(row["attempts"])
        max_attempts = int(row["max_attempts"])
        if attempts < max_attempts:
            await conn.execute(
                """
                UPDATE review_jobs
                SET state = 'queued', worker_id = NULL, claimed_at = NULL, last_error = $2
                WHERE id = $1
                """,
                job_id,
                last_error,
            )
            return "queued"
        await conn.execute(
            """
            UPDATE review_jobs
            SET state = 'failed', finished_at = now(), last_error = $2
            WHERE id = $1
            """,
            job_id,
            last_error,
        )
        return "failed"


async def load_job_context(pool: asyncpg.Pool, job_id: int) -> JobContext | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(JOB_CONTEXT_SQL, job_id)
        if row is None:
            return None
        return JobContext(
            job_id=int(row["id"]),
            pr_id=int(row["pr_id"]),
            head_sha=str(row["head_sha"]),
            trigger_event=str(row["trigger_event"]),
            needs_browser=bool(row["needs_browser"]),
            attempts=int(row["attempts"]),
            max_attempts=int(row["max_attempts"]),
            pr_number=int(row["number"]),
            pr_title=str(row["title"] or ""),
            pr_author=str(row["author"] or ""),
            base_ref=str(row["base_ref"] or ""),
            head_ref=str(row["head_ref"] or ""),
            repo_full_name=str(row["full_name"]),
            default_branch=str(row["default_branch"] or "main"),
            installation_id=int(row["installation_id"]),
            account_login=str(row["account_login"] or ""),
        )


async def insert_finding(pool: asyncpg.Pool, job_id: int, finding: FindingRow) -> int:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO findings (
              review_job_id, path, line, side, severity, category, message, rule_id, confidence
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
            """,
            job_id,
            finding.path,
            finding.line,
            finding.side,
            finding.severity,
            finding.category,
            finding.message,
            finding.rule_id,
            finding.confidence,
        )
    assert row is not None
    return int(row["id"])


async def insert_review(
    pool: asyncpg.Pool,
    job_id: int,
    *,
    github_review_id: int | None,
    summary: str,
    check_run_id: int | None,
    conclusion: str | None,
) -> int:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO reviews (review_job_id, github_review_id, summary, check_run_id, conclusion)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            """,
            job_id,
            github_review_id,
            summary,
            check_run_id,
            conclusion,
        )
    assert row is not None
    return int(row["id"])


async def setup_job_listener(
    pool: asyncpg.Pool,
    channel: str,
    on_notify,
) -> asyncpg.Connection:
    """Acquire a dedicated connection and LISTEN on ``channel``."""
    conn = await pool.acquire()
    await conn.add_listener(channel, on_notify)
    await conn.execute(f"LISTEN {channel}")
    return conn
