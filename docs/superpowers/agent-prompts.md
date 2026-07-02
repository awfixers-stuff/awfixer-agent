# Agent work prompts — awfixer-agent fork

> **Status (2026-07-02):** Fork rebrand is **landed in the working tree** (Phases 0–5 per `transition-docs/REBRANDING.md`). CLI is `agent`, npm scope is `@awfixerai/*`, config defaults to `~/.agent`, self-update polls `agent-api.awfixer.codes`, and `python/autoawfixer` replaced `robomp`. **~2700 files are uncommitted** — run the commit series in Prompt A before starting new feature work.

Copy-paste prompts for autonomous agents. Each prompt is self-contained: read the cited docs first, then execute. Run verification commands before claiming done. **Do not commit unless the prompt says to.**

**Repo context:** awfixer-agent monorepo. Primary package: `packages/coding-agent/` (`@awfixerai/agent`). Rules: `AGENTS.md` at repo root.

---

## What's done vs what's left

| Area | Status | Notes |
|------|--------|-------|
| npm scope `@awfixerai/*` | **Done** | Zero `@awfixer-agent/` imports in `.ts`/`.json` |
| CLI `agent` + `AGENT_*` env | **Done** | `omp` bin removed; `~/.omp` read fallback |
| Config `~/.agent` + `migrate-config` | **Done** | Flat default profile (no `~/.agent/agent/`) |
| Self-update repoint | **Done** | `main.ts` + `update-cli.ts` → `agent-api.awfixer.codes` |
| Extension compat (`@oh-my-pi/*`) | **Done** | `legacy-pi-compat.ts` + bundled registry |
| autoawfixer rename | **Done** | `python/autoawfixer/`, `AUTOAWFIXER_*`, `Dockerfile.autoawfixer` |
| Docs rebrand sweep | **Mostly done** | `scripts/docs-rebrand-sweep.ts` ran; stale refs remain in natives docs, android README, some `omp.sh` URLs |
| prwatch scaffold | **Done** | Committed `dd5ebe9`; gateway webhook+enqueue works; Tasks 1–18 remain |
| android-app scaffold | **Done** | Phase 1 Kotlin UI exists; no `gradlew` wrapper yet |
| `bun run check:ts` | **Passes** | All workspace packages typecheck |
| `bun run test:py` | **Passes** | Sandbox git-timeout shim + webhook enqueue race fixed (Prompt C) |
| autoawfixer deploy hardening | **Done** | uv-based gh-proxy, entrypoint proxy detect, compose env passthrough, healthz on `:6543` |
| Docker script alias | **Fixed** | `agent:image` added; `pi:image` delegates |
| `PI_BASE` build arg | **Open** | Still `PI_BASE` in compose/Dockerfiles (rename to `AGENT_BASE` optional) |
| prwatch v1 pipeline | **Not started** | No store dedup test, GitHub auth, checks, REST API, agent-RPC review |
| HTTP control API | **Not started** | Blocks Android Phase 2 |
| Windows drop | **Not started** | `win32-x64` still in `LEAF_TARGETS` and CI |
| autoawfixer triggers | **Not started** | GitHub logic still inline in `server.py` |
| Root README | **Missing** | No repo-root README for contributors |
| npm publish | **Not done** | Packages renamed but not published under `@awfixerai` |

---

## Suggested order (2026-07)

**Immediate (clean git history):** A → B

**Product tracks (pick one or parallelize):**
- Bots: C (autoawfixer hardening) or D+E (prwatch gateway + worker)
- Mobile: F → G (Android polish, then control API)
- Platform: H (drop Windows), I (trigger abstraction)

**Polish (anytime):** J (Docker arg cleanup), K (docs/README sweep)

---

## Prompt A — Land the rebrand commit series

```
You are working in awfixer-agent. ~2700 files of fork rebrand work are uncommitted.

Goal: Produce a clean, reviewable git history and push to origin. The user asked for strategic commits — not one giant blob.

Read first:
- transition-docs/REBRANDING.md (Phases 0–5 status)
- packages/coding-agent/CHANGELOG.md [Unreleased]
- git log --oneline -5 (scaffold commit dd5ebe9 already exists)

Proposed commit series (adjust if git detects conflicts, but keep this spirit):

1. `feat(rebrand)!: migrate monorepo to @awfixerai scope`
   Stage: packages/, bun.lock, bunfig.toml, root package.json (workspaces.catalog + deps only)

2. `feat(cli): agent binary, AGENT_* env vars, and ~/.agent config`
   Stage: packages/coding-agent/, packages/utils/ (if not fully in commit 1)

3. `chore(rebrand): rename robomp to autoawfixer`
   Stage: python/, Dockerfile.autoawfixer, delete Dockerfile.robomp*, python/autoawfixer/

4. `feat(update): repoint self-update to fork registry`
   Stage: packages/coding-agent/src/main.ts, packages/coding-agent/src/cli/update-cli.ts, packages/agent-api/ (if changed), transition-docs/update-checker-domains.md

5. `chore(docs): rebrand documentation sweep`
   Stage: docs/ (exclude docs/superpowers/agent-prompts.md for last commit), AGENTS.md

6. `chore(ci): update workflows and release scripts for fork`
   Stage: .github/, scripts/ci-*.ts, scripts/rebrand-codemod.ts, scripts/docs-rebrand-sweep.ts, scripts/install*.ts

7. `chore: update natives crates and root Dockerfiles`
   Stage: crates/, Cargo.toml, Dockerfile, Dockerfile.dockerignore, .gitignore

8. `docs(transition): update rebrand planning docs`
   Stage: transition-docs/

9. `chore: update product scaffolds and skills`
   Stage: github-app/, android-app/, docs/superpowers/plans/, docs/superpowers/specs/, .omp/

10. `fix(scripts): add agent:image docker build alias`
    Stage: package.json agent:image/agent:run + pi:image/pi:run delegates

11. `docs: refresh agent work prompts for fork status`
    Stage: docs/superpowers/agent-prompts.md only

Before each commit:
- `git diff --cached --stat` — sanity-check scope
- Do NOT commit secrets, `.env`, `.venv`, `node_modules`, or build artifacts

After all commits:
- `bun run check:ts` (must pass)
- `bun run ci:test:smoke` (if native build available)
- `git push origin HEAD`

Acceptance:
- `git status` clean (except intentionally gitignored)
- `rg '@awfixer-agent' --glob '!CHANGELOG.md' --glob '!transition-docs/**'` empty in .ts/.json
- `rg 'robomp|ROBOMP_' --glob '!transition-docs/**' --glob '!CHANGELOG.md'` only historical mentions
- Commit messages are complete sentences; breaking changes noted with `!`

Constraints: Follow AGENTS.md. User explicitly asked to commit and push.
```

---

## Prompt B — Bootstrap dev environment

```
Goal: Verify the repo is buildable from a clean checkout after the rebrand commits land.

Steps:
1. Read AGENTS.md.
2. `bun install`
3. `bun run build:native` (Rust natives)
4. `bun run check:ts` — report pre-existing failures separately from regressions
5. `bun run ci:test:smoke`
6. `bun run autoawfixer:install` then `bun run test:py`
7. Optionally `bun run install:local && agent --version && agent --smoke-test`

Deliverable: Pass/fail table per command, env gaps (Go, uv, Android SDK, Docker), daily dev commands.

Do not commit unless fixing a blocking regression you introduced.
```

---

## Prompt C — autoawfixer: fix test regression + deploy hardening

```
Goal: Green `bun run test:py` and reliable docker-compose on a fresh machine.

Read first:
- python/autoawfixer/README.md
- python/autoawfixer/tests/test_sandbox.py (failing `test_run_git_kills_hung_child`)
- python/autoawfixer/docker-compose.yml

Status (2026-07-02): **Done** — sandbox git-timeout test fixed (portable shim),
webhook enqueue race stabilized (`freeze_worker_pool` fixture), `.env.example` audited,
compose env passthrough added, `bun run test:py` + `autoawfixer:web:build` + docker
healthz verified.

Steps (historical):
1. Fix the failing test (root cause, not skip).
2. `uv run --directory python pytest -x autoawfixer/tests` — full pass.
3. Audit `.env.example`: all `AUTOAWFIXER_*` documented; no `ROBOMP_*`.
4. `bun run agent:image && bun run autoawfixer:build` (if Docker available).
5. `bun run autoawfixer:up` then healthz curl.
6. Optional: `AUTOAWFIXER_INTEGRATION=1 bun run autoawfixer:test:integration`.

Acceptance:
- `bun run test:py` passes
- README setup commands work end-to-end (or gaps listed with exact fixes)
- `bun run autoawfixer:web:build` succeeds

Out of scope: new triggers (Slack, cron) — see Prompt I.
```

---

## Prompt D — prwatch v1: Gateway (Tasks 1–5)

```
Goal: Complete github-app gateway Tasks 1–5.

Read first:
- docs/superpowers/plans/2026-07-01-github-app-v1.md (Tasks 1–5)
- docs/superpowers/specs/2026-06-30-github-app-design.md (§2–6)
- github-app/gateway/ (webhook HMAC + enqueue already work; no store_test.go yet)

Current state:
- `go test ./internal/webhook/...` passes
- `internal/store/` has EnqueueReviewJob but NO tests
- No GitHub App JWT auth, Check Runs, or REST API yet

Tasks:
1. Fixture JSON + `TestEnqueueReviewJob_dedupDeliveryID` (testcontainers Postgres)
2. Webhook integration test — valid HMAC → 202 (extend beyond route unit tests)
3. GitHub App JWT + installation token cache (Go), mock HTTP test
4. Check Run reporter — start/complete named `prwatch`
5. OpenAPI from `shared/openapi.yaml` + REST handlers + wire main.go; Argon2id bearer on api_tokens

Verification:
- `cd github-app/gateway && go test ./...` — all pass
- `docker compose -f github-app/docker-compose.yml up --build` — healthz OK

Constraints: Go gateway never calls agent CLI directly. Issue triage stays in autoawfixer only.
```

---

## Prompt E — prwatch v1: Worker pipeline (Tasks 6–18)

```
Goal: Wire Python prwatch worker from job claim through agent-RPC review to GitHub output.

Read first:
- docs/superpowers/plans/2026-07-01-github-app-v1.md (Tasks 6–18)
- github-app/worker/src/prwatch/ (runner, db, sandbox_exec stub)
- python/autoawfixer/src/{worker,host_tools,sandbox,github_client,git_ops}.py as patterns only
- python/omp-rpc/ for RPC client usage

Current state:
- Worker scaffold: config, cli, db claim SQL, runner semaphore loop
- `sandbox_exec.py` is a stub (`StubSandboxRunner`)
- No worktree materialization, omp_rpc driver, host_tools, or GitHub client yet
- Only test: `test_sandbox_stub.py`

Tasks (summary):
- Task 6–8: config tests, asyncpg LISTEN/NOTIFY in runner, `reset_stuck_running`
- Task 9: PR worktree materialization (clone pool like autoawfixer)
- Task 10: E2B `run_in_sandbox` full implementation (replace stub)
- Task 11–13: omp_rpc driver, host_tools (record_finding, post review), kickoff prompts
- Task 14–16: github_client, full pipeline, API-triggered re-review
- Task 17: Kernel browser stub (optional flag)
- Task 18: Integration smoke — webhook → queued → review posted

Verification:
- `cd github-app/worker && pytest -x`
- End-to-end compose test documented in github-app/README.md

Dependency: Prompt D (gateway enqueue + checks) should be done or stubbed for E2E.
Environment: E2B_API_KEY, DATABASE_URL, GitHub App credentials on worker service.
```

---

## Prompt F — Android companion: Phase 1 polish

```
Goal: Make android-app Phase 1 buildable, tested, and rebranded.

Read first:
- docs/superpowers/specs/2026-07-01-android-app-design.md
- android-app/README.md (still says "OMP" / "Oh My Pi" — update)
- packages/stats/src/server.ts (API contract)
- packages/stats/src/shared-types.ts (DTO shapes)

Current state:
- Kotlin + Compose UI scaffold exists under `io.ohmypi.agentcompanion`
- `StatsApiUrlTest.kt` unit test exists
- No `gradlew` wrapper — README says run `gradle wrapper` first
- Manage tab is honest offline stub (ControlRepository)

Steps:
1. `cd android-app && gradle wrapper` — commit gradlew + wrapper jar
2. Rebrand README: awfixer-agent / agent stats, not OMP
3. Align Kotlin DTOs with packages/stats shared types — fix drift
4. Add JVM unit tests with sample payloads from stats package tests
5. Manual test plan: emulator `10.0.2.2:3847`, host runs `agent stats`
6. Settings: base URL, bearer token, time range — verify DataStore persistence

Acceptance:
- `./gradlew :app:assembleDebug` succeeds
- `./gradlew :app:testDebugUnitTest` passes
- No hardcoded production secrets

Out of scope: live steer/abort (Phase 2 — needs Prompt G).
```

---

## Prompt G — HTTP control plane for agent (unblocks Android Phase 2)

```
Goal: Design and implement a minimal HTTP control API so remote clients can list sessions, steer, and abort.

Read first:
- docs/superpowers/specs/2026-07-01-android-app-design.md (§ Backend reality)
- packages/coding-agent/src/modes/rpc/rpc-types.ts (steer, abort, abort_and_prompt)
- packages/stats/src/server.ts (pattern for Bun.serve HTTP in this repo)

Current state: NOT IMPLEMENTED. No `control serve` command, no `/api/sessions` endpoints.

Spec deliverables:
1. Write docs/superpowers/specs/YYYY-MM-DD-agent-control-api.md:
   - Endpoints: list sessions, get status, POST steer, POST abort, optional SSE
   - Auth: bearer token, bind address, LAN-only defaults
   - Mapping to existing JSON-RPC methods
2. Implement v1 server (e.g. `agent control serve --port 3848`):
   - GET /api/sessions, POST /api/sessions/:id/steer, POST /api/sessions/:id/abort
   - Tests assert HTTP contract (behavior, not source grep)

Verification:
- `bun run check:ts`
- New tests in packages/coding-agent/test/
- Update android-app domain/ControlRepository to point at real endpoints

Dependency: Prompt F can wire Android Manage tab after this ships.
```

---

## Prompt H — Drop Windows platform support

```
Goal: Execute transition-docs/dropping-windows.md.

Read first:
- transition-docs/dropping-windows.md (full inventory)

Current state: `win32-x64` still present in:
- packages/natives/scripts/gen-npm-packages.ts (LEAF_TARGETS)
- scripts/ci-release-build-binaries.ts
- packages/coding-agent/src/cli/update-cli.ts (platform list)
- Various natives tests

Steps:
1. Remove win32-x64 from LEAF_TARGETS and binary release targets
2. Remove or gate Windows-specific modules per inventory
3. Update CI workflows
4. CHANGELOG [Unreleased] ### Breaking Changes
5. `bun run check:ts`, native build on Linux

Acceptance:
- No CI job publishes win32-x64 binaries
- Linux and darwin targets still build

Caution: Large diff — one focused commit; no drive-by refactors.
```

---

## Prompt I — autoawfixer: trigger abstraction

```
Goal: Extract GitHub webhook handling into a pluggable Trigger without changing behavior.

Read first:
- transition-docs/expanding-robomp.md
- python/autoawfixer/src/github_events.py, server.py, queue.py, worker.py

Steps:
1. `triggers/base.py` with Trigger ABC: `parse_event`, `route_to_task`, `dedup_key`
2. Move GitHub logic to `triggers/github/` — same HTTP routes, same sqlite schema
3. WorkerPool and SandboxManager unchanged; import paths only
4. All existing tests pass
5. Contract test: GitHub issues.opened fixture → same TaskInputs as before

Acceptance:
- `bun run test:py` full pass
- No new features (no Slack/cron)
- Document extension point in python/autoawfixer/README.md

Out of scope: output backend split, lean Docker image, PyPI publish.
```

---

## Prompt J — Docker/infra cleanup (remaining rebrand strings)

```
Goal: Finish optional infra renames left after the main rebrand.

Read first:
- transition-docs/REBRANDING.md (Phase 4 notes)
- Dockerfile, Dockerfile.autoawfixer, python/autoawfixer/docker-compose.yml
- github-app/docker-compose.yml

Remaining items:
- `PI_BASE` build arg → `AGENT_BASE` (with `PI_BASE` fallback + deprecation warning)
- `pi:image`/`pi:run` scripts → already delegated to `agent:image`/`agent:run`; consider removing aliases in a later release
- Stale `@awfixer-agent/agent-natives-*` references in docs/natives-*.md → `@awfixerai/natives` leaf naming
- `qa.omp.sh` grievances endpoint default — decide fork URL or disable

Steps:
1. Grep `PI_BASE|@awfixer-agent/agent-natives|qa\.omp\.sh` outside CHANGELOG/transition-docs
2. Apply mechanical fixes with backward compat
3. `docker compose --project-directory python/autoawfixer config` validates
4. CHANGELOG [Unreleased] if user-visible

Acceptance:
- `bun run agent:image` works (not just `pi:image`)
- New clones follow README without dead script names
```

---

## Prompt K — Root README and contributor onboarding

```
Goal: New contributors can onboard without hunting package READMEs.

Read first:
- packages/coding-agent/README.md
- transition-docs/REBRANDING.md
- python/autoawfixer/README.md, github-app/README.md, android-app/README.md

Steps:
1. Create repo-root README.md with:
   - What awfixer-agent is (fork of oh-my-pi)
   - Quick start: `bun install`, `bun run install:local`, `agent --version`
   - Package map (table from AGENTS.md)
   - Links to autoawfixer, prwatch, android companion
   - Contributing: `bun run check`, `bun run test:ts`, `bun run test:py`
2. Audit remaining `omp.sh` / `oh-my-pi` in user-facing help strings (not CHANGELOG history)
3. `bun run check:ts`

Acceptance:
- Root README exists and is accurate
- `agent --help` URLs match fork (agent.awfixer.codes / awfixers-stuff/awfixer-agent)

Do not rewrite all 100+ docs/tools/*.md — fix broken links only.
```

---

## Quick reference: verification commands

| Area | Command |
|------|---------|
| Typecheck | `bun run check:ts` |
| Full check (+ Rust) | `bun run check` |
| TS tests | `bun run test:ts` |
| Python | `bun run test:py` |
| Smoke | `bun run ci:test:smoke` |
| Agent Docker image | `bun run agent:image` |
| autoawfixer Docker | `bun run autoawfixer:build && bun run autoawfixer:up` |
| prwatch gateway | `cd github-app/gateway && go test ./...` |
| prwatch worker | `cd github-app/worker && pytest -q` |
| Android | `cd android-app && ./gradlew :app:assembleDebug` |
| Local CLI | `bun run install:local && agent --smoke-test` |

---

## Parallelization guide

| Can run in parallel | Must wait for |
|---------------------|---------------|
| B, C, D, F, H, I, J, K | A (commits landed) |
| E | D (partial gateway) |
| G | none (F benefits after) |
| Android Phase 2 wiring | G |

**Minimum path to clean git:** A → B

**Minimum path to green Python:** A → C

**Minimum path to PR review bot:** A → D → E

**Minimum path to mobile control:** A → F → G