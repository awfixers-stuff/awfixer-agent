# Flakes Reference

## Table of contents

- [flake.nix structure](#flakenix-structure)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Lock files](#lock-files)
- [Flake references](#flake-references)
- [Commands workflow](#commands-workflow)
- [Gotchas](#gotchas)
- [Alternatives](#alternatives)

## flake.nix structure

```nix
{
  description = "Project description";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    # Pin to exact commit:
    # nixpkgs.url = "github:NixOS/nixpkgs/abc123def";
  };

  outputs = { self, nixpkgs, ... }@inputs: {
    # outputs keyed by system
    packages.x86_64-linux.default = …;
    packages.aarch64-darwin.default = …;
  };
}
```

`outputs` is a function receiving an attrset of each input (keyed by identifier) plus `self`.

## Inputs

### URL forms

```nix
inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
inputs.nixpkgs.url = "github:NixOS/nixpkgs";          # default branch
inputs.nixpkgs.url = "nixpkgs";                          # registry alias
inputs.nixpkgs.url = "path:./vendor/foo";                # local path
inputs.nixpkgs.url = "git+https://example.com/repo.git";
```

### Input follows (deduplicate nixpkgs)

```nix
inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
inputs.myLib.url = "github:owner/lib";
inputs.myLib.inputs.nixpkgs.follows = "nixpkgs";  # reuse parent's nixpkgs
```

### Non-flake inputs (import raw Nix)

```nix
inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
inputs.nixos-modules = {
  url = "github:NixOS/nixpkgs/nixos-24.11";
  flake = false;  # import as plain source, not a flake
};
# Use: import inputs.nixos-modules/nixos/modules/...
```

### Flake input attributes (in lock file / overrides)

```nix
inputs.nixpkgs = {
  url = "github:NixOS/nixpkgs";
  inputs.nixpkgs.follows = "nixpkgs";  # for transitive
};
```

## Outputs

Built-in output types (must be keyed by system where applicable):

| Output                       | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `packages.<system>.<name>`   | derivations; `.default` is `nix build` target               |
| `devShells.<system>.<name>`  | dev environments; `.default` is `nix develop` target        |
| `apps.<system>.<name>`       | `{ type = "app"; program = "<store-path>"; }` for `nix run` |
| `overlays`                   | list of `final: prev: { … }` overlay functions              |
| `nixosModules`               | NixOS module attrsets                                       |
| `nixosConfigurations.<name>` | full NixOS configs                                          |
| `formatter.<system>`         | formatter derivation for `nix fmt`                          |
| `checks.<system>.<name>`     | test derivations run by `nix flake check`                   |
| `templates.<name>`           | `nix flake init -t` templates                               |

### Example: package + devShell + app

```nix
outputs = { self, nixpkgs }: let
  system = "x86_64-linux";
  pkgs = nixpkgs.legacyPackages.${system};
in {
  packages.${system}.default = pkgs.hello;

  devShells.${system}.default = pkgs.mkShell {
    packages = with pkgs; [ rustc cargo ];
  };

  apps.${system}.default = {
    type = "app";
    program = "${pkgs.hello}/bin/hello";
  };
};
```

### flake-utils (multi-system helper)

```nix
inputs.flake-utils.url = "github:numtide/flake-utils";
outputs = { self, nixpkgs, flake-utils }:
  flake-utils.lib.eachDefaultSystem (system: let
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    packages.default = pkgs.hello;
  });
```

## Lock files

- `flake.lock` pins exact input revisions — **commit to VCS**
- `nix flake lock` — create lock without building
- `nix flake update` — update all inputs
- `nix flake update nixpkgs` — update one input
- Override input temporarily: `nix build --override-input nixpkgs 'github:NixOS/nixpkgs/nixos-24.11'`

## Flake references

### URL-like (remote)

```
github:NixOS/nixpkgs/24.05
github:NixOS/nixpkgs?dir=pkgs/top-level
```

### Path-like (local)

- `.` — search upward for `flake.nix`
- `./subdir` — relative path
- In git repos: only tracked (staged) files are visible

### Installable

```
.                          # current flake
.#default                  # default package
.#packages.x86_64-linux.myPkg
github:NixOS/nixpkgs#hello
```

## Commands workflow

```bash
# New project
nix flake init
nix flake init -t github:NixOS/templates#python

# After editing inputs or outputs
nix flake lock
nix flake check

# Daily use
nix develop
nix build
nix run
nix flake show
```

## Gotchas

1. **Git tracking** — untracked/unstaged files are invisible to flakes in git repos
2. **Pure evaluation** — `builtins.getEnv` returns `""` unless `--impure`
3. **No flake parameters** — system must be explicit per output or via flake-utils
4. **Whole repo copied** — large repos cache slowly; consider `flake = false` imports
5. **Experimental** — API may change; pin Nix version in CI
6. **nixConfig in flake** — can set `experimental-features`; requires `--accept-flake-config`

Enable permanently:

```nix
# NixOS
nix.settings.experimental-features = [ "nix-command" "flakes" ];
```

```ini
# nix.conf
experimental-features = nix-command flakes
```

## Alternatives

Per nix.dev, flakes are optional. Equivalent without flakes:

| Flake feature      | Alternative                     |
| ------------------ | ------------------------------- |
| Pinned inputs      | `fetchTarball`, npins, niv      |
| `nix develop`      | `nix-shell` + `shell.nix`       |
| `nix run github:…` | `nix-build` + `nix-shell --run` |
| Registry aliases   | `NIX_PATH` or explicit `import` |

Use flakes as thin wrappers over existing Nix code to keep both paths working.
