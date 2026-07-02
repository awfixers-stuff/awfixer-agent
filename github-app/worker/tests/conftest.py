from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

import asyncpg
import pytest

MIGRATION_SQL = (
    Path(__file__).resolve().parents[2]
    / "gateway"
    / "internal"
    / "migrate"
    / "migrations"
    / "001_initial.sql"
).read_text(encoding="utf-8")


def _docker_unavailable(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return any(
        token in msg
        for token in (
            "cannot connect to the docker daemon",
            "docker daemon",
            "permission denied",
            "connection refused",
        )
    )


@pytest.fixture(scope="session")
def database_url():
    env_url = os.environ.get("PRWATCH_TEST_DATABASE_URL")
    if env_url:
        yield env_url
        return
    try:
        from testcontainers.postgres import PostgresContainer
    except ImportError:
        pytest.skip("testcontainers not installed and PRWATCH_TEST_DATABASE_URL unset")
    try:
        with PostgresContainer("postgres:16-alpine") as postgres:
            url = postgres.get_connection_url().replace("postgresql+psycopg2://", "postgresql://", 1)
            yield url
    except Exception as exc:
        if _docker_unavailable(exc):
            pytest.skip(f"docker unavailable: {exc}")
        raise


@pytest.fixture
async def db_pool(database_url: str) -> AsyncIterator[asyncpg.Pool]:
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=4)
    async with pool.acquire() as conn:
        await conn.execute(MIGRATION_SQL)
        for table in (
            "findings",
            "reviews",
            "review_jobs",
            "pull_requests",
            "repos",
            "installations",
            "audit_log",
        ):
            await conn.execute(f"TRUNCATE {table} RESTART IDENTITY CASCADE")
    yield pool
    await pool.close()


