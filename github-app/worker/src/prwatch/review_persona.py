from __future__ import annotations

from importlib import resources

from prwatch.db import JobContext
from prwatch.github_client import PullRequestFileInfo, PullRequestInfo


def _load_kickoff_template() -> str:
    return resources.files("prwatch").joinpath("prompts/kickoff_review.md").read_text(encoding="utf-8")


def build_kickoff_prompt(
    ctx: JobContext,
    pr: PullRequestInfo,
    files: list[PullRequestFileInfo],
) -> str:
    template = _load_kickoff_template()
    file_lines = "\n".join(
        f"- `{item.path}` ({item.status}, +{item.additions}/-{item.deletions})" for item in files
    ) or "(no files reported)"
    return template.format(
        repo=ctx.repo_full_name,
        pr_number=ctx.pr_number,
        title=pr.title or ctx.pr_title or "(untitled)",
        author=pr.author or ctx.pr_author,
        base_ref=pr.base_ref or ctx.base_ref,
        head_ref=pr.head_ref or ctx.head_ref,
        head_sha=ctx.head_sha,
        changed_files=file_lines,
    )
