# Expanding robomp → auto-awfixer

Broad exploration of how the existing robomp (self-hosted GitHub triage/fix bot) could be rebranded and expanded into **auto-awfixer** — a general-purpose autonomous agent framework.

> **Superseded (2026-07):** The bot was renamed to **autoawfixer** (`python/autoawfixer/`, `AUTOAWFIXER_*`, `Dockerfile.autoawfixer`). This document remains as historical exploration; see `REBRANDING.md` and `python/autoawfixer/README.md` for the shipped layout.

---

## Current State: robomp Architecture

robomp is a _single-purpose_ bot that does exactly one thing:

> For every GitHub issue opened in an allowlisted repo: classify → reproduce → fix → PR (bugs), or answer (questions/enhancements).

**Key constraints of the current design:**

- **Scope-limited**: Only processes GitHub issues in allowlisted repos. One entrypoint (`POST /webhook/github`).
- **Sequential per-issue**: In-flight set keyed on `(owner, repo, number)` serializes work per issue.
- **Single-output model**: Always produces a GitHub artifact (comment, PR, label change).
- **Host-tool surface**: Minimal — `classify_issue`, `set_issue_labels`, `gh_post_comment`, `repro_record`, `gh_push_branch`, `gh_open_pr`, `gh_request_review`, `mark_unable_to_reproduce`, `abort_task`, `fetch_issue_thread`.
- **Tightly coupled to pi image**: Requires `pi-base` Docker image with `omp --mode rpc`, Bun, Rust natives, and the full oh-my-pi checkout.

---

## Rebranding Surface

Renaming from `robomp` to `auto-awfixer` (or similar) touches:

| Layer | Current | Target |
|-------|---------|--------|
| PyPI package | `robomp` | `auto-awfixer` |
| CLI entrypoint | `robomp serve / triage / replay / status / cleanup` | `auto-awfixer ...` |
| Env prefix | `ROBOMP_*` | `AWFIXER_*` (e.g., `AWFIXER_BOT_LOGIN`) |
| Docker image | `awfixer-agent/agent:dev` (extended by `Dockerfile.robomp`) | `awfixer/agent:dev` or split into base + worker |
| Docker compose | `docker-compose.yml` in `python/robomp/` | Move to repo root and adapt |
| Directory | `python/robomp/` | `python/auto-awfixer/` or `services/auto-awfixer/` |
| Bot login | `robomp` (GitHub mention) | `auto-awfixer` or `awfixer-bot` |
| Config file | `robomp.sqlite` | `awfixer.sqlite` |
| Data dir | `/data/` (container) | `/data/awfixer/` or configurable |
| GitHub repo refs | `awfixers-stuff/awfixer-agent` | `awfixer/auto-awfixer` |

The prompt templates in `src/prompts/` reference the bot's identity — these need updating:

- `src/prompts/triage.md` — Bot's role description, allowed actions, identity.
- System prompt persona — "You are roboomp" → "You are auto-awfixer".

---

## Expansion: From GitHub Bot to General Agent Framework

### Short-term: Multi-Trigger Bot

Keep the GitHub triage core but add additional trigger surfaces:

**1. Multiple webhook sources**
- GitHub Issues / PRs (current).
- GitHub Discussions (new).
- GitLab webhooks (new).
- Jira webhooks (new).
- Linear webhooks (new).
- Slack slash commands / events (new, via separate endpoint).

Each trigger maps to a persona (`triage.md`, `discussion-answer.md`, `jira-ticket.md`) but reuses the same `WorkerPool` + `SandboxManager` + `omp --mode rpc` backend.

**2. Scheduled / cron triggers**
- Daily dependency bump scan → creates issues/PRs.
- Weekly stale issue sweeper.
- Periodic health check on repos.

**3. Manual CLI-driven tasks**
- "Process all unread notifications."
- "Audit repo X for common configuration issues."
- "Generate release notes from merged PRs since last tag."

### Medium-term: Agent-as-a-Service

Decouple the "event processing loop" from "GitHub bot" entirely:

```
auto-awfixer/
  core/              ← shared runtime (queue, sandbox, worker, config, db)
  triggers/          ← webhook handlers, schedulers, CLI commands
    github/          ← existing GitHub trigger + persona
    gitlab/
    slack/
    jira/
    cron/
    cli/
  outputs/           ← output backends (plugin architecture)
    github/          ← current host_tools.py
    slack/
    email/
    webhook/
```

Each trigger produces a `TaskInputs` and the output backend is selected by the persona.

**Key architectural change**: Decouple the "issue → comment/PR" pipeline into **trigger → plan → execute → publish**:

1. **Trigger** receives event (any source).
2. **Plan** selects persona + output backend based on event type + config.
3. **Execute** runs `omp --mode rpc` with the persona, scoped to a worktree/sandbox.
4. **Publish** routes the agent's output through the selected backend (GitHub PR, Slack message, email, etc.).

### Long-term: Fully Autonomous Development Agent

The framework could evolve into a general-purpose autonomous devops agent:

- **Multi-repo orchestration**: Operate across an org's repos, not just allowlisted ones.
- **Self-hosted agent fleet**: Multiple instances for different teams/repos, coordinated through a shared queue.
- **Persistent memory**: Long-running SQLite stores of project conventions, past decisions, known failure modes — not just per-issue sessions.
- **Human-in-the-loop**: Before destructive actions (force-push, close PR, delete branch), request approval via Slack/email/approval endpoint.
- **Custom personas per project**: Per-repo configuration of model, temperature, allowed tools, review workflow.
- **Plugin system for host tools**: Users write custom `host_tools.py` modules in a plugin directory — not hardcoded in the dispatcher.

---

## Blockers & Open Questions

### Blocker: Tight pi Image Coupling

The current bot requires the full `awfixer-agent/agent:dev` image (Bun + Rust natives + omp source + python). This is ~2GB+ and includes the entire monorepo. For auto-awfixer to be a standalone product, it needs a **lean runtime image** that ships only:

- The compiled `agent` binary (or `omp --mode rpc`).
- Python runtime + auto-awfixer package.
- Minimal system dependencies (git, ssh, ca-certificates).

The monorepo-at-runtime model (`AGENT_ROOT` mount) was convenient for development but is not a deployment artifact.

### Blocker: Agent Session Model

Currently one `omp --mode rpc` session = one issue triage. For expanded use cases:
- How long does a session live? (One webhook? One day? Indefinite?)
- Can one agent instance handle multiple tasks, or do we spawn per-task?
- What's the state management between sessions for long-running agents?

The current model (per-issue session_dir + `--continue` for follow-ups) works for issue threads but may not generalize to multi-turn conversational agents.

### Question: Should the Agent Be Stateless or Stateful?

- **Stateless** (current): Each issue is a fresh session, loaded with issue context. Clean, simple, no leak between sessions.
- **Stateful**: Agent remembers previous issues, learns project conventions over time, adapts its behavior. More powerful but complex.

A hybrid: stateless per-task, but a shared "project memory" database that sessions can query/update.

### Question: Python or Go or Rust?

The current bot is Python (FastAPI + httpx + SQLite). For a broader agent framework:
- **Keep Python**: Rich ecosystem for webhooks, SQL, scheduling. Slow at startup but fine for long-running services.
- **Rewrite in Go**: Lower memory, faster startup, single binary deployment. Better for a "agent daemon" product.
- **Rewrite in Rust (or Zig)**: Maximum performance, but slower development velocity.

Recommendation: **Keep Python** for the orchestration layer (webhooks, queue, DB, scheduling). The heavy lifting (agent reasoning) is already done by `omp --mode rpc` — Python just manages lifecycle. Rewriting the orchestration buys little.

### Question: Naming

- `auto-awfixer` — explicit about the automation aspect.
- `awfixer-bot` — shorter, matches GitHub bot naming convention.
- `awfixer-agent` — consistent with the CLI rebrand `agent`.
- `awfixer` alone — cleanest but may be too generic.

---

## Migration Path (Suggested)

| Phase | What | Time |
|-------|------|------|
| 0 | Rebrand: rename Python package, env vars, Docker image, bot login. No functional changes. | Immediate |
| 1 | Decouple triggers from GitHub: introduce `Trigger` ABC, move existing GitHub handling into `triggers/github/`. | 1-2 weeks |
| 2 | Add second trigger (Slack or cron) to validate the abstraction. | 1 week |
| 3 | Decouple output backends: `OutputBackend` ABC, move GitHub host tools into `outputs/github/`. | 1 week |
| 4 | Build lean runtime image (agent binary + python + git, no monorepo). | 1 week |
| 5 | Ship as standalone `auto-awfixer` package on PyPI + Docker Hub. | Release |

Phase 0 alone is the minimal rebrand. Phases 1-5 turn it into a platform.
