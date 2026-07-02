# Update-checker domains — repointed to awfixer fork

This file records every update-checker **poll site** that was neutralised during the
`oh-my-pi` → `awfixer-agent` fork rebrand (see `REBRANDING.md`) and the targets used
when self-update was re-enabled.

**API host:** `https://agent-api.awfixer.codes` — Vercel deployment of `packages/agent-api`
(npm registry proxy for `@awfixerai/*`, GitHub `/latest` fallback, install script, release redirects).

**Docs host:** `https://agent.awfixer.codes` — user-facing site (install may also be served from
`agent-api` at `/install` until the docs site is live).

> Scope: the **self-update path** only — code that polls a remote server to check for /
> install a newer version of the `omp`/`agent` CLI itself. Third-party pollers
> (`scripts/check-spoofed-versions.ts`, `utils/tools-manager.ts` `getLatestVersion`)
> poll GitHub for unrelated upstreams (Gemini CLI drift, sd/sg/yt-dlp releases) and were
> intentionally left untouched — nulling them would break unrelated tooling with no
> rebrand benefit.

## New target identities (provided by user)

| Resource | New value |
| --- | --- |
| Site / docs host | `agent.awfixer.codes` |
| GitHub org/repo | `awfixers-stuff/awfixer-agent` |
| npm scope | `@awfixerai/*` (e.g. `@awfixerai/agent`) |

## Nulled poll sites

### 1. `packages/coding-agent/src/main.ts` — `checkForNewVersion`

Startup update notifier (runs in interactive mode, gated by `startup.checkUpdate`).

- **Was:** `fetch("https://registry.npmjs.org/@oh-my-pi/pi-coding-agent/latest")`
- **Now:** `const UPDATE_CHECK_URL = "" as const;` with an `if (!UPDATE_CHECK_URL) return undefined;`
  early-return so the fetch never runs. Errors are swallowed by the surrounding
  try/catch (existing behavior).
- **Repointed to:** `https://agent-api.awfixer.codes/@awfixerai/agent/latest`
  (proxies npm when published; falls back to latest GitHub release tag otherwise).

### 2. `packages/coding-agent/src/cli/update-cli.ts` — `getLatestRelease` (`NPM_REGISTRY`)

`omp update --check` / `omp update` fetches the latest published version from npm.

- **Was:** `const NPM_REGISTRY = "https://registry.npmjs.org/";`
  → `fetch(\`${NPM_REGISTRY}${PACKAGE}/latest\`)` where `PACKAGE = "@oh-my-pi/pi-coding-agent"`.
- **Now:** `const NPM_REGISTRY = "" as const;` with an early `throw` guard in
  `getLatestRelease` so `omp update` surfaces a clean "disabled pending rebrand" error
  instead of a network failure.
- **Repointed to:** `NPM_REGISTRY = https://agent-api.awfixer.codes/` (fork update API; proxies
  `registry.npmjs.org` for `@awfixerai/*` so bun install and version check share one catalog).

### 3. `packages/coding-agent/src/cli/update-cli.ts` — `updateViaBinaryAt` (`REPO`)

Binary self-update path: downloads the platform release asset from GitHub.

- **Was:** `const REPO = "awfixers-stuff/awfixer-agent";`
  → `fetch(\`https://github.com/${REPO}/releases/download/${tag}/${binaryName}\`)`.
- **Now:** `const REPO = "" as const;` with an early `throw` guard in
  `updateViaBinaryAt` so the broken GitHub URL is never built/fetched.
- **Repointed to:** `awfixers-stuff/awfixer-agent`. Binary downloads go through
  `https://agent-api.awfixer.codes/releases/download/<tag>/<asset>` (redirects to GitHub;
  maps `agent-*` asset names to published `omp-*` release filenames).

## Related brand-tied constants (NOT polls — repoint in the same pass)

These live in the same update path but **do not poll a domain directly** — they hand
strings to `brew`/`mise`/`bun` or print URL hints. Left untouched per "remove the domain
**it polls**" scope, but must be repointed together with the polls above:

| Constant / string | File:line (approx) | Was | Target |
| --- | --- | --- | --- |
| `PACKAGE` | `update-cli.ts:20` | `@oh-my-pi/pi-coding-agent` | `@awfixerai/agent` |
| `NATIVES_PACKAGE` | `update-cli.ts:~42` | `@oh-my-pi/pi-natives` | `@awfixerai/natives` |
| `HOMEBREW_FORMULA` | `update-cli.ts:21` | `can1357/tap/omp` | `awfixer/tap/agent` (tap not published yet) |
| `MISE_TOOL` | `update-cli.ts:22` | `github:awfixers-stuff/awfixer-agent` | `github:awfixers-stuff/awfixer-agent` |
| printed reinstall hint | `update-cli.ts:618` | `curl -fsSL https://agent.awfixer.codes/install \| sh` | `https://agent-api.awfixer.codes/install` |
| `buildBunInstallArgs` `--registry=${NPM_REGISTRY}` | `update-cli.ts:~746` | pinned to `NPM_REGISTRY` | pinned to `https://agent-api.awfixer.codes/` |

## Verification done

- `bun check` (typecheck) — see session transcript.
- No tests covered these symbols prior to the change (per codegraph blast-radius report),
  so no test updates were required.

## Out of scope (intentionally NOT nulled)

- `scripts/check-spoofed-versions.ts` — drift checker for spoofed User-Agent versions
  (`google-gemini/gemini-cli`). Polls `api.github.com` for an unrelated upstream; not
  brand-tied.
- `packages/coding-agent/src/utils/tools-manager.ts` `getLatestVersion` — fetches latest
  release tag for third-party bundled tools (sd, sg, yt-dlp, trafilatura, ffmpeg). Polls
  `api.github.com` for unrelated upstream repos; not brand-tied.
- `packages/coding-agent/src/extensibility/plugins/marketplace/*` — plugin marketplace
  update checks read user-configured marketplace URLs, not a hardcoded brand domain.

If the rebrand later wants to silence **all** outbound update/version polls (including the
third-party ones above), expand the null-out to those two files in a follow-up.