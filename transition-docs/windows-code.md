# Windows Platform Code

Inventory of Windows-specific code and behavior in the agent codebase.

## Target Triple

The release pipeline produces a single Windows binary:

| Target | Bun target |
|--------|-----------|
| `win32-x64` | `bun-windows-x64-modern` |

Only x64 is targeted. No ARM64 Windows target. Uses `modern` variant (AVX2+).

## Rust Addon Platform Dependencies

### `Cargo.toml` — Windows-only dependency

```toml
[target.'cfg(windows)'.dependencies]
winreg.workspace = true
```

`winreg` is used for Registry queries in `pi_shell::windows` to discover Git installation paths.

### Conditional Compilation — `pi-shell`

`crates/pi-shell/src/lib.rs`:
```rust
#[cfg(windows)]
pub mod windows;
```

The entire `windows.rs` module is Windows-only. It provides:

- **`configure_windows_path(shell: &mut BrushShell)`** — Configures a brush-core shell's `PATH` to include Git Bash/MSYS2 binaries found via the Windows Registry (`HKEY_LOCAL_MACHINE`). This is called during shell initialization on Windows to ensure `git`, `bash`, and related tools are resolvable.

- **MSYS2 path translation** (`translate_msys_segment`) — Converts MSYS2-style paths (`/usr/bin`, `/mingw64/bin`, `/c/Users/foo`) to Windows-native paths so that `std::path`-based executable lookups in brush-core can find binaries shipped with Git Bash.

- **Git install discovery** — Queries the Registry (`HKEY_LOCAL_MACHINE\SOFTWARE\GitForWindows`) and falls back to `where.exe git`.

### Conditional Compilation — `pi-natives`

| File | Gate | What it does on Windows |
|------|------|------------------------|
| `pty.rs` | `#[cfg(not(windows))] FINAL_READER_DRAIN_TIMEOUT` | Does **not** apply the 50ms final drain after SIGKILL (not needed on Windows). |
| `clipboard.rs` | `#[cfg(not(target_os = "linux"))]` | Windows runs this branch (transient `Clipboard`, same as macOS). The OS retains clipboard after writer exit. |

There is **no `#[cfg(windows)]`** gate in `pi-natives/src/clipboard.rs` specifically for Windows — it shares the transient path with macOS.

## Shell Module (`brush-core`)

The brush-core shell execution itself has platform-specific behavior:
- Command spawning uses `CreateProcess` on Windows vs `fork+exec` on Unix.
- Exit code collection differs (`GetExitCodeProcess` vs `waitpid`).
- PTY functionality uses different backend implementations in `portable-pty` (WinPTY/ConPTY on Windows vs Unix PTY).

These are abstracted by `brush-core` and `portable-pty` crates — the agent code doesn't directly touch them.

## Native Addon Build (`build-native.ts`)

| Concern | Windows behavior |
|---------|-----------------|
| Strip tool | Uses `strip` (if available via MSVC/nmake) or skips. ELF section stripping is x-plat but only applies to ELF (`isElfFile()` check gates it). |
| Target platform | "win32" (Node/Bun convention). |
| Variant logic | Only `x64-modern`. |
| Binary output | `pi_natives.win32-x64.node` |

## Binary Compilation

- `build-binary.ts`: `CROSS_TARGET=win32-x64` maps to `bun-windows-x64-modern`.
- `ci-release-build-binaries.ts`: produces `packages/coding-agent/binaries/omp-windows-x64.exe`.

Windows binary name gets `.exe` suffix (others don't).

## Testing

| Test file | Purpose |
|-----------|---------|
| `packages/natives/test/windows-staging.test.ts` | Windows-specific staging/validation tests. |

## Windows-Only Features

- **Registry-based Git discovery** (`pi_shell::windows`): The only way to find Git Bash/MSYS2 on Windows. Linux/macOS assume `git` is on `$PATH`.
- **MSYS2 path translation**: Converts `/c/Users/foo` style paths from Git Bash into `C:\Users\foo` for native Windows tools.
- **`.exe` binary suffix**: Release binaries carry `.exe` extension.

## What Windows Lacks

Compared to the Unix platforms, Windows does NOT have:
- Sixel support (terminal image protocol — Linux terminal feature).
- D-Bus power management (`power.rs` — Linux-only).
- `/proc`-based process tree walking (`pi_shell::process` uses different abstractions).
- Signal-based process group termination (`killpg`/`setsid` — uses `TerminateProcess` tree walking instead).
- PTY final-reader drain timeout (not needed after `TerminateProcess`).
- ELF stripping/verification in the build pipeline.

## Build Footprint

Windows is the smallest platform-specific surface but adds significant complexity:
- Different native addon archive in `embedded-addon.js`.
- Different CI runner/image requirements (Windows Server Core).
- Different shell PATH configuration.
- The `winreg` crate and Registry access logic.
- MSYS2 path translation and Git discovery logic.
