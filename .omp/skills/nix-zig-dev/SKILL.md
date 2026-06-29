---
name: nix-zig-dev
description: Setting up Nix flake dev shells for Zig projects that need C system libraries (Wayland, Mesa, libinput, DRM, Vulkan, etc.). Use when working on Zig projects with @cImport, native C dependencies, or Nix packaging for Zig binaries. Triggers on: flake.nix for a Zig project, build.zig.zon with system deps, "nix develop" failing for Zig, or missing C headers in a Zig build.
---

# Nix Flake Dev Shells for Zig Projects

## Why this skill

Zig projects that use `@cImport` or link against C libraries need those libraries' headers and shared objects available at build time. On NixOS, these don't live in `/usr/include` or `/usr/lib` — Nix provides them through derivations. This skill covers the patterns that work.

## The core pattern

For a Zig project with C dependencies, the flake needs:

1. The C libraries as `buildInputs` in a dev shell
2. Environment variables so Zig's `@cImport` can find headers and link against libs
3. `link_libc = true` in `build.zig` (required in Zig 0.16+ for any `std.c` usage)
4. `pkg-config` in the shell so build.zig can discover libraries programmatically

## Minimal working flake

```nix
{
  description = "Zig project with C deps";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            zig
            pkg-config
            # C libraries your Zig code needs via @cImport
            wayland
            libxkbcommon
          ];

          shellHook = ''
            echo "Zig dev shell ready (zig $(zig version))"
          '';
        };
      });
}
```

## When Zig can't find C headers

`@cImport` / `@cInclude` look for headers. On NixOS they won't be at standard paths. Two approaches:

### Approach 1: pkg-config in build.zig (preferred)

```zig
// build.zig
const wayland = b.dependency("wayland", .{});
exe.linkLibrary(wayland.artifact("wayland-client"));

// Or for system libs found via pkg-config:
// zig build handles this when pkg-config is in the shell
```

If using `@cImport` directly without pkg-config in build.zig, set env vars:

### Approach 2: Explicit include/lib paths

```nix
shellHook = ''
  export C_INCLUDE_PATH="${pkgs.wayland.dev}/include:${pkgs.libxkbcommon.dev}/include:$C_INCLUDE_PATH"
  export LIBRARY_PATH="${pkgs.wayland.out}/lib:${pkgs.libxkbcommon.out}/lib:$LIBRARY_PATH"
  export LD_LIBRARY_PATH="${pkgs.wayland.out}/lib:${pkgs.libxkbcommon.out}/lib:$LD_LIBRARY_PATH"
'';
```

## Common package name gotchas

Nixpkgs naming quirks that repeatedly cause failures:

| What you want                 | Nixpkgs attr (correct)         | Wrong attempt                   |
| ----------------------------- | ------------------------------ | ------------------------------- |
| Mesa OpenGL/Vulkan headers    | `pkgs.mesa`                    | `pkgs.mesa.dev` (doesn't exist) |
| Wayland protocols + libs      | `pkgs.wayland`                 | `pkgs.wayland-dev`              |
| libdrm (DRM/KMS)              | `pkgs.libdrm`                  | `pkgs.drm`                      |
| libinput                      | `pkgs.libinput`                | `pkgs.linput`                   |
| Vulkan headers                | `pkgs.vulkan-headers`          | `pkgs.vulkan`                   |
| GBM (Graphics Buffer Manager) | `pkgs.mesa` (includes GBM)     | `pkgs.gbm`                      |
| udev                          | `pkgs.systemd` (includes udev) | `pkgs.udev`                     |
| libxkbcommon                  | `pkgs.libxkbcommon`            | `pkgs.xkbcommon`                |

When a package isn't found, search: `nix search nixpkgs <name>` or check `pkgs.<name>` with tab completion in a Nix REPL.

## Wayland compositor dev shell (full example)

```nix
devShells.default = pkgs.mkShell {
  buildInputs = with pkgs; [
    zig
    pkg-config
    # Core Wayland
    wayland
    wayland-protocols
    wayland-scanner
    # Rendering
    mesa                    # includes GBM, EGL, GLES
    vulkan-headers
    # Input
    libinput
    libxkbcommon
    # DRM/KMS
    libdrm
    # Utilities
    udev                   # from systemd
    pixman
    fcft                    # font rendering (optional)
  ];

  shellHook = ''
    export C_INCLUDE_PATH="${pkgs.wayland.dev}/include:${pkgs.wayland-protocols}/include:${pkgs.libxkbcommon.dev}/include:${pkgs.mesa}/include:${pkgs.libdrm.dev}/include:${pkgs.libinput.dev}/include:${pkgs.vulkan-headers}/include:$C_INCLUDE_PATH"
    export LIBRARY_PATH="${pkgs.wayland.out}/lib:${pkgs.libxkbcommon.out}/lib:${pkgs.mesa.out}/lib:${pkgs.libdrm.out}/lib:${pkgs.libinput.out}/lib:$LIBRARY_PATH"
    echo "Wayland compositor dev shell ready"
  '';
};
```

## Using the Nix-provided Zig

On NixOS, Zig is available via `pkgs.zig` (currently 0.16). To get the stdlib path for spelunking:

```bash
# Find Zig's stdlib — useful when docs don't match the installed version
echo $(dirname $(readlink -f $(which zig)))/../lib/zig/std/
# Or: zig env | grep std_dir
```

## Patching Zig derivations

When the nixpkgs Zig version has issues or you need a different version:

```nix
# Override Zig version in your flake
zig = pkgs.zig.overrideAttrs (old: {
  version = "0.16.0";
  # Use a different source if needed
});
```

## Cross-compilation with Nix + Zig

Zig can cross-compile without a cross toolchain, but C libraries need cross-compiled versions:

```nix
# For aarch64-linux target
pkgsCross = import nixpkgs {
  localSystem = system;
  crossSystem = "aarch64-linux";
};

devShells.aarch64 = pkgsCross.mkShell {
  buildInputs = with pkgsCross; [
    zig
    wayland  # cross-compiled
  ];
};
```

## Debugging build failures

1. **`error: unable to find library`** → the lib isn't in `buildInputs` or LIBRARY_PATH
2. **`fatal error: 'wayland-client.h' not found`** → headers not in C_INCLUDE_PATH, or package uses `.dev` split (try without `.dev`)
3. **`error: ld.lld: cannot open shared object file`** → LD_LIBRARY_PATH missing or lib isn't in buildInputs
4. **`error: no field named 'dev'`** on a Nix package → not all packages have `.dev`; try the bare attribute or `.out`
5. **`zig build` succeeds but `nix build` fails** → check that the Nix derivation includes the same deps as the dev shell

## Related skills

- `skill://nix-best-practices` — general Nix flake patterns, overlays, unfree packages
- `skill://zig-compiler` — zig build commands, optimization modes, target triples
- `skill://zig-build-system` — build.zig patterns for multi-file projects
- `skill://zig-cinterop` — @cImport, translate-c, C ABI in Zig
