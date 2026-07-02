from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from typing import Any

from omp_rpc import HostTool, HostToolContext, RpcCommandError, host_tool

from prwatch.db import FindingRow, insert_finding, insert_review
from prwatch.github_client import GitHubClient, GitHubError
from prwatch.sandbox_exec import SandboxRunner

_INJECTION_RE = re.compile(r"```|#{1,6}\s")


def sanitize_finding_text(text: str) -> str:
    return _INJECTION_RE.sub("", text).strip()


@dataclass(slots=True)
class ReviewBindings:
    job_id: int
    repo_full_name: str
    pr_number: int
    head_sha: str
    github: GitHubClient
    sandbox: SandboxRunner
    pool: Any
    loop: asyncio.AbstractEventLoop
    findings: list[FindingRow] = field(default_factory=list)
    check_run_id: int | None = None
    posted: bool = False


def _run_coro(loop: asyncio.AbstractEventLoop, coro: Any) -> Any:
    future = asyncio.run_coroutine_threadsafe(coro, loop)
    return future.result()


def _raise_command(message: str) -> None:
    raise RpcCommandError(message)


def build_host_tools(bindings: ReviewBindings) -> tuple[HostTool[Any, Any], ...]:
    return (
        _build_run_in_sandbox(bindings),
        _build_record_finding(bindings),
        _build_post_review(bindings),
    )


def _build_run_in_sandbox(bindings: ReviewBindings) -> HostTool[Any, Any]:
    def execute(args: dict[str, Any], _ctx: HostToolContext[Any]) -> str:
        command = args.get("command")
        if not isinstance(command, str) or not command.strip():
            _raise_command("run_in_sandbox requires non-empty 'command'")
        result = _run_coro(bindings.loop, bindings.sandbox.run(command.strip()))
        return (
            f"exit_code={result.exit_code}\n"
            f"--- stdout ---\n{result.stdout}\n"
            f"--- stderr ---\n{result.stderr}"
        )

    return host_tool(
        name="run_in_sandbox",
        description="Run untrusted PR commands inside an isolated E2B sandbox.",
        parameters={
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to execute in E2B"},
            },
            "required": ["command"],
            "additionalProperties": False,
        },
        execute=execute,
    )


def _build_record_finding(bindings: ReviewBindings) -> HostTool[Any, Any]:
    def execute(args: dict[str, Any], _ctx: HostToolContext[Any]) -> str:
        path = args.get("path")
        line = args.get("line")
        message = args.get("message")
        if not isinstance(path, str) or not path.strip():
            _raise_command("record_finding requires 'path'")
        if not isinstance(line, int) or line <= 0:
            _raise_command("record_finding requires positive integer 'line'")
        if not isinstance(message, str) or not message.strip():
            _raise_command("record_finding requires 'message'")
        severity = str(args.get("severity") or "info")
        category = str(args.get("category") or "")
        side = str(args.get("side") or "RIGHT")
        rule_id = args.get("rule_id")
        confidence = args.get("confidence")
        finding = FindingRow(
            path=path.strip(),
            line=line,
            side=side,
            severity=severity,
            category=category,
            message=sanitize_finding_text(message),
            rule_id=str(rule_id) if rule_id is not None else None,
            confidence=float(confidence) if isinstance(confidence, (int, float)) else None,
        )
        row_id = _run_coro(bindings.loop, insert_finding(bindings.pool, bindings.job_id, finding))
        bindings.findings.append(finding)
        return f"recorded finding id={row_id}; total={len(bindings.findings)}"

    return host_tool(
        name="record_finding",
        description="Record a structured PR review finding (persisted to Postgres).",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "line": {"type": "integer"},
                "message": {"type": "string"},
                "severity": {"type": "string"},
                "category": {"type": "string"},
                "side": {"type": "string", "enum": ["RIGHT", "LEFT"]},
                "rule_id": {"type": "string"},
                "confidence": {"type": "number"},
            },
            "required": ["path", "line", "message"],
            "additionalProperties": False,
        },
        execute=execute,
    )


def _build_post_review(bindings: ReviewBindings) -> HostTool[Any, Any]:
    def execute(args: dict[str, Any], _ctx: HostToolContext[Any]) -> str:
        body = args.get("body")
        if not isinstance(body, str) or not body.strip():
            _raise_command("post_review requires non-empty 'body' summary")
        conclusion = str(args.get("conclusion") or "neutral")
        if conclusion not in ("success", "failure", "neutral"):
            _raise_command("post_review conclusion must be success, failure, or neutral")
        comments = [
            {
                "path": item.path,
                "line": item.line,
                "side": item.side,
                "body": sanitize_finding_text(item.message),
            }
            for item in bindings.findings
        ]
        try:
            if bindings.check_run_id is None:
                bindings.check_run_id = _run_coro(
                    bindings.loop,
                    bindings.github.create_check_run(
                        repo=bindings.repo_full_name,
                        head_sha=bindings.head_sha,
                    ),
                )
            review = _run_coro(
                bindings.loop,
                bindings.github.submit_pr_review(
                    repo=bindings.repo_full_name,
                    pr_number=bindings.pr_number,
                    body=sanitize_finding_text(body.strip()),
                    event="COMMENT",
                    comments=comments,
                ),
            )
            _run_coro(
                bindings.loop,
                bindings.github.complete_check_run(
                    repo=bindings.repo_full_name,
                    check_run_id=bindings.check_run_id,
                    conclusion=conclusion,
                    summary=body.strip(),
                ),
            )
            review_row_id = _run_coro(
                bindings.loop,
                insert_review(
                    bindings.pool,
                    bindings.job_id,
                    github_review_id=review.id,
                    summary=body.strip(),
                    check_run_id=bindings.check_run_id,
                    conclusion=conclusion,
                ),
            )
        except GitHubError as exc:
            _raise_command(f"GitHub post_review failed: {exc.status} {exc.message}")
        bindings.posted = True
        return f"posted review id={review.id}; findings={len(comments)}; db_review={review_row_id}"

    return host_tool(
        name="post_review",
        description="Terminal tool: post GitHub PR review + complete prwatch Check Run.",
        parameters={
            "type": "object",
            "properties": {
                "body": {"type": "string", "description": "Summary review comment"},
                "conclusion": {
                    "type": "string",
                    "enum": ["success", "failure", "neutral"],
                    "description": "Check Run conclusion",
                },
            },
            "required": ["body"],
            "additionalProperties": False,
        },
        execute=execute,
    )
