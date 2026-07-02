# npm scope rebrand: `@oh-my-pi/*` → `@awfixerai/*`

Phase 3 of `REBRANDING.md` (completed in this fork).

## Published packages

All workspace packages now publish under `@awfixerai/*`:

| New name | Former name |
| --- | --- |
| `@awfixerai/utils` | `@oh-my-pi/pi-utils` |
| `@awfixerai/wire` | `@oh-my-pi/pi-wire` |
| `@awfixerai/catalog` | `@oh-my-pi/pi-catalog` |
| `@awfixerai/natives` | `@oh-my-pi/pi-natives` |
| `@awfixerai/tui` | `@oh-my-pi/pi-tui` |
| `@awfixerai/ai` | `@oh-my-pi/pi-ai` |
| `@awfixerai/agent-core` | `@oh-my-pi/pi-agent-core` |
| `@awfixerai/agent` | `@oh-my-pi/pi-coding-agent` |

Sibling packages (`hashline`, `omp-stats`, `snapcompact`, `pi-mnemopi`, `collab-web`, …) follow the same scope.

## Legacy `@oh-my-pi` compatibility

**Extension loader (Phase 5, partial):** `legacy-pi-compat.ts` keeps resolving `@oh-my-pi/*` (and `@mariozechner/*`, `@earendil-works/*`) plugin imports onto the in-process `@awfixerai/*` bundles. No plugin code changes are required for the transition window.

**npm metapackage redirects (planned):** After the first `@awfixerai/*` publish, upstream `@oh-my-pi/*` package names on npm may be republished as thin redirect metapackages (`dependencies` → `@awfixerai/<same-name>`) so `bun add @oh-my-pi/pi-coding-agent` keeps working. Not shipped in this phase — track in Phase 5.

## Local monorepo install (pre-publish)

Until `@awfixerai/*` is published to npm, root `package.json` `overrides` pin every workspace package to `workspace:*` so `catalog:` resolutions do not 404 against the registry. Remove or narrow these overrides after the first `@awfixerai` publish if npm tarballs should satisfy `catalog:` again.

## Update checker repoint

Self-update polling is still disabled pending publish; repoint targets are documented in `update-checker-domains.md` (`@awfixerai/agent`, `awfixers-stuff/awfixer-agent`).