# GitHub App — PR Review & Status Checks (v1 Design)

**Date:** 2026-06-30
**Status:** Draft, pending user review
**Working product name:** `prwatch` (Python package) + `github-app/gateway` (Go module). Editable.

## 1. Purpose & Positioning

A new GitHub App, stored at `github-app/` in this repo, that sits **between the codebase and `autoawfixer`** to review and validate every pull request across all our repos before merge. v1 ships one wedge: **PR review via an omp-RPC agent, plus GitHub Check Runs and inline review comments.** The agent runs on the Python worker host (reusing autoawfixer's proven omp-on-host + worktree model); untrusted code execution (the PR's tests/build/lint) is isolated in a fresh **E2B** sandbox per review. It is the surface every later capability plugs into.

The long-term product is a platform covering the roles of CodeRabbit (review), Mergify (gating), Semgrep (security), Sourcery (quality refactors), Renovate/Dependabot (deps), and cursor-agent (issue/PR finding). Each of those is a **separate phase with its own spec → plan → build cycle**; this document covers v1 only.

### Relationship to `autoawfixer`

- **New app, not a shared library.** We reuse autoawfixer's *patterns* (webhook HMAC verification, durable queue with `BEGIN IMMEDIATE`/`SELECT FOR UPDATE SKIP LOCKED`, host-tool audit surface, sync omp-RPC driver in a worker thread, prompts-as-data-files, credential redaction, structured JSON logging) but copy none of its code.
- `autoawfixer` keeps its job: issue triage → fix PRs. This app's job is to **review PRs** — including PRs `autoawfixer` opens. The two compose: autoawfixer produces PRs, this app gates them. Issue triage is **not** duplicated here.

### Stack (user-anchored)

- **Go** gateway + **Python** worker (two services).
- **Railway** hosting. **E2B** sandboxes per review. **Kernel** browsers opt-in.
- **Postgres** shared state (Railway Postgres add-on).

## 2. v1 Scope

### In scope

- GitHub App installed across all our repos.
- Triggers: `pull_request` (opened, synchronize, reopened, ready_for_review) and `pull_request_review_comment`.
- Worker materializes the PR as a git worktree on the worker host and runs an omp-RPC review agent against the diff. The agent reads the diff with built-in tools (read/grep/git on the local worktree) and runs the PR's *own* tests/build/lint via a `run_in_sandbox` host-tool the worker registers, which executes the command in a fresh E2B sandbox synced with the checkout. The built-in `bash` tool is used only for trusted commands (git, grep) and never for the PR's untrusted code.
- Agent findings become: (a) inline review comments on the diff, (b) one summary review comment, (c) a Check Run with pass/fail + annotated findings.
- Webhook-delivery dedup: duplicate `X-GitHub-Delivery` deliveries are dropped (no new job created). Re-review on the same SHA is *deterministic at the job level* (same inputs → same job) but **not at the finding level** — LLM reviews are non-deterministic; the contract is dedup + replayability, not byte-identical findings across runs.
- First-class REST API (auth-scoped) for the Android app: list repos, list PRs, list reviews, job status, trigger manual re-review, view findings.

### Out of scope (later phases, each its own spec)

- Security scanning (semgrep-style).
- Quality refactors (sourcery-style).
- Merge gating / merge queue (mergify-style).
- Dependency updates (renovate/dependabot-style).
- Issue triage (autoawfixer already does this — this app delegates, not duplicates).
- Scheduled sweeps, multi-VCS (GitLab/etc.), Slack triggers, human-in-the-loop approval flows.

## 3. Architecture

### 3.1 Division of labor (Go vs Python)

**Go gateway — the stateless edge:**
- Webhook ingest + HMAC-SHA256 verification (constant-time).
- Webhook event dedup (`X-GitHub-Delivery`).
- Event routing (only `pull_request*` + `pull_request_review_comment`).
- REST API for the Android app (auth, repos, PRs, reviews, jobs, manual re-review).
- Check Run status reporting to GitHub.
- Postgres schema migrations (one-shot via advisory lock — see §7).
- GitHub App installation-token minting + cache (for API + check writing).

Go **never** calls omp and **never** runs review logic.

**Python worker — the review engine:**
- Claims review jobs from Postgres (`SELECT … FOR UPDATE SKIP LOCKED`).
- Fetches PR metadata + diff via GitHub API (installation token).
- Materializes the PR as a git worktree on the worker host (clone pool + `--filter=blob:none`, mirrors autoawfixer's `SandboxManager`).
- Assembles the review persona from `prompts/*.md` data files with diff context.
- Drives `omp --mode rpc` on the worker host (synchronous, in a worker thread — directly mirroring autoawfixer's `worker.run_task`); agent read/grep/git tools operate on the local worktree.
- Spawns a fresh **E2B sandbox** per review for untrusted execution and registers a `run_in_sandbox(cmd)` host-tool (Python callback) alongside the review-specific host-tools. The review persona prompt instructs the agent to use `run_in_sandbox` for the PR's own tests/build/lint and `bash` only for trusted commands. This is the autoawfixer host-tool pattern — omp's built-in `bash` cannot be transparently proxied, so untrusted execution is a named tool the agent must call explicitly.
- Collects structured findings via a host-tool (mirrors autoawfixer's `host_tools.py` audit pattern).
- Posts GitHub review (inline comments + summary) + Check Run.
- Handles retries, backoff, credential redaction.

### 3.2 State sharing — shared Postgres, no broker

Go writes webhook events + review jobs to Postgres; Python claims rows atomically. Go's REST API reads job/review state from the same DB. **One state store, no message broker.** Worker is woken by Postgres `LISTEN/NOTIFY` on `review_job_queued` to keep latency sub-second without polling.

This is a direct port of autoawfixer's proven queue design (`BEGIN IMMEDIATE` claim contention, `_inflight` serialization, dedup on delivery id) to Postgres. We revisit a broker (Redis Streams / NATS JetStream) only if throughput demands it.

### 3.3 Repo layout

```
github-app/
  gateway/                      # Go service
    cmd/gateway/main.go
    internal/
      webhook/                  # GitHub HMAC verify + event routing
      api/                      # REST API for Android app
      checks/                   # Check Run status reporter
      store/                    # Postgres access (sqlc-generated)
      auth/                     # GitHub App JWT + installation tokens + API tokens
      config/                   # env config
    go.mod                      # module github.com/awfixerai/github-app/gateway
  worker/                       # Python service
    pyproject.toml
    src/prwatch/
      __main__.py, cli.py, config.py
      runner.py                 # claims jobs; materializes worktree; drives omp-RPC; registers host-tools (incl. run_in_sandbox → E2B)
      e2b_sandbox.py            # E2B SDK wrapper
      kernel_sandbox.py         # Kernel browser wrapper (opt-in)
      review_persona.py         # prompt assembly (prompts as .md data files)
      omp_rpc.py                # omp --mode rpc stdio subprocess client (sync, worker thread)
      github_client.py          # typed httpx client for posting reviews
      db.py                     # asyncpg access to shared Postgres
      host_tools.py             # agent's GitHub surface (audit pattern)
      logging_config.py         # structured JSON logging
      prompts/                  # *.md review personas (package data)
    tests/
  shared/
    migrations/                 # Postgres schema migrations (applied by gateway via advisory lock, see §7)
    openapi.yaml                # Android API contract (single source of truth)
    fixtures/                   # real GitHub webhook payloads for tests
  Dockerfile.gateway
  Dockerfile.worker
  docker-compose.yml            # local dev: postgres + gateway + worker
  railway.toml                  # Railway deploy (2 services + postgres addon)
  .env.example
  README.md
```

### 3.4 Data model (shared Postgres)

- `installations` — GitHub App `installation_id` → account login, repos synced.
- `repos` — `installation_id`, `full_name`, `default_branch`, `tracked` bool.
- `pull_requests` — `(repo_id, number, head_sha)` unique; `state`, `base`, `head`, `author`, `title`, `updated_at`. Upserted on every webhook.
- `review_jobs` — `id`, `pr_id`, `head_sha`, `trigger_event`, `delivery_id` (UNIQUE, dedup), `state` (`queued|running|done|failed`), `claimed_at`, `worker_id`, `attempts`, `max_attempts`, `enqueued_at`, `finished_at`, `last_error`. **This is the queue.** Claimed via `SELECT … FOR UPDATE SKIP LOCKED LIMIT 1`.
- `findings` — `id`, `review_job_id`, `path`, `line`, `side`, `severity`, `category`, `message`, `rule_id`, `confidence`. Structured review output.
- `reviews` — `id`, `review_job_id`, `github_review_id`, `summary`, `check_run_id`, `conclusion`.
- `api_tokens` — Android API tokens (Argon2id-hashed, scoped to user/installation).
- `audit_log` — every privileged action (job claimed, review posted, token used).

**Idempotency:** `review_jobs.delivery_id` UNIQUE + `INSERT … ON CONFLICT DO NOTHING` (autoawfixer's dedup pattern). Re-review on the same SHA creates a new `review_jobs` row linked to the same PR; findings are keyed to `review_job_id` so history is preserved across re-reviews.

**Per-PR serialization:** the claim query skips any PR that already has a `running` job (the SQL equivalent of autoawfixer's `_inflight` set).

### 3.5 Execution model — where omp runs, where E2B runs

This is the load-bearing architectural decision in the spec, so it's stated explicitly. v1 uses **architecture (c): omp-on-Railway-worker, E2B-for-untrusted-execution.**

Three layers, per review job:

1. **Local worktree (Railway worker host)** — the PR is materialized as a git worktree (clone pool + `--filter=blob:none`, mirrors autoawfixer's `SandboxManager`). This is trusted: it's just text the agent reads.
2. **omp-RPC subprocess (Railway worker host)** — the worker spawns `omp --mode rpc` as a local stdio subprocess, pipes JSON-RPC over stdin/stdout, and registers host-tools as Python callbacks (the autoawfixer pattern, unchanged). omp's `read`/`grep`/`git` tools operate on the local worktree. The App private key and Postgres connection stay on the worker — they never enter E2B.
3. **E2B sandbox (external, per-review)** — a fresh Firecracker microVM spawned per review job, holding a synced copy of the worktree. The worker registers a `run_in_sandbox(cmd)` host-tool (a Python callback in the omp-RPC host-tool surface, the same mechanism as autoawfixer's `host_tools.py`). When the agent needs to run the PR's *own* tests/build/lint (untrusted code), it calls `run_in_sandbox(cmd)`; the worker forwards `cmd` to E2B over the E2B SDK, executes it in isolation, and returns stdout/stderr/exit-code to the agent. The agent never sees E2B's filesystem directly; it sees command results. The built-in `bash` tool is **not** intercepted — it runs locally on the worker and the persona prompt restricts it to trusted commands (git, grep). There is no omp mechanism to override a built-in tool's execution target, so untrusted execution is a named host-tool the agent calls explicitly.

**Why this and not (a) runner-in-E2B or (b) full-worker-in-E2B:**
- (a) requires redesigning the host-tool pattern (omp inside E2B can't call Python callbacks on the worker) and puts the App key inside E2B. Rejected for v1.
- (b) puts the whole worker — Postgres client, App key, GitHub client — inside E2B. Broadest attack surface. Rejected for v1.
- (c) keeps omp's host-tool/callback model intact (direct port of autoawfixer), keeps credentials on the worker, and still isolates the only truly untrusted thing: the PR's build/test code. The "fragile network mount" concern doesn't apply because omp's file tools read the local worktree, not E2B; only *command execution* crosses the boundary, over E2B's SDK.

**E2B sync mechanism:** the worker `rsync`s (or `tar | untar` over the E2B SDK) the worktree into the sandbox at spawn time. Re-sync on `synchronize` events is a v1.1 optimization; v1 re-spawns. The E2B template is a minimal Linux + git + the PR's likely toolchains (detected per-repo: Node, Python, Rust, Go). Template selection is a planning-phase detail.

**v1.1 stretch:** promote omp itself into an E2B template (architecture (a)) once a template-feasibility smoke test confirms a ~2GB+ omp template snapshots/boots acceptably in Firecracker. This is an optimization, not a v1 blocker.

## 4. Event Flow (v1)

```
GitHub ──webhook──▶ Go gateway
  1. verify HMAC (X-Hub-Signature-256, constant-time)
  2. dedupe by X-GitHub-Delivery (INSERT … ON CONFLICT DO NOTHING)
  3. route: only pull_request* + pull_request_review_comment events
  4. upsert PR row; enqueue review_job (state=queued)
  5. NOTIFY 'review_job_queued'
  6. return 202
                  │
                  ▼
Python worker (N replicas, each an independent poller + processor)
  1. LISTEN for 'review_job_queued'; on wake, run claim loop
  2. claim: SELECT … FOR UPDATE SKIP LOCKED LIMIT 1
     → state=running, worker_id, claimed_at
     (skip any PR with an existing running job — per-PR serialization)
  3. fetch PR metadata + diff via GitHub API (installation token)
  4. materialize PR as a git worktree on the worker host (clone pool + --filter=blob:none)
  5. spawn a fresh E2B sandbox and sync the worktree into it (rsync/tar over E2B SDK)
  6. assemble review persona (prompts/*.md) with diff context
  7. drive omp --mode rpc on the worker host (sync, worker thread)
     — agent reads diff via omp built-in tools (read/grep/git on local worktree, trusted text)
     — agent runs the PR's own tests/build/lint via the `run_in_sandbox(cmd)` host-tool (Python callback → E2B); built-in `bash` is restricted by the persona to trusted commands only
  8. agent emits structured findings via a host-tool (Python callback)
     (mirrors autoawfixer's host_tools.py audit pattern)
  9. worker writes findings to the `findings` table
 10. post GitHub review (inline comments + summary) + Check Run
 11. commit transaction: state=done, finished_at; release worker_id
  on exception:
     state=failed, attempts++ (retry up to max_attempts with backoff + jitter)
     redact credentials in last_error before storing
```

**Concurrency:** configurable max concurrency per worker via `PRWATCH_MAX_CONCURRENCY` (default 4). Across replicas, `SKIP LOCKED` ensures disjoint claims.

**Kernel opt-in:** a review job flagged `needs_browser=true` (set when the PR touches UI paths — heuristic in gateway routing) spawns a Kernel browser session alongside E2B for any UI/e2e validation the persona requests. v1 ships the flag + plumbing; the first persona that uses it is a v1.1 stretch.

## 5. GitHub App Auth

- GitHub App (not OAuth bot) — per-repo installation tokens via the App's JWT → installation access token flow. Private key + App ID from env.
- Tokens are short-lived (1h), cached with expiry.
- Webhook secret per App for HMAC.
- **v1 default:** each service (gateway + worker) has the App private key and mints installation tokens independently. This avoids an inter-service dependency on the hot path. Gateway caches tokens for the API surface; worker caches for review posting.
- Permissions requested (minimal): `pulls: read+write`, `checks: write`, `contents: read`, `metadata: read`, `statuses: write`, `comments: write`.

## 6. Android REST API (Go gateway)

Single source of truth: `shared/openapi.yaml`. Auth: bearer token (`api_tokens`, Argon2id-hashed, scoped to installation + user). v1 endpoints:

- `GET /api/v1/me` — token identity.
- `GET /api/v1/installations` — installations the token can see.
- `GET /api/v1/repos?installation=` — tracked repos.
- `GET /api/v1/repos/{owner}/{repo}/prs` — open PRs with latest review state.
- `GET /api/v1/repos/{owner}/{repo}/prs/{number}` — PR + review history + findings.
- `GET /api/v1/repos/{owner}/{repo}/prs/{number}/reviews/{review_id}` — full findings.
- `POST /api/v1/repos/{owner}/{repo}/prs/{number}/re-review` — enqueue manual review job.
- `GET /api/v1/jobs/{id}` — job status (for live progress in the app).
- `GET /api/v1/healthz`.

Server-sent events for live job progress is a **v1.1 stretch**; v1 polls `GET /jobs/{id}`.

## 7. Deploy Topology (Railway)

- **Postgres** — Railway Postgres add-on (shared by gateway + worker).
- **gateway** — Railway service, `Dockerfile.gateway`, 2+ replicas, public webhook + API endpoints. Healthcheck on `/healthz`.
- **worker** — Railway service, `Dockerfile.worker`, 1+ replicas, scales horizontally (each replica claims disjoint jobs via `SKIP LOCKED`). No public ports. Env: `DATABASE_URL`, `E2B_API_KEY`, `KERNEL_API_KEY`, GitHub App key, `OMP_*`.
- **E2B** — external, invoked per-review.
- **Kernel** — external, invoked opt-in (flag on the review job for PRs that touch UI).
- **omp runtime** — the worker image bundles `omp` (built from this monorepo's pi image, slimmed — or pulls the published `oh-my-pi/pi` image as a base layer). This resolves the "lean runtime image" blocker from `transition-docs/expanding-robomp.md`.
- **Migrations** — a dedicated one-shot step (Railway pre-deploy hook or a `migrate` service) runs `migrate up` under a Postgres advisory lock (`pg_advisory_lock`) so 2+ gateway replicas don't race. Gateway replicas wait on the lock, then skip if the schema is already at the latest version. Alternative: a separate `migrate` Railway service with `restart: no` that runs once per deploy.
## 8. Testing, Error Handling, Security

### Testing

- **Go:** stdlib `net/http` + `jackc/pgx` + `sqlc` for query generation. Tests with `testing` + `testcontainers-go` for real Postgres. Webhook HMAC and event routing tested with real GitHub payload fixtures from `shared/fixtures/`.
- **Python:** `pytest` + `asyncio_mode=auto` (match autoawfixer). E2B mocked via a fake sandbox interface in unit tests. A smoke test gated on `PRWATCH_INTEGRATION=1` runs a real E2B review end-to-end. httpx `MockTransport` for GitHub (match autoawfixer's style — no `respx`).
- Tests assert observable contracts (DB state, HTTP requests emitted, review payloads) — not internal wiring.

### Error handling

- Structured JSON logging (port autoawfixer's `JsonFormatter`).
- Credential redaction before anything hits logs, audit, or `last_error` (port autoawfixer's `redact_credentials`).
- Custom exception types per failure class (`GitHubError` with `retry_after`, `E2BSandboxError`, `RpcCommandError`, `InvalidPullRequestRef`).
- Retries with exponential backoff + jitter; dead-letter after `max_attempts`.

### Security

- HMAC constant-time compare.
- Installation tokens never logged; API tokens Argon2id-hashed.
- **Prompt-injection defense:** the review agent treats diff content as untrusted *data*, not instructions (enforced in the persona prompt + by stripping code fences / markdown control chars from agent-emitted findings before posting to GitHub).
- **Execution boundary:** the PR's own tests/build/lint (untrusted code) run inside a fresh E2B Firecracker microVM per review — never on the Railway worker host. This is enforced by a `run_in_sandbox(cmd)` host-tool the worker registers; the persona prompt instructs the agent to use it for untrusted commands and to use the built-in `bash` only for trusted commands (git, grep). omp has no mechanism to override a built-in tool's execution target, so the boundary is a named host-tool, not transparent proxying.
- The App private key, Postgres DSN, and GitHub tokens stay on the worker and never enter E2B. omp's built-in `read`/`grep`/`git` operate on the local worktree (trusted text); only `run_in_sandbox` command results cross the E2B boundary.
## 9. Phased Roadmap (beyond v1)

Each phase gets its own spec → plan → build cycle. Order is by leverage and dependency:

1. **v1 (this spec)** — PR review + status checks.
2. **v1.1** — Kernel browser validation for UI PRs + SSE live job progress.
3. **v2** — Security scan (semgrep-style) as a second reviewer persona in the same job pipeline.
4. **v3** — Merge gating / merge queue (mergify-style) consuming the Check Runs v1 already emits.
5. **v4** — Dependency updates (renovate/dependabot-style) — scheduled triggers, a new trigger source on the same spine.
6. **v5** — Quality refactors (sourcery-style) — agent proposes refactors as suggestions.
7. **v6** — Issue/PR finding (cursor-agent style) — proactive sweeps across repos.

Issue triage stays in `autoawfixer`; this app delegates to it.

## 10. Open Questions (to resolve during planning, not now)

- **Worker image base:** slim `pi` image vs. published `oh-my-pi/pi` as base layer — decide during planning based on image size + omp availability.
- **`prwatch` name:** confirm or replace before scaffolding.
- **GitHub App registration:** who holds the App private key in prod (Railway env var vs. a secrets manager).
- **E2B cold-start budget:** E2B sandbox spin-up latency may dominate small-PR review time; planning phase should measure and decide on warm pools.

## 11. Non-Goals

- No rewrite of `autoawfixer`. No shared library extracted between them in v1 (patterns are reused, code is not).
- No message broker in v1 (Postgres + `LISTEN/NOTIFY`).
- No multi-VCS support in v1 (GitHub only).
- No human-in-the-loop approval flows in v1 (review is advisory; gating is v3).
- No in-process browser in v1 (Kernel is opt-in plumbing only).
