# Nix CLI Reference

## Table of contents

- [v3 commands (preferred)](#v3-commands-preferred)
- [Legacy v2 commands](#legacy-v2-commands)
- [Common flags](#common-flags)
- [Installables syntax](#installables-syntax)

## v3 commands (preferred)

Requires `experimental-features = nix-command flakes` (flakes optional for some commands).

### Build & run

```bash
nix build [installable]           # build default or specified output; result → ./result
nix build .#packages.x86_64-linux.myPkg
nix build github:NixOS/nixpkgs#hello
nix build --no-link               # build but don't symlink result

nix run [installable] [-- args]   # build and run default app
nix run nixpkgs#hello -- --greeting hi
nix run .#myApp

nix bundle [installable]          # create self-contained executable
```

### Development environments

```bash
nix develop [installable]         # enter devShell (flake) or print-dev-env
nix develop --command bash -c 'make'
nix print-dev-env                 # print shell hook script (for direnv)

nix shell -p pkg1 pkg2            # ephemeral shell with packages (no flake needed)
nix shell nixpkgs#python313 nixpkgs#poetry
```

### Evaluation & inspection

```bash
nix eval .#packages.x86_64-linux.default --raw
nix eval --file ./expr.nix --apply 'x: x.version'
nix eval --expr '1 + 2' --raw

nix derivation show <installable> # show .drv JSON
nix path-info <store-path>        # metadata about store path
nix why-depends <path> <path>     # dependency chain
nix log <drv-path>                # build log
```

### Search & format

```bash
nix search nixpkgs python
nix search nixpkgs 'python3.*' --json

nix fmt [paths]                   # format .nix files (uses treefmt if configured)
nix flake metadata .              # show flake inputs/outputs metadata
```

### Profile management (v3)

```bash
nix profile install nixpkgs#hello
nix profile list
nix profile remove <index>
nix profile upgrade <index>
nix profile history
nix profile rollback
```

### Flake commands

```bash
nix flake init [-t <template>]    # create flake.nix from template
nix flake lock                    # create/update flake.lock
nix flake update [input]          # update specific or all inputs
nix flake show [flake-ref]        # list outputs
nix flake check                   # evaluate all outputs
nix flake prefetch <url>          # prefetch flake source
nix flake archive <flake-ref>     # copy flake + inputs to store
```

### Hash utilities

```bash
nix hash file <path>
nix hash path <path>
nix hash to-sri --type sha256 <hash>
```

## Legacy v2 commands

Still work; use when flakes unavailable or for simple one-off builds.

```bash
nix-build [file] [-A attr]        # build; result → ./result
nix-shell [file] [-p pkgs]        # enter shell environment
nix-shell --run 'command'         # one-shot
nix-instantiate --eval -E 'expr'  # evaluate expression
nix-instantiate --parse file.nix  # parse check

nix-env -iA nixpkgs.hello         # install to user profile (legacy)
nix-env -qaP | grep hello         # query packages

nix-store --query --references <path>   # direct deps
nix-store --query --requisites <path>     # full closure
nix-collect-garbage -d                  # delete unreachable store paths
```

## Common flags

```bash
--option substitute false         # skip binary cache, build locally
--option narinfo-cache-negative-ttl 0  # force re-check binary cache
--show-trace                      # full Nix stack trace on error
--impure                          # allow impure env (override pure default in flakes)
--accept-flake-config             # accept flake nixConfig settings
--extra-experimental-features 'nix-command flakes'
-I nixpkgs=<path-or-url>          # override nixpkgs lookup path
--arg name value                  # pass function argument (classic)
--argstr name string              # pass string argument
```

## Installables syntax

| Form              | Example                               | Meaning                 |
| ----------------- | ------------------------------------- | ----------------------- |
| `.`               | `nix build .`                         | current directory flake |
| `.#attr`          | `nix build .#myPkg`                   | flake output attribute  |
| `flake-ref#attr`  | `nix build github:owner/repo#pkg`     | remote flake output     |
| `flake-ref`       | `nix run nixpkgs#hello`               | registry alias or URL   |
| `-f file -A attr` | `nix-build -f default.nix -A package` | classic attribute       |

### Flake reference forms

```
path:/abs/path
path:./relative
github:owner/repo[/ref]
gitlab:owner/repo[/ref]
git+https://host/repo?ref=branch
```

Registry aliases (e.g. `nixpkgs`) resolve via `~/.config/nix/registry.json` or NixOS `nix.registry`.
