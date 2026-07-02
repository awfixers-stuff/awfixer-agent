from __future__ import annotations

import asyncio
import threading

import asyncpg
import httpx
import pytest
from omp_rpc import HostToolContext

from prwatch.db import FindingRow, insert_finding
from prwatch.github_client import GitHubClient
from prwatch.host_tools import ReviewBindings, build_host_tools
from prwatch.sandbox_exec import StubSandboxRunner
from tests.support import seed_review_job


class _RecordingTransport(httpx.AsyncBaseTransport):
    def __init__(self) -> None:
        self.requests: list[tuple[str, str]] = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.requests.append((request.method, str(request.url)))
        path = request.url.path
        if path.endswith("/check-runs") and request.method == "POST":
            return httpx.Response(201, json={"id": 9001})
        if "/pulls/" in path and path.endswith("/reviews"):
            return httpx.Response(201, json={"id": 7001, "body": "summary", "state": "COMMENTED"})
        if path.endswith("/check-runs/9001"):
            return httpx.Response(200, json={"id": 9001})
        return httpx.Response(404, json={"message": f"unmocked {request.method} {path}"})


@pytest.mark.asyncio
async def test_record_finding_persists_row(db_pool: asyncpg.Pool) -> None:
    job_id = await seed_review_job(db_pool, delivery_id="finding-1")
    finding = FindingRow(
        path="src/a.py",
        line=10,
        side="RIGHT",
        severity="warning",
        category="logic",
        message="possible nil deref",
        rule_id="nil-check",
        confidence=0.8,
    )
    row_id = await insert_finding(db_pool, job_id, finding)
    assert row_id > 0
    count = await db_pool.fetchval("SELECT COUNT(*) FROM findings WHERE review_job_id = $1", job_id)
    assert int(count) == 1


@pytest.mark.asyncio
async def test_post_review_emits_github_requests(db_pool: asyncpg.Pool) -> None:
    job_id = await seed_review_job(db_pool, delivery_id="post-1")
    transport = _RecordingTransport()
    github = GitHubClient("test-token", transport=transport)
    loop = asyncio.get_running_loop()
    bindings = ReviewBindings(
        job_id=job_id,
        repo_full_name="awfixerai/example",
        pr_number=42,
        head_sha="abc123",
        github=github,
        sandbox=StubSandboxRunner(),
        pool=db_pool,
        loop=loop,
        findings=[
            FindingRow(
                path="src/a.py",
                line=3,
                side="RIGHT",
                severity="info",
                category="",
                message="nit",
                rule_id=None,
                confidence=None,
            )
        ],
    )
    tools = {tool.name: tool for tool in build_host_tools(bindings)}
    ctx = HostToolContext(
        tool_call_id="test-call",
        _cancel_event=threading.Event(),
        _send_update=lambda _payload: None,
    )
    result = await asyncio.to_thread(
        tools["post_review"].execute,
        {"body": "LGTM with nits", "conclusion": "neutral"},
        ctx,
    )
    assert "posted review" in result
    assert bindings.posted is True
    methods = [method for method, _ in transport.requests]
    assert "POST" in methods
    review_count = await db_pool.fetchval("SELECT COUNT(*) FROM reviews WHERE review_job_id = $1", job_id)
    assert int(review_count) == 1
