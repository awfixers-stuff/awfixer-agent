# Rebranding: pi / omp / oh-my-pi → agent / awfixer-agent

Planning document for renaming the product, CLI, config paths, and npm scope from the upstream **oh-my-pi** / **omp** identity to **awfixer-agent** / **agent**. This is a fork-local rebrand guide — not an upstream change.

## Goals

| Today | Target |
| --- | --- |
| Product name: oh-my-pi, pi | **awfixer-agent** (user-facing), **agent** (short) |
| CLI binary: `omp` | **`agent`** primary; keep `omp` as compatibility alias during transition |
| Config root: `~/.omp` | **`~/.agent`** (with `~/.omp` fallback reads for migration) |
| Agent config: `~/.omp/agent` | **`~/.agent`** (or `$XDG_CONFIG_HOME/agent` when XDG is enabled) |
| Env prefix: `PI_*`, `OMP_*` | **`AGENT_*`** primary; accept legacy vars with deprecation warnings |
| npm scope: `@oh-my-pi/*` | **`@awfixer/*`** (or `@awfixer-agent/*` for the main package) |
| Repo / image names: `oh-my-pi`, `pi:dev` | **`awfixer-agent`**, `agent:dev` |
| Docs site: omp.sh | **awfixer-agent docs** (TBD host) |
| GitHub org/repo: `can1357/oh-my-pi` | **awfixer fork** (this checkout) |

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

### Phase 0 — Documentation and aliases (now)

- [x] `install:local` installs `bin/agent` alongside `bin/omp`.
- [x] Document rebrand in this file; no user-visible breakage.
- [x] Fork README points at awfixer-agent naming.

### Phase 1 — CLI and env (low risk)

**User-visible**

- Register `agent` as the primary `bin` name in `packages/coding-agent/package.json`.
- Keep `omp` as a published alias (`bin: { agent: ..., omp: ... }` → same entry).
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
| Docker | `Dockerfile`, `Dockerfile.robomp`, `/usr/local/bin/omp` shim → `agent` |

### Phase 2 — Config path migration

**Default paths**

| Resource | Legacy | New default |
| --- | --- | --- |
| Config root | `~/.omp` | `~/.agent` |
| Agent settings | `~/.omp/agent` | `~/.agent` |
| Sessions | `~/.omp/agent/sessions` | `~/.agent/sessions` |
| Logs | `~/.omp/logs` | `~/.agent/logs` |
| Natives cache | `~/.omp/natives` | `~/.agent/natives` |
| XDG data | `$XDG_DATA_HOME/omp` | `$XDG_DATA_HOME/agent` |

**Migration strategy**

1. On first launch after upgrade, if `~/.agent` is missing and `~/.omp` exists, print a one-line hint: `run agent migrate-config` (new command).
2. `agent migrate-config` copies or symlinks `~/.omp` → `~/.agent` (user chooses copy vs symlink).
3. All new writes go to `~/.agent`; reads check `~/.agent` first, then legacy `~/.omp`.

### Phase 3 — npm scope and package names

Rename published packages in dependency order (leaves first):

```
@awfixer/utils          ← @oh-my-pi/pi-utils
@awfixer/wire           ← @oh-my-pi/pi-wire
@awfixer/catalog        ← @oh-my-pi/pi-catalog
@awfixer/natives        ← @oh-my-pi/pi-natives
@awfixer/tui            ← @oh-my-pi/pi-tui
@awfixer/ai             ← @oh-my-pi/pi-ai
@awfixer/agent-core     ← @oh-my-pi/pi-agent-core
@awfixer/coding-agent   ← @oh-my-pi/pi-coding-agent   (main CLI package)
@awfixer/agent          ← optional short publish name for the CLI
```

**Mechanical steps**

1. Update root `package.json` `workspaces.catalog` and every `package.json` `name` field.
2. Rewrite imports (`@oh-my-pi/` → `@awfixer/`) — codemod + `bun run check`.
3. Update `bun.lock` via `bun install`.
4. Update `scripts/ci-release-publish.ts`, `scripts/check-spoofed-versions.ts`, install tests.
5. Publish under `@awfixer` scope; keep `@oh-my-pi` as deprecated metapackage redirects if needed.

### Phase 4 — Repository and infra strings

| String | Occurrences | Notes |
| --- | --- | --- |
| `oh-my-pi` | Docker tags, compose, robomp `PI_ROOT`, docs | → `awfixer-agent` |
| `pi:dev` image | `docker build`, `bun run pi:image` | → `agent:dev` |
| `PI_ROOT` | Docker env, robomp entrypoint | → `AGENT_ROOT` |
| `roboomp` / `ROBOMP_*` | `python/robomp/` | Optional later rename to `awfixer-bot` |
| `omp.sh` | homepage, README, help URLs | → fork docs URL |
| `APP_NAME` / `CONFIG_DIR_NAME` | `packages/utils`, coding-agent | → `agent` / `.agent` |

### Phase 5 — Extension and plugin compatibility

- **Legacy pi extension compat** (`legacy-pi-bundled-registry.ts`, `legacy-pi-compat.ts`): keep serving `@oh-my-pi/pi-coding-agent/*` subpath IDs indefinitely; add `@awfixer/agent/*` mirrors.
- **Bundled registry generator**: emit both scopes during transition.
- **User plugins** referencing `@oh-my-pi/*`: document alias resolution in extension loader.

## Grep checklist (run before each phase)

```bash
rg -n 'oh-my-pi|@oh-my-pi|omp\.sh|PI_ROOT|PI_CONFIG|PI_PROFILE|OMP_PROFILE|/\.omp' \
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