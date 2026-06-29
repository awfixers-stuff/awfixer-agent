---
name: nix-dev
description: |
  Official nix.dev workflows for Nix package management, development environments,
  and reproducible builds. Use when working with Nix, nixpkgs, flakes, shell.nix,
  flake.nix, stdenv.mkDerivation, callPackage, nix-shell, nix develop, nix build,
  nix run, pinning nixpkgs, packaging software, or debugging Nix store/build errors.
  Covers both classic (non-flake) and flake-based workflows per nix.dev guidance.
---

# Nix (nix.dev)

Guide for reproducible dev environments, packaging, and flakes. Bias toward pinned nixpkgs and explicit imports over `<nixpkgs>` lookup paths.

## Choose a workflow

```
Need dev environment?
  ├─ Existing flake.nix → nix develop (see references/dev-shells.md)
  ├─ No flake, quick setup → shell.nix + nix-shell
  └─ Auto-activate on cd → direnv + .envrc (see nix.dev/guides/recipes/direnv)

Need to package software?
  ├─ Single .nix file → callPackage + stdenv.mkDerivation (see references/packaging.md)
  └─ Shareable project → flake with packages output (see references/flakes.md)

Need to run/build something?
  ├─ Flake project → nix build / nix run / nix develop
  └─ Classic .nix → nix-build / nix-shell / nix-instantiate
```

## Quick start

### Classic dev shell (no flake)

Copy [assets/shell-template.nix](assets/shell-template.nix), then:

```bash
nix-shell          # enter environment
nix-shell --run 'cowsay hello'   # one-shot command
```

### Flake project

```bash
nix flake init -t github:NixOS/templates#python  # or copy assets/flake-template.nix
nix flake lock
nix develop          # dev shell
nix build            # default package
nix run              # default app
nix flake show       # list outputs
```

Enable flakes if needed (one-time):

```bash
# /etc/nix/nix.conf or ~/.config/nix/nix.conf
experimental-features = nix-command flakes
```

Or per-command: `nix --extra-experimental-features 'nix-command flakes' build`

## Core patterns

### Pin nixpkgs (always)

Never rely on `<nixpkgs>` — it depends on `$NIX_PATH` and differs per machine.

```nix
let
  nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-24.11";
  pkgs = import nixpkgs { config = {}; overlays = []; };
in ...
```

Find tested commits at [status.nixos.org](https://status.nixos.org/). See [references/pinning.md](references/pinning.md).

### Package with callPackage

```nix
# default.nix
{ pkgs ? import (fetchTarball "…") {} }:
pkgs.callPackage ./mypkg.nix {}
```

```nix
# mypkg.nix — only declare args you actually use; callPackage supplies the rest
{ stdenv, fetchFromGitHub, cmake, pkg-config }:
stdenv.mkDerivation {
  pname = "myapp";
  version = "1.0.0";
  src = fetchFromGitHub { owner = "…"; repo = "…"; rev = "…"; hash = "sha256-…"; };
  nativeBuildInputs = [ cmake pkg-config ];
  buildInputs = [ /* runtime libs */ ];
}
```

Build: `nix-build` or `nix-build -A package` if using `default.nix` with attrs.

### Fetch source hashes

```bash
# Tarball content hash (not file hash)
nix-prefetch-url --unpack <url> --type sha256

# Local path / flake input
nix hash path ./some-dir

# GitHub archive in flake
nix flake prefetch github:owner/repo
```

Put SRI hashes (`sha256-…`) in fetchers; Nix will error with the correct hash on mismatch.

## Language pitfalls

From nix.dev best practices — avoid these in new code:

| Anti-pattern                              | Problem                        | Fix                                                 |
| ----------------------------------------- | ------------------------------ | --------------------------------------------------- |
| `rec { a = a; }`                          | infinite recursion             | `let a = 1; in { inherit a; }`                      |
| `with (import <nixpkgs> {});` at file top | opaque scope, non-reproducible | `let pkgs = import … {}; inherit (pkgs) curl; in …` |
| `<nixpkgs>` lookup paths                  | machine-dependent revision     | `fetchTarball` or npins                             |
| Bare URLs in Nix                          | parsed as path, not string     | Always quote: `"https://…"`                         |
| `buildInputs` in mkShellNoCC              | works but confusing            | prefer `packages = with pkgs; [ … ];`               |

## Flake essentials

Minimal structure:

```nix
{
  description = "…";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }: {
    packages.x86_64-linux.default = …;
    devShells.x86_64-linux.default = …;
  };
}
```

**Gotchas:**

- Files must be **git-tracked** (staged) for flakes to see them
- Flakes run in **pure mode** by default (no impure env vars)
- Import Nix modules without locking: `inputs.foo = { url = "…"; flake = false; };`
- Lock after input changes: `nix flake lock` or `nix flake update <input>`

Full reference: [references/flakes.md](references/flakes.md)

## CLI cheat sheet

| Task            | Flake                                      | Classic                                      |
| --------------- | ------------------------------------------ | -------------------------------------------- |
| Dev shell       | `nix develop`                              | `nix-shell` / `nix-shell -p pkg`             |
| Build           | `nix build` / `nix build .#pkg`            | `nix-build`                                  |
| Run             | `nix run` / `nix run nixpkgs#hello`        | `nix-shell --run`                            |
| Search packages | `nix search nixpkgs term`                  | [search.nixos.org](https://search.nixos.org) |
| Eval expression | `nix eval .#packages.x86_64-linux.default` | `nix-instantiate --eval -E '…'`              |
| Show outputs    | `nix flake show`                           | —                                            |
| Garbage collect | `nix-collect-garbage -d`                   | same                                         |

Full reference: [references/cli-commands.md](references/cli-commands.md)

## Debugging builds

1. **Read the log** — `nix log <drv>` or check `/nix/var/log/nix/drvs/…`
2. **Enter build env** — `nix develop` or `nix-shell` with `inputsFrom = [ drv ];`
3. **Override phases** — set `dontFixup = true;`, custom `installPhase`, or `postPatch`
4. **Missing dep** — add to `buildInputs` (link time) or `nativeBuildInputs` (build time)
5. **Hash mismatch** — copy correct hash from error output into fetcher

See [references/packaging.md](references/packaging.md) for phases/hooks and [references/troubleshooting.md](references/troubleshooting.md) for store/cache errors.

## Dependency management without flakes

Use **npins** (recommended) or **niv** for lockfile-style source pinning:

```bash
npins init --bare
npins add github nixos nixpkgs --branch nixos-24.11
```

Import in Nix: `sources = import ./npins; pkgs = import sources.nixpkgs { … };`

See [references/pinning.md](references/pinning.md).

## Reference index

Load on demand — do not read all upfront.

| File                                                           | Read when                                               |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| [references/cli-commands.md](references/cli-commands.md)       | Choosing or debugging nix CLI invocations               |
| [references/flakes.md](references/flakes.md)                   | Writing/editing flake.nix, inputs, outputs, lock files  |
| [references/packaging.md](references/packaging.md)             | stdenv.mkDerivation, fetchers, phases, callPackage      |
| [references/dev-shells.md](references/dev-shells.md)           | shell.nix, mkShell, env vars, nix develop               |
| [references/pinning.md](references/pinning.md)                 | Pinning nixpkgs, npins/niv, NIX_PATH, NixOS integration |
| [references/troubleshooting.md](references/troubleshooting.md) | Store DB errors, binary cache, schema version, macOS    |

## Templates

Copy and adapt from [assets/](assets/):

- `shell-template.nix` — pinned classic dev shell
- `flake-template.nix` — flake with package + devShell
- `package-template.nix` — callPackage derivation starter

## External manuals

- Nix language details: https://nix.dev/tutorials/nix-language
- Nixpkgs stdenv/functions: https://nixos.org/manual/nixpkgs/stable/
- NixOS system config: https://nixos.org/manual/nixos/stable/ (out of scope for this skill)
