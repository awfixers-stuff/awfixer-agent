# Pinning Nixpkgs Reference

## Table of contents

- [Why pin](#why-pin)
- [Pinning methods](#pinning-methods)
- [URL formats](#url-formats)
- [npins workflow](#npins-workflow)
- [Command-line overrides](#command-line-overrides)
- [NixOS integration](#nixos-integration)
- [Finding commits](#finding-commits)

## Why pin

`<nixpkgs>` and `$NIX_PATH` depend on machine state (channels). Same expression → different results on different machines. Always pin to a specific tarball, commit, or lock file.

## Pinning methods

| Method                | Lock file                            | Best for                           |
| --------------------- | ------------------------------------ | ---------------------------------- |
| `fetchTarball` inline | no (hash in expression)              | simple single-file projects        |
| `npins`               | `npins/default.nix` + `sources.json` | classic multi-source projects      |
| `niv`                 | `niv/sources.json`                   | legacy projects (migrate to npins) |
| flake inputs          | `flake.lock`                         | flake projects                     |

## URL formats

```nix
# Specific commit (most reproducible)
fetchTarball "https://github.com/NixOS/nixpkgs/archive/abc123def.tar.gz"

# Release branch (moving target within branch)
fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-24.11"

# Channel (tested snapshot)
fetchTarball "https://github.com/NixOS/nixpkgs/archive/nixos-24.11.tar.gz"

# Official channel URL
# http://nixos.org/channels/nixos-24.11/nixexprs.tar.xz
```

Import pattern:

```nix
let
  nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-24.11";
  pkgs = import nixpkgs { config = {}; overlays = []; };
in …
```

## npins workflow

```bash
# Setup
npins init --bare
npins add github nixos nixpkgs --branch nixos-24.11
npins add github owner mylib --subpath subdir   # optional subpath
```

```nix
# default.nix
{ sources ? import ./npins, system ? builtins.currentSystem }:
let
  pkgs = import sources.nixpkgs { inherit system; config = {}; overlays = []; };
in {
  package = pkgs.callPackage ./pkg.nix { };
}
```

Update: `npins update` or `npins update nixpkgs`

Override sources at eval time:

```bash
nix-build -A package --arg sources 'import ./other-npins'
```

Migrate from niv: `npins import-niv` (warning: updates all entries).

## Command-line overrides

```bash
# Override nixpkgs for one build
nix-build -I nixpkgs=https://github.com/NixOS/nixpkgs/archive/nixos-24.11.tar.gz
nix-build -I nixpkgs=channel:nixos-24.11

# Environment variable
NIX_PATH=nixpkgs=channel:nixos-24.11 nix-build
```

## NixOS integration

### Classic (NIX_PATH)

```nix
# configuration.nix
{ lib, … }:
let sources = import ./npins;
in {
  nix.channel.enable = false;
  nix.nixPath = lib.mapAttrsToList (k: v: "${k}=${v}") sources;
}
```

Rebuild:

```bash
sudo NIX_PATH="nixpkgs=$(nix-instantiate --eval -E '(import ./npins).nixpkgs.outPath' --raw)" \
  nixos-rebuild switch
```

### With flakes enabled

```nix
{ lib, … }:
let sources = import ./npins;
in {
  nix.settings.experimental-features = [ "nix-command" "flakes" ];
  nix.registry = lib.mapAttrs (_: path: {
    flake = false;
    to = { type = "path"; inherit path; };
  }) sources;
}
```

## Finding commits

- **[status.nixos.org](https://status.nixos.org/)** — latest **tested** commits per release channel
- **[nixos.org/channels](https://nixos.org/channels)** — active channel list
- **FAQ on channel branches** — nix.dev/concepts/faq#channel-branches

Pin to tested commits for stability; pin to branch tarballs for newer (untested) packages.
