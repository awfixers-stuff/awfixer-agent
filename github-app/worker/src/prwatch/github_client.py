from __future__ import annotations

import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import httpx

GITHUB_API = "https://api.github.com"
ACCEPT = "application/vnd.github+json"
API_VERSION = "2022-11-28"
CHECK_NAME = "prwatch"


class GitHubError(RuntimeError):
    def __init__(self, status: int, message: str, *, retry_after: float | None = None) -> None:
        super().__init__(f"GitHub {status}: {message}")
        self.status = status
        self.message = message
        self.retry_after = retry_after


@dataclass(slots=True, frozen=True)
class RepoInfo:
    full_name: str
    default_branch: str
    clone_url: str


@dataclass(slots=True, frozen=True)
class PullRequestInfo:
    repo: str
    number: int
    title: str
    body: str
    head_ref: str
    base_ref: str
    head_sha: str
    author: str


@dataclass(slots=True, frozen=True)
class PullRequestFileInfo:
    path: str
    status: str
    additions: int
    deletions: int


@dataclass(slots=True, frozen=True)
class PullRequestReviewInfo:
    id: int
    body: str
    state: str


def _parse_retry_after(resp: httpx.Response) -> float | None:
    ra = resp.headers.get("retry-after")
    if ra:
        try:
            return float(ra)
        except ValueError:
            pass
    reset = resp.headers.get("x-ratelimit-reset")
    if reset:
        try:
            return max(0.0, float(reset) - time.time())
        except ValueError:
            pass
    return None


class GitHubClient:
    def __init__(self, token: str, *, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._token = token
        self._transport = transport

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Accept": ACCEPT,
            "X-GitHub-Api-Version": API_VERSION,
            "User-Agent": "prwatch/0.1",
        }

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        async with httpx.AsyncClient(
            base_url=GITHUB_API,
            headers=self._headers(),
            transport=self._transport,
            timeout=httpx.Timeout(30.0, connect=10.0),
            follow_redirects=True,
        ) as client:
            resp = await client.request(method, path, **kwargs)
        if resp.status_code >= 400:
            retry_after = _parse_retry_after(resp)
            try:
                msg = resp.json().get("message", resp.text)
            except Exception:
                msg = resp.text
            raise GitHubError(resp.status_code, str(msg), retry_after=retry_after)
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()

    async def get_repo(self, repo: str) -> RepoInfo:
        data = await self.request("GET", f"/repos/{repo}")
        assert isinstance(data, dict)
        return RepoInfo(
            full_name=str(data["full_name"]),
            default_branch=str(data.get("default_branch") or "main"),
            clone_url=str(data["clone_url"]),
        )

    async def get_pull_request(self, repo: str, number: int) -> PullRequestInfo:
        data = await self.request("GET", f"/repos/{repo}/pulls/{number}")
        assert isinstance(data, dict)
        head = data.get("head") or {}
        base = data.get("base") or {}
        user = data.get("user") or {}
        return PullRequestInfo(
            repo=repo,
            number=number,
            title=str(data.get("title") or ""),
            body=str(data.get("body") or ""),
            head_ref=str(head.get("ref") or ""),
            base_ref=str(base.get("ref") or ""),
            head_sha=str(head.get("sha") or ""),
            author=str(user.get("login") or ""),
        )

    async def list_pr_files(self, repo: str, pr_number: int) -> list[PullRequestFileInfo]:
        data = await self.request("GET", f"/repos/{repo}/pulls/{pr_number}/files", params={"per_page": 100})
        files: list[PullRequestFileInfo] = []
        for item in data or []:
            if not isinstance(item, dict):
                continue
            files.append(
                PullRequestFileInfo(
                    path=str(item.get("filename") or item.get("path") or ""),
                    status=str(item.get("status") or ""),
                    additions=int(item.get("additions") or 0),
                    deletions=int(item.get("deletions") or 0),
                )
            )
        return files

    async def submit_pr_review(
        self,
        *,
        repo: str,
        pr_number: int,
        body: str,
        event: str,
        comments: list[Mapping[str, Any]],
    ) -> PullRequestReviewInfo:
        data = await self.request(
            "POST",
            f"/repos/{repo}/pulls/{pr_number}/reviews",
            json={"body": body, "event": event, "comments": comments},
        )
        assert isinstance(data, dict)
        return PullRequestReviewInfo(
            id=int(data.get("id") or 0),
            body=str(data.get("body") or body),
            state=str(data.get("state") or ""),
        )

    async def create_check_run(self, *, repo: str, head_sha: str) -> int:
        owner, name = repo.split("/", 1)
        data = await self.request(
            "POST",
            f"/repos/{owner}/{name}/check-runs",
            json={"name": CHECK_NAME, "head_sha": head_sha, "status": "in_progress"},
        )
        assert isinstance(data, dict)
        return int(data["id"])

    async def complete_check_run(
        self,
        *,
        repo: str,
        check_run_id: int,
        conclusion: str,
        summary: str,
    ) -> None:
        owner, name = repo.split("/", 1)
        await self.request(
            "PATCH",
            f"/repos/{owner}/{name}/check-runs/{check_run_id}",
            json={
                "status": "completed",
                "conclusion": conclusion,
                "output": {"title": CHECK_NAME, "summary": summary},
            },
        )

