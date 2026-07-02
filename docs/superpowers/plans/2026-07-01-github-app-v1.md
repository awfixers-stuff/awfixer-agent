# GitHub App (prwatch) v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of the `github-app/` GitHub App (`prwatch` Python package + Go `gateway`): ingest PR webhooks into Postgres, run agent-RPC PR reviews on Railway workers with E2B for untrusted commands, post Check Runs and review comments, and expose a bearer-token REST API for the Android client.

**Architecture:** Go gateway is the stateless edge (HMAC webhooks, dedup, enqueue, migrations, REST, Check Run writes). Python workers claim `review_jobs` via `SELECT … FOR UPDATE SKIP LOCKED`, materialize PR worktrees on-host (clone pool like autoawfixer), drive `agent --mode rpc` with host-tools (`run_in_sandbox` → E2B, `record_finding`, GitHub post tools). Shared Postgres + `LISTEN/NOTIFY` on `review_job_queued`; no Redis broker in v1.

**Tech Stack:** Go 1.23 (`jackc/pgx/v5`, stdlib `net/http`), Python 3.11+ (`asyncpg`, `httpx`, `pydantic-settings`, `omp-rpc`, `e2b`), Postgres (Railway add-on), Railway (gateway + worker services), E2B sandboxes, omp from monorepo `pi-base` image (`awfixer-agent/agent:dev`).

**Planning decisions (spec §10 resolved):**

| Open question | v1 decision |
| --- | --- |
| Worker image base | `FROM ${PI_BASE}` default `awfixer-agent/agent:dev`, same as `Dockerfile.autoawfixer`. |
| Product name | Keep **`prwatch`** and **`github-app/gateway`**. |
| GitHub App secrets | **Railway env** on gateway + worker: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` (gateway), `DATABASE_URL`. |
| E2B | **`E2B_API_KEY`** on worker Railway service only. |

**Current scaffold:** Tasks 19–22 largely done in-repo; Tasks 1–2 partial; Tasks 3–18 remain.

**Spec → tasks:** §2–4 → Tasks 1–18; §5–6 → 3–5, 14, 16; §7 → 19–22; §8 → embedded per task + 23.

**Critical files:** `docs/superpowers/specs/2026-06-30-github-app-design.md`; pattern refs `python/autoawfixer/src/{queue,worker,host_tools,sandbox,github_client,logging_config,git_ops}.py`; `Dockerfile.autoawfixer`.

---

### Task 1: Migrations + store dedup test
**Files:** `github-app/gateway/internal/migrate/migrations/001_initial.sql`, `github-app/shared/fixtures/pull_request_opened.json`, `github-app/gateway/internal/store/store_test.go`

- [ ] Add fixture JSON (installation, repository, pull_request opened)
- [ ] `TestEnqueueReviewJob_dedupDeliveryID` with testcontainers Postgres
- [ ] `go test ./internal/store/... -run Dedup -v` → PASS
- [ ] Commit

### Task 2: Webhook handler IT
**Files:** `handler_test.go`

- [ ] POST fixture with valid HMAC → 202
- [ ] `go test ./internal/webhook/... -v` → PASS
- [ ] Commit

### Task 3: GitHub App auth (Go)
**Files:** `internal/auth/github_app.go`, tests

- [ ] JWT + installation token cache; mock GitHub API test
- [ ] Commit

### Task 4: Check Run reporter (Go)
**Files:** `internal/checks/checks.go`

- [ ] Start/Complete check runs named `prwatch`
- [ ] Commit

### Task 5: OpenAPI + REST API
**Files:** `shared/openapi.yaml`, `internal/api/*`, wire `main.go`

- [ ] All §6 endpoints; Argon2id bearer on `api_tokens`
- [ ] Commit

### Task 6: Worker scaffold
**Files:** `worker/pyproject.toml`, `src/prwatch/{config,cli,__main__}.py`, `tests/test_config.py`

- [x] Scaffold present (`config`, `cli`, `sandbox_exec` stub)
- [ ] `pytest tests/test_config.py -v` → PASS
- [ ] Commit

### Task 7: asyncpg claim + LISTEN
**Files:** `db.py`, `tests/test_db_claim.py`

- [x] `CLAIM_SQL` with SKIP LOCKED + per-PR running skip
- [ ] `pg_notify` listener wired in runner
- [ ] `reset_stuck_running`
- [ ] Commit

### Task 8: Claim loop stub
**Files:** `runner.py`

- [x] Semaphore `PRWATCH_MAX_CONCURRENCY`; marks jobs done (stub)
- [ ] Commit

### Task 9–18: Worktree, E2B full sync, omp_rpc, host_tools, prompts, github_client, full pipeline, API re-review, kernel stub, integration smoke

See PlanDoc full task list in agent transcript.

### Task 19–22: Docker + Railway + README
- [x] `Dockerfile.gateway`, `Dockerfile.worker`, `docker-compose.yml`, `railway.toml`, `.env.example`, `README.md`

### Task 23: Verification
- [ ] `go test ./...`; `pytest -x`; compose webhook → queued job

## Edge cases
Duplicate delivery → no job; concurrent running per PR → skip claim; bad HMAC → 401; E2B/omp failures → retry then failed; same SHA re-review → new job row.