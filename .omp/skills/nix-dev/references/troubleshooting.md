# Troubleshooting Reference

## Table of contents

- [Binary cache issues](#binary-cache-issues)
- [Store database corruption](#store-database-corruption)
- [Store schema version mismatch](#store-schema-version-mismatch)
- [Network errors](#network-errors)
- [macOS issues](#macos-issues)
- [Flake-specific issues](#flake-specific-issues)
- [Build failures](#build-failures)

## Binary cache issues

### Cache down or unreachable

Build locally instead of substituting:

```bash
nix build --option substitute false
nix-build --option substitute false
```

### Force re-check cache

Nix caches negative cache answers (path not available). Override TTL:

```bash
nix build --option narinfo-cache-negative-ttl 0
```

### Trust/configure caches

```ini
# nix.conf
substituters = https://cache.nixos.org https://my-cache.example.com
trusted-public-keys = cache.nixos.org-1:… my-cache.example.com-1:…
```

See nix.dev/guides/recipes/add-binary-cache.

## Store database corruption

### `error: querying path in database: database disk image is malformed`

```bash
sqlite3 /nix/var/nix/db/db.sqlite "pragma integrity_check"
```

If errors are missing references:

```bash
sudo mv /nix/var/nix/db/db.sqlite /nix/var/nix/db/db.sqlite-bkp
sudo sqlite3 /nix/var/nix/db/db.sqlite-bkp ".dump" | sudo sqlite3 /nix/var/nix/db/db.sqlite
```

Known issue: https://github.com/NixOS/nix/issues/1353

## Store schema version mismatch

### `error: current Nix store schema is version 10, but I only support 7`

Nix binary version doesn't match the store's schema. Fix:

1. Upgrade Nix to match the store schema, or
2. Reinstall Nix at the version that created the store

Never run an older Nix against a store upgraded by a newer version.

## Network errors

### `writing to file: Connection reset by peer`

Transient network failure during substitution or download. Retry, or:

```bash
nix build --option substitute false   # build from source
```

Check disk space: `df -h /nix`

## macOS issues

### macOS update breaks Nix installation

System updates can invalidate the Nix daemon's authorized volume configuration.

1. Re-run the Nix installer, or
2. Re-authorize the Nix volume in System Settings → Privacy & Security

See nix.dev/install-nix for current macOS install guidance.

### `/bin/bash` missing (newer macOS)

Nix scripts may reference `/bin/bash`. Ensure bash is available or update Nix to a version that handles this.

## Flake-specific issues

### `error: Path '…' in the repository is not tracked by git`

Stage files: `git add <file>`

Flakes only see git-tracked files in git repositories.

### `error: experimental Nix feature 'flakes' is disabled`

```bash
nix --extra-experimental-features 'nix-command flakes' build
```

Or enable in `nix.conf` / NixOS `nix.settings.experimental-features`.

### `error: cannot find flake 'flake:nixpkgs' in the flake registries`

```bash
nix registry add nixpkgs github:NixOS/nixpkgs/nixos-unstable
```

Or use full URL: `github:NixOS/nixpkgs#hello`

### Infinite rebuilds / stale lock

```bash
nix flake lock --recreate-lock-file
rm -rf result && nix build
```

## Build failures

### `error: builder for '…' failed with exit code 1`

```bash
nix log /nix/store/…-myapp-1.0.drv
nix-build --keep-failed    # inspect $sourceRoot in kept dir
```

### `hash mismatch in fixed-output derivation`

Copy the `got:` hash from the error into your fetcher:

```
error: hash mismatch in fixed-output derivation '…'
         specified: sha256-AAAA…
            got:    sha256-BBBB…
```

### `there is no binary for the 'darwin-arm64' installer`

Wrong installer architecture — download the correct one from nix.dev/install-nix.

### Disk space

```bash
nix-collect-garbage -d          # delete unreachable paths
nix-store --optimise            # deduplicate store
```

Check GC roots holding space: `nix-store --gc --print-roots`

### Permission errors (multi-user Nix)

```bash
sudo chown -R "$(whoami)" /nix/var/nix/profiles/per-user/$(whoami)
```

Ensure your user is in the `nix-users` group (Linux).
