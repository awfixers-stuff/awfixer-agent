# Packaging Reference

## Table of contents

- [Minimal package](#minimal-package)
- [callPackage pattern](#callpackage-pattern)
- [Source fetchers](#source-fetchers)
- [Build inputs](#build-inputs)
- [Build phases](#build-phases)
- [Finding dependencies](#finding-dependencies)
- [Debugging failures](#debugging-failures)

## Minimal package

```nix
{ stdenv, fetchFromGitHub }:
stdenv.mkDerivation {
  pname = "myapp";
  version = "1.0.0";

  src = fetchFromGitHub {
    owner = "owner";
    repo = "repo";
    rev = "v1.0.0";
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  nativeBuildInputs = [ /* build tools: cmake, pkg-config, … */ ];
  buildInputs = [ /* libraries linked at runtime */ ];
}
```

Build: `nix-build` in same directory, or `nix-build -f default.nix -A package`.

## callPackage pattern

`callPackage` reads the function's argument names and auto-supplies matching packages from nixpkgs.

```nix
# default.nix
{ pkgs ? import <nixpkgs> {} }:
{
  myapp = pkgs.callPackage ./myapp.nix { };
  # override: pkgs.callPackage ./myapp.nix { openssl = pkgs.libressl; };
}
```

Only list arguments you use in the function head — `stdenv`, `fetchFromGitHub`, etc. are filled automatically.

### finalAttrs pattern (overrides)

```nix
stdenv.mkDerivation (finalAttrs: {
  pname = "myapp";
  version = "1.0.0";
  src = …;
  # reference finalAttrs.version inside attrs if needed
})
```

Override: `myPkg.overrideAttrs (old: { version = "2.0.0"; })`

## Source fetchers

| Fetcher                 | Use case                                            |
| ----------------------- | --------------------------------------------------- |
| `fetchurl`              | single file download                                |
| `fetchzip` / `fetchtar` | archives (`hash` = unpacked content for `--unpack`) |
| `fetchFromGitHub`       | GitHub archive (`owner`, `repo`, `rev`, `hash`)     |
| `fetchgit`              | git repo (needs `hash` of fetched snapshot)         |
| `fetchFromGitLab`       | GitLab archive                                      |
| `fetchpatch`            | remote patch file                                   |

### Getting hashes

```bash
# Archive content hash
nix-prefetch-url --unpack https://github.com/owner/repo/archive/v1.0.tar.gz

# GitHub via nix-prefetch-github (nixpkgs)
nix-prefetch-github owner repo --rev v1.0.0

# Let Nix tell you (set hash to "" and build)
nix-build 2>&1 | grep got:
```

Use SRI format in modern nixpkgs: `hash = "sha256-…";`

## Build inputs

| Attribute               | When                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `nativeBuildInputs`     | Build-time tools (compilers, cmake, pkg-config, autotools) |
| `buildInputs`           | Libraries/headers linked into the built artifact           |
| `propagatedBuildInputs` | Deps propagated to dependents                              |
| `depsBuildBuild`        | native deps of native deps (cross-compilation)             |

**Rule of thumb:** tool that runs during build → `nativeBuildInputs`. Library the built binary links against → `buildInputs`.

## Build phases

stdenv runs phases in order; override or skip with `dont<Phase> = true`:

```
unpackPhase → patchPhase → configurePhase → buildPhase → checkPhase → installPhase → fixupPhase
```

### Common overrides

```nix
{
  # Skip autotools configure
  dontConfigure = true;

  # Custom install
  installPhase = ''
    runHook preInstall
    mkdir -p $out/bin
    cp mybinary $out/bin/
    runHook postInstall
  '';

  # Patches
  patches = [ ./my-fix.patch ];
  postPatch = ''
    substituteInPlace Makefile --replace '/usr/local' '$out'
  '';

  # Tests
  doCheck = true;  # run checkPhase
  doInstallCheck = true;
}
```

### Hooks

Each phase supports `pre<Phase>` and `post<Phase>` shell snippets. Always call `runHook preInstall` / `runHook postInstall` when overriding install.

## Finding dependencies

1. **search.nixos.org** — web search for nixpkgs packages
2. **`nix search nixpkgs <term>`** — CLI search
3. **Local grep** — `rg 'pname = "libfoo"' pkgs/`
4. **Build error** — `undefined reference to` → add the providing package to `buildInputs`
5. **pkg-config errors** — add the `-dev` or main package to `nativeBuildInputs`

### Package sets as deps

```nix
{ stdenv, xorg, … }:
stdenv.mkDerivation {
  buildInputs = [ xorg.libX11 imlib2 ];
}
```

## Debugging failures

```bash
# Keep build directory on failure
nix-build --keep-failed
cd /tmp/nix-build-…  # path shown in error

# Enter failed build's environment
nix-shell /nix/store/…-myapp-1.0.drv

# Verbose trace
nix-build --show-trace

# Build specific attribute in monorepo
nix-build -A myapp
```

### Common errors

| Error                                      | Fix                                                        |
| ------------------------------------------ | ---------------------------------------------------------- |
| `hash mismatch`                            | Copy correct hash from error into fetcher                  |
| `variable undefined`                       | Add missing arg to function head (callPackage supplies it) |
| `No such file or directory` during install | Fix `installPhase` paths                                   |
| `configure: error`                         | Add deps to `nativeBuildInputs`, set `configureFlags`      |
| `CMake Error: Could not find`              | Add cmake + the missing library dep                        |

### Language choice

- **autotools** (configure.ac) — stdenv auto-detects; set `configureFlags`
- **cmake** — add `cmake` to `nativeBuildInputs`; use `postInstall` for extra steps
- **meson** — `meson`, `ninja` in `nativeBuildInputs`
- **rust** — `rustPlatform.buildRustPackage` or `crane`/`naersk` in flakes
- **python** — `python3Packages.buildPythonPackage` with `pyproject.toml`/`setup.py`

See nixpkgs manual for language-specific builders.
