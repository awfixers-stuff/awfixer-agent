# macOS Platform Code

Inventory of macOS-specific code and behavior in the agent codebase.

## Target Triples

The release pipeline produces macOS binaries for two architectures:

| Target | Bun target |
|--------|-----------|
| `darwin-x64` | `bun-darwin-x64` |
| `darwin-arm64` | `bun-darwin-arm64` |

No variant suffix (x64 baseline/modern distinction does not apply on macOS — the Darwin x64 target covers both).

## Rust Addon Platform Dependencies

macOS shares the `cfg(unix)` dependency group with Linux/BSD:

```toml
[target.'cfg(unix)'.dependencies]
libc.workspace = true
```

There are **no `target_os = "macos"` conditional gates** in the Rust crate. macOS runs the `#[cfg(not(target_os = "linux"))]` codepath in `clipboard.rs` and the `#[cfg(not(windows))]` codepath in `pty.rs`.

## Clipboard — macOS Codepath

```rust
#[cfg(not(target_os = "linux"))]
fn set_clipboard_text(text: String) -> Result<()> {
    let mut cb = Clipboard::new()?;
    cb.set_text(text)?;
    Ok(())
}
```

macOS uses a **transient** `Clipboard` instance per call. The OS retains clipboard contents after the writing process exits, so there's no need to keep an `arboard::Clipboard` alive (unlike Linux X11). The write runs on the calling thread to avoid `AppKit` pasteboard warnings from worker threads.

## Code Signing

When building on a macOS host (not cross-compiling), the binary is ad-hoc signed:

```typescript
// build-binary.ts
function shouldAdhocSignDarwinBinary(): boolean {
    return process.platform === "darwin" && !crossTarget;
}

// ci-release-build-binaries.ts
function shouldAdhocSignDarwinBinary(target: BinaryTarget): boolean {
    return target.platform === "darwin" && process.platform === "darwin";
}
```

After `bun build --compile`, runs:
```bash
codesign --force --sign - <binary>
```

This is required for macOS to allow the binary to run (unsigned binaries are blocked by Gatekeeper / `com.apple.quarantine`). Ad-hoc signing (`-`) is a self-sign that passes local validation but will not pass notarization — release binaries may require a Developer ID certificate for distribution outside the build machine.

## Native Addon Build (`build-native.ts`)

| Concern | macOS behavior |
|---------|---------------|
| Strip tool | Uses `strip` on the `.node` addon (same as Linux). |
| Target platform | "darwin" (not "macos" — Bun/Node convention). |
| Variant logic | None — no x64 variant distinction on Darwin. |
| Binary output | `pi_natives.darwin-{x64,arm64}.node` |

## macOS-Specific Concerns

### PTY

macOS PTY support goes through the same `portable-pty` crate as Linux. The terminal device model differs (`/dev/ttysXXX` vs Linux `/dev/pts/XX`), but `portable-pty` abstracts this. No macOS-specific PTY code in `pty.rs`.

### Process Management

`pi_shell::process` uses `libc::kill` with `SIGTERM`/`SIGKILL` for process termination, same as Linux. Process tree walking uses `/proc` on Linux, but on macOS uses `proc_listpidspath` / `sysctl` via the abstracted `pi_shell::process` module — so there are some differences below the abstraction.

### Crash Handler

The crash handler in `crash_handler.rs` uses platform signal handling. On macOS, `SIGSEGV`/`SIGABRT`/etc. are handled through `libc::sigaction`, but Mach exception handling is not used — the Unix signal path is sufficient for crash traces.

## Binary Compilation (`ci-release-build-binaries.ts`)

Produces:
- `packages/coding-agent/binaries/agent-darwin-arm64`
- `packages/coding-agent/binaries/agent-darwin-x64`

These are compiled on a Darwin host or cross-compiled. The CI release pipeline builds macOS binaries on macOS runners (ARM64 native, x64 via Rosetta or separate runner).

## What macOS Shares with Linux

- **Shell module** (`shell.rs`): Same brush-core-based shell execution — no macOS divergence.
- **Minimizer**: Same.
- **Grep/Text/Highlight**: Same.
- **Snapcompact/Image**: Same.
- **AST, Keys, Tokens**: Pure Rust — no platform-specific code.

## macOS-Only Features

None currently. Everything macOS does is either the non-Windows codepath or the non-Linux codepath. The only macOS-exclusive behavior is code signing, which is a build-time concern, not a runtime one.
