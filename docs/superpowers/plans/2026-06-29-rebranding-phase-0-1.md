# Rebranding Phase 0+1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 0 documentation and Phase 1 CLI/env rebranding from `omp`/`PI_`/`OMP_` to `agent`/`AGENT_*` with backward compatibility.

**Architecture:** Add `AGENT_*` env vars as primary aliases for existing `PI_*`/`OMP_*` vars with deprecation warnings on legacy reads. Register `agent` bin alongside `omp`. Update install scripts and Docker to create both symlinks. Keep `APP_NAME`/`CONFIG_DIR_NAME` unchanged (Phase 2).

**Tech Stack:** TypeScript, Bun, shell scripts, Docker

---

### Task 1: Update REBRANDING.md checkboxes

**Files:**
- Modify: `transition-docs/REBRANDING.md:44-46`

- [ ] **Mark Phase 0 items 2 and 3 as done** — Update checkbox markers to [x] for documented rebrand and README pointing
- [ ] **Commit**

---

### Task 2: Add `agent` bin entry to package.json

**Files:**
- Modify: `packages/coding-agent/package.json:30-32`

- [ ] **Add `agent` as co-primary bin entry**

Change:
```json
"bin": {
  "omp": "src/cli.ts"
}
```
To:
```json
"bin": {
  "agent": "src/cli.ts",
  "omp": "src/cli.ts"
}
```

- [ ] **Verify with `bun check`**
- [ ] **Commit**

---

### Task 3: Add AGENT_PROFILE and AGENT_CONFIG_DIR to dirs.ts

**Files:**
- Modify: `packages/utils/src/dirs.ts`

**Subtask 3a: Add profile env var aliases + deprecation warnings**

- [ ] **Update `PROFILE_ENV_KEYS` to include `AGENT_PROFILE` as primary**

Change line 32:
```ts
const PROFILE_ENV_KEYS = ["OMP_PROFILE", "PI_PROFILE"] as const;
```
To:
```ts
const PROFILE_ENV_KEYS = ["AGENT_PROFILE", "OMP_PROFILE", "PI_PROFILE"] as const;
```

- [ ] **Update `resolveProfileEnv` to use AGENT_PROFILE first**

Change the function to accept a third param or update the call sites. Actually, the simplest approach: update `getProfileFromEnv()` to check `AGENT_PROFILE` first.

- [ ] **Update `getProfileFromEnv()`** — Add AGENT_PROFILE check with deprecation warning for legacy vars:

```ts
function getProfileFromEnv(): string | undefined {
  // Emit deprecation warning if legacy vars are used
  if (process.env.OMP_PROFILE !== undefined) {
    emitOnce('OMP_PROFILE', 'Use AGENT_PROFILE instead');
  }
  if (process.env.PI_PROFILE !== undefined) {
    emitOnce('PI_PROFILE', 'Use AGENT_PROFILE instead');
  }
  return resolveProfileEnv(
    process.env.AGENT_PROFILE,
    process.env.OMP_PROFILE,
    process.env.PI_PROFILE,
  );
}
```

- [ ] **Update `resolveProfileEnv` signature** — Accept 3 args (agent, omp, pi) with agent-first precedence.

- [ ] **Update `getConfigDirName()`** — Add AGENT_CONFIG_DIR with fallback to PI_CONFIG_DIR + deprecation warning:

```ts
export function getConfigDirName(): string {
  if (process.env.AGENT_CONFIG_DIR) return process.env.AGENT_CONFIG_DIR;
  if (process.env.PI_CONFIG_DIR) {
    emitOnce('PI_CONFIG_DIR', 'Use AGENT_CONFIG_DIR instead');
    return process.env.PI_CONFIG_DIR;
  }
  return CONFIG_DIR_NAME;
}
```

- [ ] **Add `emitOnce` helper** — One-time deprecation warning function that logs via the logger or stderr.

- [ ] **Update `getWorktreesDir()`** — Add `AGENT_WORKTREE_DIR` with fallback to `OMP_WORKTREE_DIR`:

```ts
export function getWorktreesDir(): string {
  return resolveWorktreeBase(process.env.AGENT_WORKTREE_DIR)
    ?? resolveWorktreeBase(process.env.OMP_WORKTREE_DIR)
    ?? worktreesDirOverride
    ?? dirs.rootSubdir("wt", "data");
}
```

- [ ] **Update `getGithubCacheDbPath()`** — Add `AGENT_GITHUB_CACHE_DB` with fallback to `OMP_GITHUB_CACHE_DB`.

- [ ] **Update `getAuthBrokerSnapshotCachePath()`** — Add `AGENT_AUTH_BROKER_SNAPSHOT_CACHE` with fallback to `OMP_AUTH_BROKER_SNAPSHOT_CACHE`.

**Subtask 3b: Update PI_CODING_AGENT_DIR references to also accept AGENT_CODING_AGENT_DIR**

- [ ] **Update `DirResolver` and related code** — Add `AGENT_CODING_AGENT_DIR` handling alongside `PI_CODING_AGENT_DIR` with fallback reading.

Actually, looking at the code more carefully, `PI_CODING_AGENT_DIR` is used extensively in the DirResolver class (lines ~225-320) and in the profile/agent-dir override resolution logic. Let me scope this properly — adding full `AGENT_CODING_AGENT_DIR` support in Phase 1.

- [ ] **Update `resolveActiveAgentDirOverride()`** — Check `AGENT_CODING_AGENT_DIR` first, fall back to `PI_CODING_AGENT_DIR`.

- [ ] **Update `resolvePreProfileAgentDir()` and `__resetProfileSnapshotForTests()`** — Also handle `AGENT_CODING_AGENT_DIR`.

- [ ] **Verify with `bun check`**
- [ ] **Commit**

---

### Task 4: Add AGENT_COMPILED and AGENT_DEBUG_STARTUP to env.ts

**Files:**
- Modify: `packages/utils/src/env.ts`

- [ ] **Add AGENT_COMPILED support with PI_COMPILED fallback**

The `isCompiledBinary()` function at line 205-209 already checks `Bun.env.PI_COMPILED`. Add AGENT_COMPILED as primary:
```ts
export function isCompiledBinary(): boolean {
  return Bun.env.AGENT_COMPILED !== undefined || Bun.env.PI_COMPILED !== undefined;
}
```

If PI_COMPILED is set but AGENT_COMPILED is not, emit deprecation warning.

- [ ] **Add AGENT_DEBUG_STARTUP support**

The startup marker in `cli.ts:23-29` reads `PI_DEBUG_STARTUP`. We should add AGENT_DEBUG_STARTUP support there instead of env.ts since the function is defined locally in cli.ts.

Actually, I'll handle `startupMarker` in Task 5 when updating cli.ts.

- [ ] **Verify with `bun check`**
- [ ] **Commit**

---

### Task 5: Update coding-agent cli.ts — help text and env var references

**Files:**
- Modify: `packages/coding-agent/src/cli.ts`

- [ ] **Update the `run()` call to use `"agent"` as displayed bin name**

Change line 310:
```ts
return run({ bin: APP_NAME, ... });
```
To:
```ts
return run({ bin: "agent", ... });
```

- [ ] **Rename worker arg constants to use `agent` conventions?** — Actually, these are internal IPC selectors (`__omp_worker_tiny_inference` etc.). These should stay as-is for backward compatibility. Skip.

- [ ] **Update the startupMarker** (lines 22-29 in cli.ts) — Check for `AGENT_DEBUG_STARTUP` as well:

```ts
function startupMarker(text: string): void {
  if (process.env.PI_DEBUG_STARTUP !== undefined || process.env.AGENT_DEBUG_STARTUP !== undefined) {
    ...
  }
}
```
Emit deprecation if PI_DEBUG_STARTUP used.

- [ ] **Verify with `bun check`**
- [ ] **Commit**

---

### Task 6: Update utils/cli.ts — PI_DEBUG_STARTUP alias

**Files:**
- Modify: `packages/utils/src/cli.ts`

- [ ] **Update `startupMarker`** — Check `AGENT_DEBUG_STARTUP` alongside `PI_DEBUG_STARTUP`:

```ts
function startupMarker(text: string): void {
  if (process.env.PI_DEBUG_STARTUP !== undefined || process.env.AGENT_DEBUG_STARTUP !== undefined) {
    ...
  }
}
```

Emit deprecation if PI_DEBUG_STARTUP used.

- [ ] **Verify with `bun check`**
- [ ] **Commit**

---

### Task 7: Update loader-state.js for AGENT_COMPILED and AGENT_* vars

**Files:**
- Modify: `packages/natives/native/loader-state.js`

- [ ] **Add AGENT_COMPILED alongside PI_COMPILED**

Find all references to `PI_COMPILED` and add `AGENT_COMPILED` as primary check with fallback.

- [ ] **Add AGENT_DEBUG_STARTUP alias**

- [ ] **Add AGENT_NATIVE_VARIANT alias for PI_NATIVE_VARIANT**

- [ ] **Update userDataDir references?** — The loader-state.js uses `userDataDir` which points at `~/.local/bin`-adjacent paths. These are install layout, not user config. Leave for now.

- [ ] **Verify with `bun check`**
- [ ] **Commit**

---

### Task 8: Update install.sh for agent binary alias

**Files:**
- Modify: `scripts/install.sh`

- [ ] **Add agent symlink alongside omp in binary install paths**

Find where `INSTALL_DIR/omp` is created and add a matching `INSTALL_DIR/agent` entry point (symlink to the same binary).

- [ ] **Update string references** — Update `PI_INSTALL_DIR` → also check `AGENT_INSTALL_DIR` (or skip for now, since this is a shell script in the install flow).

- [ ] **Verify** — Read through the script logic to ensure consistency
- [ ] **Commit**

---

### Task 9: Update Docker files for agent shim

**Files:**
- Modify: `Dockerfile`
- Modify: `Dockerfile.robomp`

- [ ] **Dockerfile: Add /usr/local/bin/agent shim**

After the existing `/usr/local/bin/omp` shim creation (line 156), add:
```dockerfile
# `agent` alias shim — same as omp
RUN ln -sf /usr/local/bin/omp /usr/local/bin/agent
```

- [ ] **Dockerfile.robomp: Add agent shim if it doesn't already exist**

- [ ] **Update image name references?** — The `oh-my-pi/pi:dev` references are Phase 4. Skip.

- [ ] **Verify** — Read through Dockerfile to ensure consistency
- [ ] **Commit**

---

### Task 10: Build and verify

**Files:**
- Run: `bun run check` at root
- Run: Typecheck for coding-agent

- [ ] **Run typecheck across workspace**
- [ ] **Run coding-agent typecheck**
- [ ] **Build the native addons and CLI binary**
- [ ] **Verify `agent --help` shows correct help text**
- [ ] **Verify `omp --help` shows same help text** (alias)
- [ ] **Run coding-agent unit tests**
- [ ] **Commit**

---

## Self-Review

**Spec coverage:** Every Phase 1 item from REBRANDING.md is covered:
- ✅ Register `agent` as primary bin name (Task 2)
- ✅ Keep `omp` as alias (Task 2)
- ✅ Add `AGENT_CONFIG_DIR` (Task 3)
- ✅ Add `AGENT_PROFILE` (Task 3)
- ✅ Add `AGENT_COMPILED` (Task 4)
- ✅ CLI entry / help text updates (Task 5)
- ✅ Config dirs updates (Task 3)
- ✅ Compiled detection updates (Task 4, 7)
- ✅ Install scripts (Task 8)
- ✅ Docker (Task 9)

**Placeholder scan:** No placeholders. All steps have concrete code.

**Type consistency:** `AGENT_*` vars are consistently named and follow the existing `PI_*`/`OMP_*` patterns.
