# Agent work prompts — awfixer-agent fork

Copy-paste prompts for autonomous agents. Each prompt is self-contained: read the cited docs first, then execute. Run verification commands before claiming done. **Do not commit unless the prompt says to.**

**Repo context:** Fork of oh-my-pi → awfixer-agent. Primary package: `packages/coding-agent/`. Rules: `AGENTS.md` at repo root.

**Suggested order:** Prompts 0 → 1 → 2 are prerequisites for most other work. Prompts 3–5 are parallel after 2. Prompts 6–8 are product tracks (pick one). Prompts 9–12 are longer-horizon.

---

## Prompt 0 — Bootstrap dev environment

```
You are working in the awfixer-agent monorepo (fork of oh-my-pi).

Goal: Make the repo buildable and verifiable from a clean checkout.

Steps:
1. Read AGENTS.md (repo root) for conventions.
2. Run `bun install` at repo root.
3. Run `bun run build:native` (Rust natives).
4. Run `bun run check` — fix only blocking issues you introduced; report pre-existing failures.
5. Run `bun run ci:test:smoke` (worker + tiny-model smoke probe).
6. Optionally run `bun run install:local` and verify `agent --version` and `agent --smoke-test`.

For Python (autoawfixer):
7. Run `bun run autoawfixer:install` (uv sync).
8. Run `bun run test:py`.

Deliverable: A short report listing pass/fail for each command, any env gaps (Go, uv, Android SDK, etc.), and the exact commands the user should run daily for dev.

Do not commit. Do not start feature work.
```

---

## Prompt 1 — Land the in-flight autoawfixer rename + rebrand changelog

```
You are working in awfixer-agent. There is large uncommitted work: staged `python/robomp` → `python/autoawfixer` renames plus unstaged content updates.

Goal: Produce clean, logical commits for the rename and rebranding documentation — only if the user asked you to commit; otherwise prepare the diff and a proposed commit message series.

Read first:
- transition-docs/REBRANDING.md
- docs/superpowers/plans/2026-06-29-rebranding-phase-0-1.md
- packages/coding-agent/CHANGELOG.md [Unreleased]

Steps:
1. `git status` — understand staged (rename) vs unstaged (content) vs untracked.
2. Ensure every `robomp` / `ROBOMP_*` reference in code, Docker, scripts, and tests is updated to `autoawfixer` / `AUTOAWFIXER_*`. Grep for leftovers; fix or document intentional保留 (e.g. historical docs in transition-docs/expanding-robomp.md).
3. Verify root package.json scripts use `autoawfixer:*` not `robomp:*`.
4. Update python/autoawfixer/README.md links if they still point at can1357/oh-my-pi where fork URLs apply.
5. Run `bun run check`, `bun run test:py`, and `bun run autoawfixer:build` (or document why Docker isn't available).
6. Propose (or execute) commits:
   - Commit A: `python/robomp` → `python/autoawfixer` rename only
   - Commit B: AUTOAWFIXER_* content, Dockerfiles, root scripts, tests
   - Commit C: CHANGELOG [Unreleased] entries for rebrand + autoawfixer rename

Acceptance:
- `rg 'robomp|ROBOMP_' --glob '!transition-docs/**' --glob '!CHANGELOG.md'` returns only intentional historical mentions.
- `bun run test:py` passes (or failures are documented with root cause).
- CHANGELOG [Unreleased] documents autoawfixer rename and Phase 0–2 rebrand items.

Constraints: Follow AGENTS.md — no console.log in coding-agent, no source-grep tests, no editing packages/catalog/src/models.json by hand.
```

---

## Prompt 2 — Commit new scaffolds (github-app, android-app, superpowers specs)

```
Goal: Add untracked `github-app/`, `android-app/`, and `docs/superpowers/{specs,plans}/` to git in a coherent commit

Read first:
- github-app/README.md
- android-app/README.md
- docs/superpowers/specs/2026-06-30-github-app-design.md
- docs/superpowers/specs/2026-07-01-android-app-design.md
- docs/superpowers/plans/2026-07-01-github-app-v1.md

Steps:
1. Review each new directory for secrets, `.env` files, or local paths — ensure `.gitignore` covers them.
2. Run `cd github-app/gateway && go test ./...` (install Go if needed).
3. Run `cd github-app/worker && pip install -e '.[dev]' && pytest -q` (or uv equivalent).
4. For android-app: verify Gradle wrapper or document Android Studio setup in README if wrapper missing.
5. Fix any broken references (e.g. README paths, docker-compose contexts).
6. Single commit message suggestion: `feat: add prwatch github-app and android companion scaffolds`

Acceptance:
- All new paths are tracked or explicitly gitignored with reason.
- Gateway `go test ./...` passes.
- Worker `pytest` passes for existing tests.
- No credentials in committed files.

Do not implement Tasks 1–18 of the github-app plan in this prompt — scaffold commit only.
```

---

## Prompt 3 — Phase 3: npm scope rename (@oh-my-pi → @awfixerai)

```
Goal: Mechanical rename of published package scope from `@oh-my-pi/*` to `@awfixerai/*` across the monorepo, with a passing typecheck and tests.

Read first:
- transition-docs/REBRANDING.md (Phase 3 section)
- transition-docs/update-checker-domains.md
- scripts/ci-release-publish.ts
- scripts/check-spoofed-versions.ts
- root package.json workspaces.catalog

Target mapping (from REBRANDING.md):
  @awfixerai/pi-utils          ← @oh-my-pi/pi-utils
  @awfixerai/pi-wire           ← @oh-my-pi/pi-wire
  @awfixerai/pi-catalog        ← @oh-my-pi/pi-catalog
  @awfixerai/pi-natives        ← @oh-my-pi/pi-natives
  @awfixerai/pi-tui            ← @oh-my-pi/pi-tui
  @awfixerai/pi-ai             ← @oh-my-pi/pi-ai
  @awfixerai/pi-agent-core     ← @oh-my-pi/pi-agent-core
  @awfixerai/pi-coding-agent   ← @oh-my-pi/pi-coding-agent

Steps:
1. Update every package.json `name` field (packages/*, examples, collab-web, etc.).
2. Update root package.json `workspaces.catalog` keys.
3. Codemod all imports: `@oh-my-pi/` → `@awfixerai/` in .ts/.tsx/.json (exclude CHANGELOG historical links unless updating fork URLs).
4. Update scripts/ci-release-publish.ts, scripts/check-spoofed-versions.ts, install tests, Dockerfile COPY paths if any.
5. Run `bun install` to refresh bun.lock.
6. Run `bun run check` and `bun run test:ts`.
7. Update packages/coding-agent/CHANGELOG.md [Unreleased] under ### Breaking Changes.
8. Add a short transition-docs note if legacy `@oh-my-pi` metapackage redirect is planned.

Acceptance:
- `rg '@oh-my-pi' --glob '!CHANGELOG.md' --glob '!transition-docs/**' --glob '!docs/**'` is empty (or only intentional compat shims documented in Phase 5).
- `bun run check` passes.
- `bun run ci:test:smoke` passes.

Constraints: Do not publish to npm unless user explicitly asks. Do not edit models.json by hand.
```

---

## Prompt 4 — Repoint self-update and install URLs

```
Goal: Re-enable self-update after fork repoint — wire poll URLs to awfixer fork assets.

Read first:
- transition-docs/update-checker-domains.md
- packages/coding-agent/src/main.ts (checkForNewVersion)
- packages/coding-agent/src/cli/update-cli.ts

Targets (from update-checker-domains.md):
- Site/docs: agent.awfixer.codes
- GitHub repo: awfixers-stuff/awfixer-agent
- npm package: @awfixerai/pi-coding-agent (assume Prompt 3 done, or use current scope consistently)

Steps:
1. Replace nulled `UPDATE_CHECK_URL`, `NPM_REGISTRY`, `REPO` constants with real targets.
2. Update PACKAGE, NATIVES_PACKAGE, MISE_TOOL, HOMEBREW_FORMULA (or document TBD tap).
3. Replace `https://omp.sh/install` hint with `https://agent.awfixer.codes/install` (or placeholder if site not live — document).
4. Add regression tests only if they assert observable behavior (e.g. update --check returns version string from mocked fetch), not source grep.
5. Run `bun run check` and relevant coding-agent tests.

Acceptance:
- `omp update --check` and startup update check hit fork npm metadata (or fail gracefully with clear message if package unpublished).
- No fetches to can1357/oh-my-pi or @oh-my-pi/pi-coding-agent/latest in update path.
- CHANGELOG [Unreleased] notes update checker repoint.

Dependency: Prompt 3 should be done first, or scope strings must match interim state.
```

---

## Prompt 5 — Phase 4: Docker and infra string rebrand

```
Goal: Replace oh-my-pi / pi:dev / PI_ROOT strings with awfixer-agent naming in Docker and compose files.

Read first:
- transition-docs/REBRANDING.md (Phase 4)
- Dockerfile, Dockerfile.autoawfixer, Dockerfile.dockerignore
- python/autoawfixer/docker-compose.yml, .env.example
- github-app/Dockerfile.gateway, Dockerfile.worker
- root package.json pi:image / autoawfixer:* scripts

Target renames (adjust if user prefers different tags):
- Image: oh-my-pi/pi:dev → awfixer-agent/agent:dev (or agent:dev)
- PI_ROOT env → AGENT_ROOT (with PI_ROOT fallback + deprecation warning in entrypoints)
- PI_BASE build arg → AGENT_BASE
- Homepage omp.sh → agent.awfixer.codes where user-facing

Steps:
1. Grep `oh-my-pi|pi:dev|PI_ROOT|PI_BASE` across repo (exclude CHANGELOG, transition-docs history).
2. Update Dockerfiles, compose, entrypoint.sh, autoawfixer README setup commands.
3. Keep backward-compat env reads where bots already deployed with PI_ROOT.
4. Update root scripts: consider `agent:image` alias alongside `pi:image`.
5. Run `bun run autoawfixer:build` if Docker available.
6. CHANGELOG [Unreleased] + python/autoawfixer README.

Acceptance:
- `docker compose --project-directory python/autoawfixer config` validates.
- New clones can follow README without oh-my-pi references in setup path.
- Deprecation warnings documented for PI_ROOT.
```

---

## Prompt 6 — autoawfixer: deploy hardening and integration smoke

```
Goal: Make autoawfixer reliably runnable via docker-compose on a fresh machine; fix any rename regressions.

Read first:
- python/autoawfixer/README.md
- python/autoawfixer/.env.example
- python/autoawfixer/docker-compose.yml
- python/autoawfixer/tests/test_worker_smoke.py

Steps:
1. Ensure `bun run autoawfixer:install` and `bun run test:py` pass.
2. Fix broken imports/paths from robomp→autoawfixer rename if any test fails.
3. Run integration smoke if possible: `bun run autoawfixer:test:integration` (needs AUTOAWFIXER_INTEGRATION=1 and omp binary).
4. Audit .env.example: every AUTOAWFIXER_* var documented; no ROBOMP_* left.
5. Verify gh-proxy HMAC flow documented; healthz curl works after `autoawfixer:up`.
6. Update python/autoawfixer/CHANGELOG or root coding-agent CHANGELOG if user-visible behavior changed.

Acceptance:
- `uv run --directory python pytest -x autoawfixer/tests` passes.
- README setup commands work end-to-end (or gaps listed with exact fixes).
- Web dashboard at python/autoawfixer/web builds: `bun run autoawfixer:web:build`.

Out of scope: new triggers (Slack, cron) — see Prompt 12.
```

---

## Prompt 7 — prwatch v1: Gateway foundation (Tasks 1–5)

```
Goal: Complete github-app gateway Tasks 1–5 from the implementation plan.

Read first:
- docs/superpowers/plans/2026-07-01-github-app-v1.md (Tasks 1–5)
- docs/superpowers/specs/2026-06-30-github-app-design.md (§2–6)
- github-app/gateway/ (existing scaffold)
- Pattern refs: python/autoawfixer for webhook HMAC style (do not import its code)

Tasks:
1. Task 1: Fixture JSON + TestEnqueueReviewJob_dedupDeliveryID (testcontainers Postgres).
2. Task 2: Webhook handler integration test — valid HMAC → 202.
3. Task 3: GitHub App JWT + installation token cache (Go), with mock HTTP test.
4. Task 4: Check Run reporter — start/complete named `prwatch`.
5. Task 5: OpenAPI from shared/openapi.yaml + REST handlers + wire main.go; Argon2id bearer on api_tokens.

Verification:
- `cd github-app/gateway && go test ./...` — all pass.
- `docker compose -f github-app/docker-compose.yml up --build` — healthz OK; POST fixture webhook enqueues job (manual or scripted).

Constraints: Go gateway never calls omp. Issue triage stays in autoawfixer only.
Commit per task or one squashed commit if user asked.
```

---

## Prompt 8 — prwatch v1: Worker review pipeline (Tasks 6–18)

```
Goal: Wire Python prwatch worker from job claim through omp-RPC review to GitHub output.

Read first:
- docs/superpowers/plans/2026-07-01-github-app-v1.md (Tasks 6–18)
- github-app/worker/src/prwatch/ (runner, db, sandbox_exec stub)
- python/autoawfixer/src/{worker,host_tools,sandbox,git_ops,github_client}.py as patterns only
- python/omp-rpc/ for RPC client usage

Tasks (summary):
- Task 6–8: config tests, asyncpg claim + LISTEN/NOTIFY, runner loop (partially done — finish NOTIFY + reset_stuck_running).
- Task 9: PR worktree materialization (clone pool like autoawfixer).
- Task 10: E2B run_in_sandbox full implementation (replace stub).
- Task 11–13: omp_rpc driver, host_tools (record_finding, post review), kickoff prompts.
- Task 14–16: github_client, full pipeline, API-triggered re-review.
- Task 17: Kernel browser stub (optional flag).
- Task 18: Integration smoke — webhook → queued → review posted (mock GitHub acceptable in CI).

Verification:
- `cd github-app/worker && pytest -x`
- End-to-end compose test documented in github-app/README.md

Dependency: Prompt 7 (gateway enqueue + checks) should be done or stubbed for E2E.

Environment: E2B_API_KEY, DATABASE_URL, GitHub App credentials on worker service.
```

---

## Prompt 9 — Android companion: Phase 1 polish and ship

```
Goal: Make android-app Phase 1 buildable, tested, and usable against a LAN omp stats server.

Read first:
- docs/superpowers/specs/2026-07-01-android-app-design.md
- android-app/README.md
- packages/stats/src/server.ts (API contract)
- packages/stats/src/shared-types.ts (DTO shapes)

Steps:
1. Ensure Gradle wrapper exists (`gradle wrapper` if missing).
2. Align Kotlin DTOs with packages/stats shared types — fix any drift.
3. JVM unit tests: URL building, JSON parsing with sample payloads from stats package tests.
4. Manual test plan: emulator `10.0.2.2:3847`, host runs `omp stats` or `bun run stats`.
5. Settings: base URL, bearer token, time range — persist via DataStore.
6. Manage tab stays honest offline stub until Prompt 10.
7. Update android-app README with screenshots placeholders and known limitations.

Acceptance:
- `./gradlew :app:assembleDebug` succeeds.
- Unit tests pass: `./gradlew :app:testDebugUnitTest`
- No hardcoded production secrets.

Out of scope: live steer/abort (Phase 2).
```

---

## Prompt 10 — HTTP control plane for agent (unblocks Android Phase 2)

```
Goal: Design and implement a minimal HTTP (or WebSocket) control API in coding-agent so remote clients can list sessions, steer, and abort.

Read first:
- docs/superpowers/specs/2026-07-01-android-app-design.md (§ Backend reality, Follow-ups)
- packages/coding-agent/src/modes/rpc/rpc-types.ts (steer, abort, abort_and_prompt)
- packages/stats/src/server.ts (pattern for Bun.serve HTTP in this repo)

Spec deliverables (do both):
1. Write docs/superpowers/specs/YYYY-MM-DD-agent-control-api.md covering:
   - Endpoints: list sessions, get session status, POST steer, POST abort, optional SSE event stream
   - Auth: bearer token, bind address, LAN-only defaults
   - Mapping to existing JSON-RPC methods
2. Implement v1 minimal server (e.g. `agent control serve --port 3848` or extend stats server behind flag):
   - At least: GET /api/sessions, POST /api/sessions/:id/steer, POST /api/sessions/:id/abort
   - Tests assert HTTP contract, not source grep

Verification:
- `bun run check`
- New tests in packages/coding-agent/test/ for control API
- Update android-app domain/ControlRepository interface doc pointing at real endpoints

Dependency: Prompt 9 can wire Android after this ships.
```

---

## Prompt 11 — Drop Windows platform support

```
Goal: Execute transition-docs/dropping-windows.md — remove win32-x64 targets and Windows-only code paths.

Read first:
- transition-docs/dropping-windows.md (full inventory)
- packages/natives/scripts/gen-npm-packages.ts
- scripts/ci-release-build-binaries.ts
- crates/pi-natives/src/ (cfg(windows) gates)

Steps:
1. Remove win32-x64 from LEAF_TARGETS and binary release targets.
2. Remove or gate Windows-specific modules (pi-shell windows, etc.) per inventory.
3. Update CI workflows to stop building win32 artifacts.
4. CHANGELOG [Unreleased] ### Breaking Changes — Windows no longer supported.
5. Run `bun run check`, `bun run test:ts`, native build on Linux.

Acceptance:
- No CI job publishes win32-x64 binaries.
- `rg 'win32-x64' scripts/ packages/natives/` only in changelog/history docs.
- Linux and darwin targets still build.

Caution: Large diff — one focused commit; do not drive-by refactor unrelated code.
```

---

## Prompt 12 — autoawfixer: trigger abstraction (expansion Phase 1)

```
Goal: First step toward general agent framework — extract GitHub webhook handling into a pluggable Trigger without changing behavior.

Read first:
- transition-docs/expanding-robomp.md (Medium-term architecture)
- python/autoawfixer/src/github_events.py, server.py, queue.py, worker.py

Steps:
1. Introduce `triggers/base.py` with Trigger ABC: `parse_event`, `route_to_task`, `dedup_key`.
2. Move GitHub-specific logic to `triggers/github/` — same HTTP routes, same sqlite schema initially.
3. WorkerPool and SandboxManager stay unchanged; only import paths change.
4. All existing autoawfixer tests pass without behavior change.
5. Add one contract test: GitHub issues.opened fixture → same TaskInputs as before refactor.

Acceptance:
- `bun run test:py` / `pytest autoawfixer/tests` — full pass.
- No new features (no Slack/cron yet) — refactor only.
- Document extension point in python/autoawfixer/README.md Architecture section.

Out of scope: output backend split, lean Docker image, PyPI publish.
```

---

## Prompt 13 — Phase 5: Extension compat (@awfixer mirrors)

```
Goal: Extension loader serves both legacy @oh-my-pi and new @awfixerai subpath IDs during transition.

Read first:
- transition-docs/REBRANDING.md (Phase 5)
- packages/coding-agent/src/discovery/ (legacy-pi-bundled-registry, legacy-pi-compat, extension loader)
- docs/extensions.md

Steps:
1. Identify where bundled extension IDs and npm specifiers are resolved.
2. Add @awfixerai/agent/* mirrors for @oh-my-pi/pi-coding-agent/* bundled paths.
3. Update bundled registry generator if present — emit both scopes or alias map.
4. Tests: extension resolves by old ID and new ID to same module (behavior test, not source grep).
5. Document in docs/extensions.md for plugin authors.

Dependency: Prompt 3 (npm rename) should be complete.

Acceptance:
- Existing user plugins referencing @oh-my-pi still load.
- New docs recommend @awfixerai paths.
```

---

## Prompt 14 — Fork README and user-facing docs sweep

```
Goal: Replace upstream oh-my-pi / omp.sh user-facing references in READMEs and --help URLs with awfixer-agent branding.

Read first:
- transition-docs/REBRANDING.md
- packages/coding-agent/README.md
- Root lacks README — consider creating one pointing to agent CLI, autoawfixer, prwatch, android-app

Steps:
1. Audit: `rg 'oh-my-pi|omp\.sh|can1357/oh-my-pi' --glob '*.md' --glob '!CHANGELOG.md' --glob '!transition-docs/**'`
2. Update package READMEs, DEVELOPMENT.md, install docs with fork repo awfixers-stuff/awfixer-agent and agent.awfixer.codes.
3. Update CLI help strings in packages/coding-agent/src/cli.ts and packages/utils/src/cli.ts where URLs are printed.
4. Keep historical CHANGELOG issue links unless fork tracks its own issues.
5. `bun run check` — no type errors from string changes.

Acceptance:
- New contributor can onboard from root README without hitting dead upstream-only instructions.
- `agent --help` does not promise omp.sh update URLs (should match Prompt 4 state).

Do not rewrite 100+ docs/tools/*.md unless broken links — prioritize README, install, and help text.
```

---

## Quick reference: verification commands

| Area | Command |
|------|---------|
| Typecheck | `bun run check` |
| TS tests | `bun run test:ts` |
| Python | `bun run test:py` |
| Smoke | `bun run ci:test:smoke` |
| autoawfixer Docker | `bun run autoawfixer:build && bun run autoawfixer:up` |
| prwatch gateway | `cd github-app/gateway && go test ./...` |
| prwatch worker | `cd github-app/worker && pytest -q` |
| Android | `cd android-app && ./gradlew :app:assembleDebug` |
| Local CLI | `bun run install:local && agent --smoke-test` |

---

## Parallelization guide

| Can run in parallel | Must wait for |
|---------------------|---------------|
| Prompts 3, 5, 6, 7, 9, 11, 12, 14 | Prompt 0 (bootstrap) |
| Prompt 4 | Prompt 3 |
| Prompt 8 | Prompt 7 (partial gateway) |
| Prompt 10 | none (but 9 benefits after) |
| Prompt 13 | Prompt 3 |

**Minimum path to “fork is real”:** 0 → 1 → 2 → 3 → 4 → 14

**Minimum path to “bots work”:** 0 → 1 → 5 → 6 (autoawfixer) OR 0 → 2 → 7 → 8 (prwatch)
