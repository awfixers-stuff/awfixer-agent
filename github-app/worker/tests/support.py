from __future__ import annotations

import asyncpg


async def seed_review_job(
    pool: asyncpg.Pool,
    *,
    delivery_id: str,
    pr_id: int | None = None,
    state: str = "queued",
) -> int:
    async with pool.acquire() as conn:
        if pr_id is None:
            inst_id = await conn.fetchval(
                """
                INSERT INTO installations (installation_id, account_login)
                VALUES (12345, 'awfixerai')
                ON CONFLICT (installation_id) DO UPDATE SET account_login = EXCLUDED.account_login
                RETURNING installation_id
                """
            )
            repo_id = await conn.fetchval(
                """
                INSERT INTO repos (installation_id, full_name, default_branch)
                VALUES ($1, 'awfixerai/example', 'main')
                ON CONFLICT (installation_id, full_name) DO UPDATE SET default_branch = EXCLUDED.default_branch
                RETURNING id
                """,
                inst_id,
            )
            pr_id = await conn.fetchval(
                """
                INSERT INTO pull_requests (repo_id, number, head_sha, state, base_ref, head_ref, author, title)
                VALUES ($1, 42, 'abc123', 'open', 'main', 'feature/x', 'dev', 'feat')
                RETURNING id
                """,
                repo_id,
            )
        job_id = await conn.fetchval(
            """
            INSERT INTO review_jobs (pr_id, head_sha, trigger_event, delivery_id, state)
            VALUES ($1, 'abc123', 'pull_request.opened', $2, $3)
            RETURNING id
            """,
            pr_id,
            delivery_id,
            state,
        )
    return int(job_id)
