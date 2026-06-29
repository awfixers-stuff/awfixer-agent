# Linux Platform Code

Inventory of Linux-specific code and behavior in the agent codebase.

## Target Triples

The release pipeline produces Linux binaries for two architectures:

| Target | Bun target | Variant |
|--------|-----------|---------|
| `linux-x64` | `bun-linux-x64-baseline` | baseline (no AVX2 requirement — runs under Rosetta / pre-AVX2 CPUs) |
| `linux-arm64` | `bun-linux-arm64` | default |

x64 uses the **baseline** variant (not `modern`) because the `bun-linux-x64-modern` target emits SIGILL on Apple Silicon Rosetta and older x64 hardware. The Rust native addon also uses `x64-baseline` when not cross-compiling from an x64 host (see `build-native.ts:resolveEffectiveVariant()`).

## Rust Addon Platform Dependencies

### `Cargo.toml` — `[target.'cfg(unix)'.dependencies]`

```toml
[target.'cfg(unix)'.dependencies]
libc.workspace = true
```

`libc` is pulled in for Unix-specific process primitives (signal handling, process group manipulation). This covers Linux, macOS, and BSD uniformly — no `target_os = "linux"` gate on the dependency itself.

### Conditional Compilation Gates

`# [cfg(...)]` attributes in the Rust crate (`crates/pi-natives/src/`):

| File | Gate | What it controls |
|------|------|-----------------|
| `clipboard.rs` | `#[cfg(target_os = "linux")]` / `#[cfg(not(target_os = "linux"))]` | Linux holds a persistent `arboard::Clipboard` for the process lifetime (X11 `SelectionRequest` serving). macOS/Windows use transient instances because the OS retains clipboard contents after the writer exits. |
| `pty.rs` | `#[cfg(not(windows))]` | `FINAL_READER_DRAIN_TIMEOUT` — a 50ms final drain is used on non-Windows after SIGKILL to collect leftover PTY output. Windows doesn't need it. |
| `pi-shell/src/lib.rs` | `#[cfg(windows)] pub mod windows;` | The entire `windows` module is conditionally compiled. On Linux it doesn't exist. |

### `clipboard.rs` — Linux Persistence Detail

Linux (X11) uses an owner-based clipboard model: the process that set the selection must stay alive and answer `SelectionRequest` events. `arboard` serves those from a background thread that lives only as long as the `Clipboard` instance. Creating a throwaway `Clipboard` per copy tears that thread down immediately, leaving the X11 clipboard empty. The Linux implementation keeps one `Mutex<Clipboard>` for the process lifetime.

Wayland (`wl-clipboard-rs`) forks its own serving process so it doesn't require this, but sharing the same instance is harmless.

## Native Addon Build (`build-native.ts`)

| Concern | Linux behavior |
|---------|---------------|
| Strip tool | Runs `strip` on the `.node` addon; verifies `.symtab`/`.strtab` are removed. |
| Target platform | Detected from `TARGET_PLATFORM` env or `process.platform` ("linux"). |
| Variant logic | x64 → resolves `modern` vs `baseline` from CPU features (AVX2 check). `modern` uses `target-cpu=haswell`; `baseline` uses `target-cpu=nehalem`. |
| Binary output | `pi_natives.linux-{x64,arm64}{-modern,-baseline,}.node` |

## Binary Compilation (`build-binary.ts` and `ci-release-build-binaries.ts`)

- `build-binary.ts`: `CROSS_TARGET=linux-x64` maps to `bun-linux-x64-baseline` (baseline for Rosetta compat).
- `ci-release-build-binaries.ts`: produces `omp-linux-x64` and `omp-linux-arm64` outputs.

## Linux-Only Features

- **Sixel support** (`sixel.rs`): Image rendering via sixel escape sequences — Linux terminal feature.
- **Crash handler** (`crash_handler.rs`): Uses Linux-specific signal handling (`SIGSEGV`, `SIGABRT`, etc.) with `libc` for signal action registration and `backtrace` for unwind.
- **Power management** (`power.rs`): Uses D-Bus (`org.freedesktop.UPower` / `org.freedesktop.login1`) for sleep/inhibit detection — Linux-specific.

## Linux Adjacent (macOS / BSD)

The `cfg(unix)` gate covers both Linux and macOS/BSD for:
- `libc` dependency (signals, process groups, file descriptors)
- PTY session management via `portable-pty`
- Process tree walking in `pi_shell::process`

Differences between Linux and macOS/BSD in this codebase are minimal — they share the Unix codepaths. The main Linux-specific divergence is clipboard ownership semantics and the power/sixel features listed above.

## Cross-Compilation

Cross-compilation is handled through `napi` CLI with `CROSS_TARGET` env. The `build-native.ts` script:
- Builds the Rust addon for the specified target using zigbuild.
- Embeds addon archives per-platform in `embed-native.ts` (`embedded-addon.tar.gz` per platform+arch).
- The coding-agent binary build (`build-binary.ts`) then picks the matching embedded addon.

## Docker / Container

Linux is the primary deployment target for:
- `Dockerfile` → `oh-my-pi/pi:dev` image (Debian-based).
- `Dockerfile.robomp` → extends pi-base for robomp deployment.
- All CI runs on Linux x64 runners.
