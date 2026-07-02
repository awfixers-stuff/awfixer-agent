# Agent work prompts — awfixer-agent fork

> **Status (2026-07-01):** Fork rebrand is **committed and pushed** (10-commit series through `21129b5`). Git is clean. CLI is `agent`, npm scope is `@awfixerai/*`, config defaults to `~/.agent`, and `python/autoawfixer` replaced `robomp`. **prwatch gateway Tasks 1–5 are done** (`go test ./...` passes). **prwatch worker Tasks 6–18 remain** — this is the primary product track.

Copy-paste prompts for autonomous agents. Each prompt is self-contained: read the cited docs first, then execute. Run verification commands before claiming done. **Do not commit unless the prompt says to.**

**Repo context:** awfixer-agent monorepo. Primary package: `packages/coding-agent/` (`@awfixerai/agent`). Rules: `AGENTS.md` at repo root.

---

## What's done vs what's left

| Area | Status | Notes |
|------|--------|-------|
| Rebrand commit series | **Done** | `c9f5f97`…`21129b5`; `git status` clean |
| npm scope `@awfixerai/*` | **Done** | Zero `@awfixer-agent/` imports in `.ts`/`.json` |
| CLI `agent` + `AGENT_*` env | **Done** | `omp` bin removed; `~/.omp` read fallback |
| Config `~/.agent` + `migrate-config` | **Done** | Flat default profile (no `~/.agent/agent/`) |
| Self-update repoint | **Partial** | URLs → `agent-api.awfixer.codes`; checker **disabled** until npm publish |
| Extension compat (`@oh-my-pi/*`) | **Done** | `legacy-pi-compat.ts` + bundled registry |
| autoawfixer rename | **Done** | `python/autoawfixer/`, `AUTOAWFIXER_*`, `Dockerfile.autoawfixer` |
| autoawfixer tests + deploy | **Done** | `bun run test:py` — 563 passed; compose healthz on `:6543` |
| Docs rebrand sweep | **Mostly done** | Stale refs in `docs/natives-*.md`, `android-app/README.md`, collab-web URLs |
| prwatch gateway (Tasks 1–5) | **Done** | Dedup store test, webhook HMAC IT, GitHub JWT auth, Check Runs, REST API + bearer |
| prwatch Docker/Railway (Tasks 19–22) | **Done** | `Dockerfile.gateway`, `Dockerfile.worker`, compose, `railway.toml` |
| prwatch worker pipeline (Tasks 6–18) | **Not started** | Claim loop stub only; no LISTEN/NOTIFY, worktree, omp_rpc, GitHub post |
| HTTP control API | **Not started** | Blocks Android Phase 2 |
| android-app Phase 1 | **Partial** | Kotlin UI exists; no `gradlew`; `io.ohmypi` package; OMP branding in README |
| Windows drop | **Not started** | `win32-x64` still in `LEAF_TARGETS` and CI |
| autoawfixer triggers | **Not started** | GitHub logic still inline in `server.py` |
| Root README | **Missing** | No repo-root `README.md` |
| npm publish | **Not done** | `private: true`; workspace `overrides` pin `catalog:` |
| `PI_BASE` build arg | **Open** | Still `PI_BASE` in Dockerfiles/compose (rename to `AGENT_BASE` optional) |
| `qa.omp.sh` grievances default | **Open** | `settings-schema.ts` default still upstream URL |

**Verified 2026-07-01:** `bun run check:ts` passes · `bun run test:py` 563 passed · `go test ./...` (gateway) passes · worker `pytest` 1 passed (stub only)

---

## Suggested order (2026-07)

**Primary product track:** A (prwatch worker) — gateway is ready to enqueue jobs

**Parallel tracks (independent):**
- Mobile: B → C (Android polish, then control API)
- Platform: D (drop Windows), E (trigger abstraction)
- Infra/publish: F (Docker cleanup), G (README), H (npm publish)

**Verification anytime:** I (bootstrap dev env)

---

## Prompt A — prwatch v1: Worker pipeline (Tasks 6–18)

```
Goal: Wire Python prwatch worker from job claim through agent-RPC review to GitHub output.

Read first:
- docs/superpowers/plans/2026-07-01-github-app-v1.md (Tasks 6–18)
- docs/superpowers/specs/2026-06-30-github-app-design.md (§3–5)
- github-app/worker/src/prwatch/ (runner, db, sandbox_exec)
- python/autoawfixer/src/{worker,host_tools,sandbox,github_client,git_ops}.py as patterns only
- python/omp-rpc/ for RPC client usage

Current state (verified 2026-07-01):
- Gateway Tasks 1–5 DONE: `cd github-app/gateway && go test ./...` all pass
- Worker scaffold: config, cli, db claim SQL (`SKIP LOCKED` + per-PR running skip), runner semaphore loop
- `sandbox_exec.py`: StubSandboxRunner + partial E2BSandboxRunner (no worktree sync yet)
- `db.listen_for_jobs()` exists but runner uses poll-only (`asyncio.sleep(1)`)
- No `reset_stuck_running`, worktree materialization, omp_rpc driver, host_tools, or github_client
- Only test: `tests/test_sandbox_stub.py` (1 passed)
- `prompts/kickoff_review.md` exists but unused

Tasks:
- Task 6: `tests/test_config.py` — settings validation
- Task 7: Wire `pg_notify` listener in runner; `reset_stuck_running` on startup
- Task 8: Commit claim-loop scaffold (already functional stub)
- Task 9: PR worktree materialization (clone pool like autoawfixer)
- Task 10: E2B `run_in_sandbox` — full worktree sync (replace marker stub in `ensure_session`)
- Task 11–13: omp_rpc driver, host_tools (record_finding, post review), kickoff prompt wiring
- Task 14–16: github_client, full pipeline, API-triggered re-review (gateway REST ready)
- Task 17: Kernel browser stub (optional `needs_browser` flag)
- Task 18: Integration smoke — webhook → queued → review posted (document in github-app/README.md)

Verification:
- `cd github-app/worker && pytest -x` — all pass
- End-to-end compose test: `docker compose -f github-app/docker-compose.yml up --build`
- Gateway already enqueues; worker must consume and post results

Environment: E2B_API_KEY, DATABASE_URL, GitHub App credentials on worker service.
Constraints: Worker drives `agent --mode rpc`; gateway never calls agent CLI directly.
```

---

## Prompt B — Android companion: Phase 1 polish

```
Goal: Make android-app Phase 1 buildable, tested, and rebranded.

Read first:
- docs/superpowers/specs/2026-07-01-android-app-design.md
- android-app/README.md (still says "OMP" / "Oh My Pi" — update)
- packages/stats/src/server.ts (API contract)
- packages/stats/src/shared-types.ts (DTO shapes)

Current state:
- Kotlin + Compose UI under `io.ohmypi.agentcompanion` (rebrand package to `io.awfixerai.agentcompanion` optional)
- `StatsApiUrlTest.kt` unit test exists
- No `gradlew` wrapper — README says run `gradle wrapper` first
- Manage tab is honest offline stub (`OfflineControlRepository`)

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

Out of scope: live steer/abort (Phase 2 — needs Prompt C).
```

---

## Prompt C — HTTP control plane for agent (unblocks Android Phase 2)

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

Dependency: Prompt B can wire Android Manage tab after this ships.
```

---

## Prompt D — Drop Windows platform support

```
Goal: Execute transition-docs/dropping-windows.md.

Read first:
- transition-docs/dropping-windows.md (full inventory)

Current state: `win32-x64` still present in:
- packages/natives/scripts/gen-npm-packages.ts (LEAF_TARGETS)
- scripts/ci-release-build-binaries.ts
- packages/coding-agent/src/cli/update-cli.ts (platform list)
- packages/natives/test/windows-staging.test.ts and related natives tests

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

## Prompt E — autoawfixer: trigger abstraction

```
Goal: Extract GitHub webhook handling into a pluggable Trigger without changing behavior.

Read first:
- transition-docs/expanding-robomp.md
- python/autoawfixer/src/github_events.py, server.py, queue.py, worker.py

Current state: No `triggers/` package; GitHub logic inline in server.py.

Steps:
1. `triggers/base.py` with Trigger ABC: `parse_event`, `route_to_task`, `dedup_key`
2. Move GitHub logic to `triggers/github/` — same HTTP routes, same sqlite schema
3. WorkerPool and SandboxManager unchanged; import paths only
4. All existing tests pass (563+ today)
5. Contract test: GitHub issues.opened fixture → same TaskInputs as before

Acceptance:
- `bun run test:py` full pass
- No new features (no Slack/cron)
- Document extension point in python/autoawfixer/README.md

Out of scope: output backend split, lean Docker image, PyPI publish.
```

---

## Prompt F — Docker/infra cleanup (remaining rebrand strings)

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
- `qa.omp.sh` grievances endpoint default in settings-schema.ts — decide fork URL or disable

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

## Prompt G — Root README and contributor onboarding

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

## Prompt H — npm publish + enable self-update

```
Goal: Publish `@awfixerai/*` packages and re-enable the self-update checker.

Read first:
- transition-docs/npm-scope-rebrand.md
- transition-docs/update-checker-domains.md
- packages/coding-agent/src/cli/update-cli.ts (checker disabled at lines ~250, ~837)

Current state:
- Root `package.json` has `private: true` and workspace `overrides` pinning catalog deps
- Self-update throws "disabled pending rebrand" despite URLs pointing at agent-api.awfixer.codes
- Homebrew tap not published (`awfixer/tap/agent`)

Steps:
1. Decide publish scope: which packages ship to npm vs stay private
2. Remove or narrow workspace `overrides` after first publish
3. Publish `@awfixerai/agent` and leaf natives packages
4. Re-enable self-update checker and binary download in update-cli.ts
5. Verify `agent update --check` resolves a version from registry
6. CHANGELOG [Unreleased] for publish + self-update restore

Acceptance:
- `bun add @awfixerai/agent` works from a clean project
- `agent update --check` returns version (not "disabled pending rebrand")
- `bun run check:ts` passes

Out of scope: upstream `@oh-my-pi/*` redirect metapackages (track separately).
```

---

## Prompt I — Bootstrap dev environment

```
Goal: Verify the repo is buildable from a clean checkout.

Steps:
1. Read AGENTS.md.
2. `bun install`
3. `bun run build:native` (Rust natives)
4. `bun run check:ts` — report pre-existing failures separately from regressions
5. `bun run ci:test:smoke`
6. `bun run autoawfixer:install` then `bun run test:py`
7. `cd github-app/gateway && go test ./...`
8. `cd github-app/worker && pytest -q`
9. Optionally `bun run install:local && agent --version && agent --smoke-test`

Deliverable: Pass/fail table per command, env gaps (Go, uv, Android SDK, Docker), daily dev commands.

Do not commit unless fixing a blocking regression you introduced.
```

---

## Completed work (archive — do not re-run)

These prompts are **done** as of 2026-07-01. Kept for history only.

| Old prompt | Status | Evidence |
|------------|--------|----------|
| **Land rebrand commit series** | Done | `c9f5f97`…`21129b5`, git clean |
| **autoawfixer test + deploy** | Done | 563 pytest passed; compose healthz |
| **prwatch gateway Tasks 1–5** | Done | `store_test.go`, `handler_test.go`, `github_app_test.go`, `checks_test.go`, `handlers_test.go` |

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
| B, C, D, E, F, G, H, I | none (rebrand landed) |
| Android Phase 2 wiring | C (control API) |
| prwatch E2E smoke (Task 18) | A (worker pipeline) |
| Self-update restore | H (npm publish) |

**Minimum path to PR review bot:** A (worker Tasks 6–18)

**Minimum path to mobile control:** B → C

**Minimum path to public install:** H

**Sanity check after any prompt:** I