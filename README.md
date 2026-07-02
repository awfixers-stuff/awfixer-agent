# awfixer-agent

The agent, apps, and services that power the backend of [AWFixer LLC](https://awfixer.codes) and support the engineering team in their day-to-day work.

**Source available — not open source.** You can read and study this repository, but use is governed by the [AWFixer Source Available License](LICENSE.md) (ASL v0.4 or later), not an OSI-approved open-source license.

## What this is

A monorepo built around the **`agent`** coding-agent CLI.

Docs: [agent.awfixer.codes](https://agent.awfixer.codes) · Repo: [github.com/awfixers-stuff/awfixer-agent](https://github.com/awfixers-stuff/awfixer-agent)

The monorepo consolidates what used to be a stack of separate tools — the local agent, CodeRabbit, Mergify, Sourcery AI, Semgrep, and more — into a single integrated platform:

| Surface | Role |
| --- | --- |
| **CLI** (`agent`) | Interactive coding agent and RPC backend for automation |
| **GitHub App** ([prwatch](github-app/README.md)) | PR review, check runs, and repo automation |
| **Android app** ([companion](android-app/README.md)) | Mobile companion for stats and control |
| **[@autoawfixer](python/autoawfixer/README.md)** | Automated GitHub account for issue triage, fixes, and follow-up |

The CLI is the core. Everything else drives or monitors it.

## Quick start

Requires [Bun](https://bun.sh) (see root `package.json` for the pinned version).

```bash
bun install
bun run install:local
agent --version
```

`install:local` compiles the CLI and installs `agent` to `~/.local/bin` (override with `LOCAL_PREFIX`). See [scripts/install-local.ts](scripts/install-local.ts) for layout details.

Full CLI reference: [packages/coding-agent/README.md](packages/coding-agent/README.md).

## Package map

| Package | Description |
| --- | --- |
| `packages/ai` | Multi-provider LLM client with streaming support |
| `packages/catalog` | Model catalog: bundled models.json, provider descriptors, model identity/classification |
| `packages/agent` | Agent runtime with tool calling and state management |
| `packages/coding-agent` | Main CLI application (primary focus) |
| `packages/tui` | Terminal UI library with differential rendering |
| `packages/natives` | Bindings for native text/image/grep operations |
| `packages/stats` | Local observability dashboard (`agent stats`) |
| `packages/utils` | Shared utilities (logger, streams, temp files) |
| `crates/pi-natives` | Rust crate for performance-critical text/grep ops |

## Companion apps

| Path | What |
| --- | --- |
| [python/autoawfixer/](python/autoawfixer/README.md) | Self-hosted GitHub issue triage bot (`agent --mode rpc` in worktrees) |
| [github-app/](github-app/README.md) | **prwatch** — PR review + Check Runs (gateway + worker on Railway) |
| [android-app/](android-app/README.md) | Kotlin companion for `agent stats` (port 3847) |

## Contributing

Development conventions: [`AGENTS.md`](AGENTS.md). CLI internals map: [packages/coding-agent/DEVELOPMENT.md](packages/coding-agent/DEVELOPMENT.md).

```bash
bun run check           # typecheck + lint (all workspaces)
bun run test:ts         # TypeScript unit tests
bun run test:py         # Python tests (autoawfixer, omp-rpc)
bun run ci:test:android # Android companion unit tests + debug APK
```

Package-level docs live in each directory's `README.md`.

## Security

Secrets, SSH keys, and other credentials are accessed through the [1Password SDK](https://developer.1password.com/docs/sdks/) — not checked into the repo, not pasted into config files.

## Sandboxing & deployment

Untrusted code runs in isolated sandboxes via [E2B](https://e2b.dev) and [kernel.sh](https://kernel.sh). Services deploy to [Railway](https://railway.app) and [Vercel](https://vercel.com).

## Status

Continuous work in progress. The agent works on this repository — dogfooding is the default.

## Repository layout

| Path | What |
| --- | --- |
| `packages/coding-agent/` | Main CLI (`agent`) |
| `packages/agent/`, `packages/ai/`, `packages/catalog/` | Agent runtime, LLM client, model catalog |
| `github-app/` | GitHub App gateway and review workers |
| `android-app/` | Android companion |
| `python/autoawfixer/` | @autoawfixer bot and orchestration |
| `packages/agent-api/` | Update API and docs site (Vercel) |
| `infra/` | Self-hosted CI (Kata microVMs) |

## License

Licensed under the **AWFixer Source Available License v0.4 or later**. See [LICENSE.md](LICENSE.md) for terms, restrictions, and permitted use.