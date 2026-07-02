# Rebranding: pi / omp / oh-my-pi → agent / awfixer-agent

Planning document for renaming the product, CLI, config paths, and npm scope from the upstream **oh-my-pi** / **omp** identity to **awfixer-agent** / **agent**. This is a fork-local rebrand guide — not an upstream change.

> **Status (2026-07):** Phases 0–5 landed in this fork. CLI is **`agent` only** (no `omp` bin alias). Published scope is **`@awfixerai/*`** with deduplicated names (`@awfixerai/agent`, `@awfixerai/utils`, …). User config defaults to **`~/.agent`**; project config stays **`.omp/`**. Docs sweep: `bun scripts/docs-rebrand-sweep.ts`.

## Goals

| Today | Target | Status |
| --- | --- | --- |
| Product name: oh-my-pi, pi | **awfixer-agent** (user-facing), **agent** (short) | [x] |
| CLI binary: `omp` | **`agent`** only | [x] |
| Config root: `~/.omp` | **`~/.agent`** (with `~/.omp` fallback reads for migration) | [x] |
| Agent config: `~/.omp/agent` | **`~/.agent`** (flat default profile; named profiles under `profiles/<name>/agent`) | [x] |
| Env prefix: `PI_*`, `OMP_*` | **`AGENT_*`** for profile/dir; broker/MCP `OMP_*` retained where still wired | [x] partial |
| npm scope: `@oh-my-pi/*` | **`@awfixerai/*`** (deduplicated package names) | [x] |
| Repo / image names: `oh-my-pi`, `pi:dev` | **`awfixer-agent`**, `agent:dev` | [x] |
| Docs site: omp.sh | **agent.awfixer.codes** | [x] |
| GitHub org/repo: `can1357/oh-my-pi` | **awfixers-stuff/awfixer-agent** | [x] |

## Non-goals (first pass)

- Breaking published `@oh-my-pi/*` packages on npm (fork can publish under a new scope in parallel).
- Renaming every internal `pi-*` package directory in one shot (staged renames below).
- Changing Rust crate names (`pi-natives`, etc.) until the JS surface is stable.

## Install layout (local prefix)

`bun run install:local` installs a production compiled binary under the XDG user prefix:

```
~/.local/
  bin/
    agent → ../libexec/omp/current/omp   # rebrand target name
    omp   → ../libexec/omp/current/omp   # transition alias
  libexec/omp/<version>/omp              # compiled binary (private)
  lib/omp/natives/<version>/*.node       # staged native addons
  agent/versions/<version>/              # versioned payloads (natives + manifest)
```

Runtime **user config** (models, settings, sessions) stays out of this tree — it belongs in `~/.agent` after migration, not in `~/.local/agent` (which is immutable install data).

## Phased rollout

### Phase 0 — Documentation and aliases [done]

- [x] `install:local` installs `bin/agent`.
- [x] Document rebrand in this file; no user-visible breakage.
- [x] Package READMEs and `docs/` updated via `scripts/docs-rebrand-sweep.ts`.

### Phase 1 — CLI and env [done]

**User-visible**

- [x] Register `agent` as the sole `bin` name in `packages/coding-agent/package.json`.
- [x] Removed `omp` bin alias and `omp-*` release asset names.
- Add `AGENT_*` env vars in `packages/utils/src/dirs.ts` and `env.ts`:
  - `AGENT_CONFIG_DIR` (replaces `PI_CONFIG_DIR`)
  - `AGENT_PROFILE` (replaces `OMP_PROFILE` / `PI_PROFILE`)
  - `AGENT_COMPILED`, `AGENT_HOME`, etc.
- Emit one-time deprecation warnings when legacy `PI_*` / `OMP_*` vars are read.

**Files to touch**

| Area | Key files |
| --- | --- |
| CLI entry / help text | `packages/coding-agent/src/cli.ts`, `packages/utils/src/cli.ts` |
| Config dirs | `packages/utils/src/dirs.ts` |
| Compiled detection | `packages/utils/src/env.ts`, `packages/natives/native/loader-state.js` |
| Install scripts | `scripts/install.sh`, `scripts/install-local.ts` |
| Docker | `Dockerfile`, `Dockerfile.autoawfixer`, `/usr/local/bin/omp` shim → `agent` |

### Phase 2 — Config path migration [done]

**Default paths** (changed):

| Resource | Legacy | New default | Status |
| --- | --- | --- | --- |
| Config root | `~/.omp` | `~/.agent` | [x] default changed |
| Agent settings | `~/.omp/agent` | `~/.agent` | [x] `getConfigDirName` returns `.agent` |
| Sessions | `~/.omp/agent/sessions` | `~/.agent/agent/sessions` | [x] under `.agent` |
| Logs | `~/.omp/logs` | `~/.agent/logs` | [x] via `rootSubdir` |
| Natives cache | `~/.omp/natives` | `~/.agent/natives` | [x] via `rootSubdir` |
| XDG data | `$XDG_DATA_HOME/omp` | `$XDG_DATA_HOME/agent` | [x] uses `APP_NAME="agent"` |
| Project config | `.omp` | `.omp` | [x] unchanged via `PROJECT_CONFIG_DIR_NAME` |

**Migration strategy** (done):

- [x] On first launch after upgrade, if `~/.agent` is missing and `~/.omp` exists, print hint: `run agent migrate-config`.
- [x] `agent migrate-config` copies or symlinks `~/.omp` → `~/.agent` (default symlink, `--copy` flag).
- [x] All new writes go to `~/.agent`; reads check `~/.agent` first, then fall back to `~/.omp`.

**Note: deduplicate `agent` nesting** [done]

The DirResolver now sets `agentDir = configRoot` for the default profile, eliminating the `~/.agent/agent` nesting:

| Redundancy | Status |
|---|---|
| `~/.agent/agent/...` → `~/.agent/...` | [x] `agentDir = configRoot` for default profile |
| `getConfigAgentDirName()` returns `.agent/agent` → `.agent` | [x] Returns `getConfigDirName()` for default profile |
| `getAgentDir()` returns `~/.agent/agent` → `~/.agent` | [x] Now returns config root for default profile |
| `AGENT_CODING_AGENT_DIR` rename to `AGENT_DIR` | deferred — mechanical rename across ~47 files |

**What changed** (summarized):
- `DirResolver`: `defaultAgent = profile ? path.join(configRoot, "agent") : configRoot` — flat for default profile, `/agent` suffix kept for named profiles
- `getConfigAgentDirName()`: returns `getConfigDirName()` (`.agent`) instead of `${getConfigDirName()}/agent` for default profile
- Agent subdirs (`sessions/`, `blobs/`, etc.) now resolve directly under `~/.agent/` instead of `~/.agent/agent/`
- Named profile subdirs unchanged (`~/.agent/profiles/<name>/agent/...`)
- 20 test files updated: `fallbackAgentDir` changed from `path.join(getConfigRootDir(), "agent")` to `getConfigRootDir()`
- Profile test expectations updated for flattened default profile

### Phase 3 — npm scope and package names [done]

Published scope **`@awfixerai/*`** with deduplicated names (leaves first):

```
@awfixerai/utils        ← @oh-my-pi/pi-utils
@awfixerai/wire         ← @oh-my-pi/pi-wire
@awfixerai/catalog      ← @oh-my-pi/pi-catalog
@awfixerai/natives      ← @oh-my-pi/pi-natives
@awfixerai/tui          ← @oh-my-pi/pi-tui
@awfixerai/ai           ← @oh-my-pi/pi-ai
@awfixerai/agent-core   ← @oh-my-pi/pi-agent-core
@awfixerai/agent        ← @oh-my-pi/pi-coding-agent (main CLI package)
@awfixerai/stats        ← @oh-my-pi/omp-stats
```

**Mechanical steps** — all done via `scripts/rebrand-codemod.ts` + `bun run check`.

### Phase 4 — Repository and infra strings [done]

| String | Occurrences | Notes |
| --- | --- | --- |
| `oh-my-pi` | Docker tags, compose, autoawfixer `AGENT_ROOT`, docs | → `awfixer-agent` |
| `pi:dev` image | `docker build`, `bun run agent:image` | → `agent:dev` |
| `AGENT_ROOT` | Docker env, autoawfixer entrypoint | → `AGENT_ROOT` |
| `autoawfixer` / `AUTOAWFIXER_*` | `python/autoawfixer/` | Renamed from `robomp` / `ROBOMP_*` |
| `omp.sh` | homepage, README, help URLs | → fork docs URL |
| `APP_NAME` / `CONFIG_DIR_NAME` | `packages/utils`, coding-agent | → `agent` / `.agent` |

### Phase 5 — Extension and plugin compatibility [done]

- [x] **Legacy pi extension compat** (`legacy-pi-bundled-registry.ts`, `legacy-pi-compat.ts`): serves `@oh-my-pi/pi-coding-agent/*` and `@awfixerai/agent/*` subpath IDs.
- [x] Bundled registry regenerated (1009 entries).
- [x] User plugins referencing old scopes: alias resolution in `legacy-pi-compat.ts`.

## Grep checklist (run before each phase)

```bash
rg -n 'oh-my-pi|@oh-my-pi|omp\.sh|AGENT_ROOT|PI_CONFIG|PI_PROFILE|OMP_PROFILE|/\.omp' \
  --glob '!node_modules' --glob '!bun.lock' --glob '!CHANGELOG.md'
rg -n '\bomp\b' packages/coding-agent/src/cli.ts packages/utils/src
```

## Testing matrix after each phase

| Check | Command |
| --- | --- |
| Typecheck | `bun run check` |
| Unit tests | `bun run test:ts` |
| Native tests | `bun --cwd=packages/natives test` |
| Compiled smoke | `bun run install:local -- --skip-build && agent --smoke-test` |
| Source dev | `bun run dev -- --version` |
| Install methods CI | `bun run ci:test:install-methods` |

## Open decisions

1. **npm scope**: `@awfixer` vs `@awfixer-agent` — recommend `@awfixer` for all packages, `awfixer-agent` only as the marketing/binary name.
2. **Config migration default**: symlink vs copy — symlink is faster; copy is safer for users still running upstream `omp` side by side.
3. **roboomp**: rename bot login / env prefix now or after CLI rebrand?
4. **Domain**: replace omp.sh links in `--help` with which URL?

## Related commands

```bash
bun run install:local              # build + install to ~/.local
bun run install:local -- --skip-build
LOCAL_PREFIX=/opt/agent bun run install:local
```