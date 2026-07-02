from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from omp_rpc import RpcClient

from prwatch.config import Settings
from prwatch.db import JobContext
from prwatch.host_tools import ReviewBindings, build_host_tools
from prwatch.sandbox_exec import SandboxRunner
from prwatch.worktree import Worktree

log = logging.getLogger(__name__)

_SCRUBBED_ENV_KEYS: tuple[str, ...] = (
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_TOKEN",
    "DATABASE_URL",
    "E2B_API_KEY",
    "KERNEL_API_KEY",
)


@dataclass(slots=True)
class ReviewResult:
    assistant_text: str
    findings_count: int
    posted: bool


def _build_rpc_env() -> dict[str, str]:
    return dict.fromkeys(_SCRUBBED_ENV_KEYS, "")


def _run_review_sync(
    settings: Settings,
    ctx: JobContext,
    worktree: Worktree,
    sandbox: SandboxRunner,
    bindings: ReviewBindings,
    kickoff_prompt: str,
) -> ReviewResult:
    thinking = settings.thinking if settings.thinking != "off" else None
    with RpcClient(
        executable=settings.omp_command,
        cwd=worktree.repo_dir,
        session_dir=worktree.session_dir,
        env=_build_rpc_env(),
        no_session=False,
        no_title=True,
        model=settings.model,
        provider=settings.provider,
        thinking=thinking,
        custom_tools=build_host_tools(bindings),
        request_timeout=settings.request_timeout_seconds,
        startup_timeout=60.0,
    ) as client:
        client.install_headless_ui()
        turn = client.prompt_and_wait(kickoff_prompt, timeout=settings.task_timeout_seconds)
        posted = bindings.posted
        return ReviewResult(
            assistant_text=turn.require_assistant_text() if turn.assistant_message else "",
            findings_count=len(bindings.findings),
            posted=posted,
        )


async def run_review(
    settings: Settings,
    ctx: JobContext,
    worktree: Worktree,
    sandbox: SandboxRunner,
    bindings: ReviewBindings,
    kickoff_prompt: str,
) -> ReviewResult:
    return await asyncio.to_thread(
        _run_review_sync,
        settings,
        ctx,
        worktree,
        sandbox,
        bindings,
        kickoff_prompt,
    )
