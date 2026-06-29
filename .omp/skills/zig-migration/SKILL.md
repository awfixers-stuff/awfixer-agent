---
name: zig-migration
description: Migrating Zig code between compiler versions, especially when stdlib APIs have changed. Use when Zig code fails to compile after a version upgrade, when docs don't match the installed Zig version, or when you see "no member named" or "container has no member" errors from Zig stdlib. Triggers on: zig version mismatch, stdlib API errors, "not found in std" errors, or user mentions upgrading Zig.
---

# Zig Version Migration

## Why this skill

Zig's standard library changes significantly between minor versions (0.14 → 0.15 → 0.16). Documentation often lags behind the installed compiler. When facing stdlib compilation errors, the fastest path is reading the installed stdlib source directly — not searching the web.

## The golden rule: read the installed stdlib, not the docs

When a stdlib API call fails to compile, the installed Zig stdlib source is the ground truth. Find it:

```bash
# Get the stdlib path for the currently-installed Zig
zig env | grep std_dir
# Or on NixOS:
ls $(dirname $(readlink -f $(which zig)))/lib/zig/std/

# Once you have the path, search it for the API you need:
# Example: find how Io.Writer works in Zig 0.16
ls ~/.nix-profile/lib/zig/std/io/
cat ~/.nix-profile/lib/zig/std/io/writer.zig
```

Store the stdlib path and search it directly — don't guess APIs.

## Zig 0.15 → 0.16: common stdlib changes

### I/O and Writers

| Old (0.15)                    | New (0.16)                              |
| ----------------------------- | --------------------------------------- |
| `std.io.getStdOut().writer()` | `std.Io.File.writer()` pattern          |
| `std.io.getStdErr().writer()` | `std.Io.File.writer()` pattern          |
| `std.debug.print(…)"`         | Still `std.debug.print(…)"` — unchanged |
| `std.io.Writer`               | `std.Io.Writer` (note capital I)        |
| `std.fs.cwd()`                | `std.fs.cwd()` — unchanged              |

I/O in 0.16 is reorganized under `std.Io` (capital I). Writers are obtained through the `Io.File` type:

```zig
// Zig 0.16 pattern
const std = @import("std");

pub fn main() !void {
    var io = std.Io.init(std.heap.page_allocator);
    defer io.deinit();

    const stdout = io.stdout();
    try stdout.writeAll("Hello\n");
}
```

### File system

| Old (0.15)                           | New (0.16)                                       |
| ------------------------------------ | ------------------------------------------------ |
| `std.fs.cwd().openFile(…)"`          | `std.fs.cwd().openFile(…)"` — unchanged          |
| `std.fs.path.join(…)"`               | `std.fs.path.join(…)"` — unchanged               |
| `try file.reader().readAllAlloc(…)"` | `try file.reader().readAllAlloc(…)"` — unchanged |

### Process and environment

| Old (0.15)          | New (0.16)                                         |
| ------------------- | -------------------------------------------------- |
| `std.os.getenv(…)"` | `std.process.getEnvVarOwned(…)"` — renamed         |
| `std.os.argv`       | `std.process.args()` or `std.os.argv` — both exist |

### Memory allocation

| Old (0.15)                         | New (0.16)                                     |
| ---------------------------------- | ---------------------------------------------- |
| `allocator.alloc(T, n)`            | `allocator.alloc(T, n)` — unchanged            |
| `std.heap.GeneralPurposeAllocator` | `std.heap.GeneralPurposeAllocator` — unchanged |
| `std.heap.page_allocator`          | `std.heap.page_allocator` — unchanged          |

### Networking

| Old (0.15)                  | New (0.16)                              |
| --------------------------- | --------------------------------------- |
| `std.net.StreamServer`      | `std.net.Server` — renamed              |
| `std.net.connectUnixSocket` | `std.net.connectUnixSocket` — unchanged |

### Build system

| Old (0.15)              | New (0.16)                                           |
| ----------------------- | ---------------------------------------------------- |
| `b.addExecutable(…)"`   | `b.addExecutable(…)"` — unchanged                    |
| `exe.linkLibC()`        | `exe.linkLibC()` — unchanged                         |
| `.link_libc` on modules | `.link_libc = true` — now required for `std.c` usage |

In 0.16, when using any `std.c` functions (like `std.c.getcwd`), you must explicitly set:

```zig
// build.zig
const exe = b.addExecutable(.{
    .name = "myapp",
    .root_source_file = b.path("src/main.zig"),
    .target = target,
    .optimize = optimize,
    .link_libc = true,  // REQUIRED in 0.16 for std.c usage
});
```

### Struct initialization

Zig 0.16 is stricter about struct field initialization:

```zig
// Zig 0.15: this compiled
const opts = BuildOptions{};
// Zig 0.16: error if BuildOptions has fields without defaults
// Fix: explicitly initialize all fields
const opts = BuildOptions{
    .field1 = value1,
    .field2 = value2,
};
```

### Type/pointer changes

- `*const [N]u8` vs `[]const u8` — zig 0.16 is stricter about pointer-to-array vs slice coercion
- Some APIs that accepted `[]const u8` in 0.15 now require `[]u8` or specific pointer types in 0.16

## Discovery workflow when an API fails

1. **Read the error message carefully** — Zig errors show the exact source location in stdlib
2. **Go to the stdlib source file** mentioned in the error
3. **Read the function signature** to see current parameter types
4. **Search for usage examples** within the same stdlib file — Zig's stdlib is self-documenting
5. **Check the test sections** in the stdlib file — they're the best examples

```bash
# Example: find how Zig 0.16's Server works
ZIG_STD=$(zig env | grep std_dir | cut -d'"' -f4)
cat "$ZIG_STD/net.zig" | head -200
grep -n "pub fn" "$ZIG_STD/net/stream.zig" | head -20
```

## When you're stuck

1. **Search the stdlib for the symbol**: `grep -r "pub fn theFunction" $ZIG_STD/`
2. **Read the struct definition**: the fields and methods show the current API
3. **Check if it moved**: some types moved from `std.x.y` to `std.x.Y` (naming convention changes)
4. **Look at Zig's own tests**: `find $ZIG_STD -name "*.zig" -path "*/test/*"`

## Common error patterns and fixes

| Error                                               | Likely cause                  | Fix                                   |
| --------------------------------------------------- | ----------------------------- | ------------------------------------- |
| `container 'std.io' has no member 'getStdOut'`      | 0.16 I/O API change           | Use `std.Io.File.writer()`            |
| `no field named 'writer'`                           | Wrong type, 0.16 Io changes   | Check the type in stdlib source       |
| `error: missing field 'xyz'`                        | Struct requires explicit init | Initialize all fields                 |
| `error: expected type '[]u8', found '*const [N]u8'` | Stricter pointer coercion     | Use `&slice` or create a proper slice |
| `error: link_libc not set`                          | Zig 0.16 requires explicit    | Add `.link_libc = true` in build.zig  |
| `warning: unused variable`                          | Zig requires all vars used    | Add `_ = var;` to explicitly discard  |

## Related skills

- `skill://zig-compiler` — compiler flags, optimization modes, build commands
- `skill://zig-build-system` — build.zig patterns
- `skill://zig-debugging` — debugging Zig binaries
- `skill://nix-zig-dev` — Nix flake dev shells for Zig projects
