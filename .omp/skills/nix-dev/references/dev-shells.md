# Development Shells Reference

## Table of contents

- [Classic shell.nix](#classic-shellnix)
- [mkShell vs mkShellNoCC](#mkshell-vs-mkshellnocc)
- [Environment variables](#environment-variables)
- [shellHook](#shellhook)
- [Project dependencies in shell](#project-dependencies-in-shell)
- [Flake devShells](#flake-devshells)
- [direnv integration](#direnv-integration)
- [Comparison table](#comparison-table)

## Classic shell.nix

```nix
let
  nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-24.11";
  pkgs = import nixpkgs { config = {}; overlays = []; };
in
pkgs.mkShellNoCC {
  packages = with pkgs; [
    rustc cargo
    pkg-config
  ];
}
```

Enter: `nix-shell` (auto-finds `shell.nix` in cwd).

One-shot: `nix-shell --run 'cargo build'`

Ad-hoc (no file): `nix-shell -p rustc cargo`

### Wrapper default.nix

When `default.nix` is a function returning attrs:

```nix
# shell.nix
(import ./. {}).shell
```

```nix
# default.nix
{ sources ? import ./npins, … }:
rec {
  package = pkgs.callPackage ./pkg.nix { };
  shell = pkgs.mkShellNoCC {
    inputsFrom = [ package ];
    packages = with pkgs; [ npins ];
  };
}
```

## mkShell vs mkShellNoCC

|          | mkShell                             | mkShellNoCC                         |
| -------- | ----------------------------------- | ----------------------------------- |
| Includes | C/C++ toolchain (gcc, make)         | No compiler toolchain               |
| Use when | Debugging package builds, C/C++ dev | General dev (Rust, Python, scripts) |

Both accept the same arguments as `mkDerivation` (`buildInputs`, `nativeBuildInputs`, etc.).

### packages vs buildInputs

`packages` is an alias for `nativeBuildInputs` in mkShell. Prefer `packages` for clarity:

```nix
pkgs.mkShellNoCC {
  packages = with pkgs; [ go golangci-lint ];  # preferred
  # buildInputs = with pkgs; [ … ];           # older style, still works
}
```

## Environment variables

Any non-reserved string attribute becomes an env var:

```nix
pkgs.mkShellNoCC {
  packages = with pkgs; [ nodejs ];
  MY_VAR = "value";
  NODE_ENV = "development";
}
```

**Protected vars** (cannot set directly): `PATH`, `HOME`, `NIX_BUILD_TOP`, `TMPDIR`, `TEMP`, `TEMPDIR`, `SHELL`, `NIX_SHELL`.

For `PS1` and other protected vars, use `shellHook`.

Always set `config = {}; overlays = [];` when importing nixpkgs to avoid global config leaking in.

## shellHook

Runs before entering the interactive shell:

```nix
pkgs.mkShellNoCC {
  packages = with pkgs; [ python3 uv ];

  shellHook = ''
    export PYTHONPATH="$PWD/src:$PYTHONPATH"
    echo "Dev shell ready"
  '';
}
```

## Project dependencies in shell

Use `inputsFrom` to inherit build deps from project derivations:

```nix
pkgs.mkShellNoCC {
  inputsFrom = [ pkgs.callPackage ./mylib.nix { } ];
  packages = with pkgs; [ gdb valgrind ];  # extra dev-only tools
}
```

This gives you the same `nativeBuildInputs`/`buildInputs` as the package build.

## Flake devShells

```nix
outputs = { self, nixpkgs }: let
  system = "x86_64-linux";
  pkgs = nixpkgs.legacyPackages.${system};
in {
  devShells.${system}.default = pkgs.mkShell {
    packages = with pkgs; [ rustc cargo ];
  };
};
```

```bash
nix develop                  # enter default devShell
nix develop .#customShell    # named shell
nix develop --command make   # run command in shell env
```

### Multiple shells

```nix
devShells.${system} = {
  default = pkgs.mkShell { packages = [ pkgs.go ]; };
  frontend = pkgs.mkShell { packages = [ pkgs.nodejs pkgs.yarn ]; };
};
```

## direnv integration

Auto-activate shell on `cd`:

```bash
# .envrc
use flake          # flake project
# or
use nix            # shell.nix in cwd
```

Requires `direnv` + `nix-direnv` (or direnv's built-in nix support). See nix.dev recipe: guides/recipes/direnv.

`nix print-dev-env` outputs the env script direnv can source:

```bash
nix print-dev-env --profile dev
```

## Comparison table

| Approach          | Pros                                  | Cons                               |
| ----------------- | ------------------------------------- | ---------------------------------- |
| `nix-shell -p`    | instant, no files                     | not reproducible, no customization |
| `shell.nix`       | simple, no flakes needed              | manual pinning                     |
| flake `devShells` | lock file, `nix develop`, CI-friendly | experimental, git tracking         |
| direnv            | auto-activate                         | extra tooling setup                |
