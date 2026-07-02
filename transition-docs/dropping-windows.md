# Dropping Windows: Converting to Linux + Linux-Adjacent Only

This document enumerates every change required to drop Windows target support and limit the agent to **Linux, macOS, and BSD** operating systems.

---

## 1. Native Addon Targets

**File:** `packages/natives/scripts/gen-npm-packages.ts`

```typescript
export const LEAF_TARGETS: readonly LeafTarget[] = [
    { tag: "linux-x64", os: "linux", cpu: "x64" },
    { tag: "linux-arm64", os: "linux", cpu: "arm64" },
    { tag: "darwin-x64", os: "darwin", cpu: "x64" },
    { tag: "darwin-arm64", os: "darwin", cpu: "arm64" },
    // REMOVE:
    { tag: "win32-x64", os: "win32", cpu: "x64" },
];
```

Remove the `win32-x64` leaf target. This is used by `gen-npm-packages.ts` to generate npm leaf packages for platform-specific native addon distribution.

**Dependencies affected:** `scripts/gen-npm-packages.ts`, `scripts/embed-native.ts` (will never receive a win32 build, so the embedded addon for win32 is never created or bundled).

---

## 2. Binary Build Targets

**File:** `scripts/ci-release-build-binaries.ts`

```typescript
const targets: BinaryTarget[] = [
    { id: "darwin-arm64", ... },
    { id: "darwin-x64", ... },
    { id: "linux-x64", ... },
    { id: "linux-arm64", ... },
    // REMOVE:
    {
        id: "win32-x64",
        platform: "win32",
        arch: "x64",
        target: "bun-windows-x64-modern",
        outfile: "packages/coding-agent/binaries/agent-windows-x64.exe",
    },
];
```

Remove the `win32-x64` target entry. This eliminates the Windows binary from the release artifact list and CI pipeline.

**Dependencies affected:** Release scripts, CI pipeline definitions (GitHub Actions matrix or equivalent).

---

## 3. Rust Crate — Conditional Dependencies

**File:** `crates/pi-natives/Cargo.toml`

```toml
# REMOVE this entire section:
[target.'cfg(windows)'.dependencies]
winreg.workspace = true
```

Eliminates the `winreg` crate (Windows Registry access).

---

## 4. Rust Crate — Conditional Module

**File:** `crates/pi-shell/src/lib.rs`

```rust
// REMOVE:
#[cfg(windows)]
pub mod windows;
```

The entire `crates/pi-shell/src/windows.rs` module (8KB) becomes dead code and can be deleted. It contains:

| Function | Purpose | Delete? |
|----------|---------|---------|
| `configure_windows_path` | Sets up PATH for Git Bash/MSYS2 | Yes |
| `normalize_path` | Windows path normalization | Yes |
| `find_git_paths` | Discover Git PATH entries | Yes |
| `query_git_install_path_from_registry` | HKLM Registry query | Yes |
| `query_git_install_path_from_where` | `where.exe` fallback | Yes |
| `git_install_root_from_path` | Derive install root from git.exe | Yes |
| `git_paths_for_install_root` | Expand install root to PATH segments | Yes |
| `has_git_command` | Probe for git in a dir | Yes |
| `find_git_install_roots` | Discover all install roots | Yes |
| `translate_msys_segment` | `/c/Users/foo` → `C:\Users\foo` | Yes |
| `is_drive_letter` | Drive letter check | Yes |
| `is_windows_style_path` | `C:\...` vs `/...` check | Yes |
| `mod tests` | Unit tests for the above | Yes |

The tests module inside that file should also be removed.

---

## 5. Rust Crate — PTY Conditional

**File:** `crates/pi-natives/src/pty.rs`

```rust
// Line 82-83:
// Current:
#[cfg(not(windows))]
const FINAL_READER_DRAIN_TIMEOUT: Duration = Duration::from_millis(50);

// After removing Windows, this can be unconditional:
const FINAL_READER_DRAIN_TIMEOUT: Duration = Duration::from_millis(50);
```

Remove the `#[cfg(not(windows))]` gate. The constant is now always defined. (The Windows codepath never used it, so no logic change.)

---

## 6. JavaScript/TypeScript — Windows-Specific Tests

**File:** `packages/natives/test/windows-staging.test.ts`

This 7KB test file covers Windows staging scenarios. If Windows is dropped, this file can be deleted entirely (or moved to an archive).

---

## 7. Build Script — Strip Verification

**File:** `packages/natives/scripts/build-native.ts`

The `isElfFile()` check and ELF section stripping logic is already Linux/Unix-specific. On Windows it doesn't apply — but dropping Windows means these checks are always against ELF files so the code path can be simplified (no fallback branch for non-ELF). No code change required unless you want to remove the `isElfFile` guard:

```typescript
// Current — checks before ELF-only ops:
if (await isElfFile(addonPath)) {
    await stripAndVerifyNativeAddon(addonPath);
}

// After dropping Windows — always ELF:
await stripAndVerifyNativeAddon(addonPath);
```

Optional simplification — the guard is harmless on macOS where `.dylib` Mach-O files won't match the ELF magic check, so it already skips correctly.

---

## 8. CI / Infra

### CI Runner Matrix

Remove the Windows runner entry from:
- `scripts/ci-release-build-binaries.ts` (already covered above).
- GitHub Actions workflow files (or equivalent CI config) — remove the `windows-latest` / `win32-x64` matrix entry.

### Docker / Container

No change — Windows containers are not used. The Docker images (`Dockerfile`, `Dockerfile.autoawfixer`) target Linux only.

### Install Scripts

Check `scripts/install.sh` and `scripts/install-local.ts` for any Windows-specific code paths (e.g., `.exe` suffix handling, Windows-specific registry or path logic). Likely minimal.

---

## 9. User-Facing Changes

| Change | Impact |
|--------|--------|
| No Windows binary distribution | Users on Windows must use WSL2 or a VM. Document this. |
| No `@oh-my-pi/agent-natives-win32-x64` npm leaf package | npm `optionalDependencies` resolution will skip it. |
| No Windows-native shell PATH config | Shell commands in brush-core use whatever `PATH` the user has set. |

---

## 10. Verification Checklist

After changes:

```
bun run check                      # TypeScript + Rust typecheck
bun run test:ts                    # All TypeScript tests (including non-Windows)
bun run test:rs                    # Rust tests
bun run build:native               # Native addon build (linux/darwin only)
bun --cwd=packages/coding-agent build  # Binary build
./packages/coding-agent/dist/omp --smoke-test  # Runtime smoke
```

---

## Summary of Files to Touch

| File | Action |
|------|--------|
| `packages/natives/scripts/gen-npm-packages.ts` | Remove `win32-x64` leaf target |
| `scripts/ci-release-build-binaries.ts` | Remove `win32-x64` binary target |
| `crates/pi-natives/Cargo.toml` | Remove `[target.'cfg(windows)'.dependencies]` |
| `crates/pi-shell/src/lib.rs` | Remove `#[cfg(windows)] pub mod windows;` |
| `crates/pi-shell/src/windows.rs` | **Delete entire file** (~8KB) |
| `crates/pi-natives/src/pty.rs` | Remove `#[cfg(not(windows))]` guard on `FINAL_READER_DRAIN_TIMEOUT` |
| `packages/natives/test/windows-staging.test.ts` | Delete or archive (~7KB) |
| CI config (GitHub Actions, etc.) | Remove Windows runner |
| `scripts/install.sh` / `scripts/install-local.ts` | Review and remove any Windows branches |
