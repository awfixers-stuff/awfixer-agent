# awfixer-agent

The agent, apps, and services that power the backend of [AWFixer LLC](https://awfixer.codes) and support the engineering team in their day-to-day work.

**Source available — not open source.** You can read and study this repository, but use is governed by the [AWFixer Source Available License](LICENSE.md) (ASL v0.4 or later), not an OSI-approved open-source license.

## What this is

A monorepo that consolidates what used to be a stack of separate tools — the Oh My Pi agent, CodeRabbit, Mergify, Sourcery AI, Semgrep, and more — into a single integrated platform:

| Surface | Role |
| --- | --- |
| **CLI** (`agent`) | Interactive coding agent and RPC backend for automation |
| **GitHub App** | PR review, check runs, and repo automation |
| **Android app** | Mobile companion for stats and control |
| **[@autoawfixer](https://github.com/autoawfixer)** | Automated GitHub account for issue triage, fixes, and follow-up |

The CLI is the core. Everything else drives or monitors it.

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

Package-level docs live in each directory's `README.md`. Development conventions are in [`AGENTS.md`](AGENTS.md).

## License

Licensed under the **AWFixer Source Available License v0.4 or later**. See [LICENSE.md](LICENSE.md) for terms, restrictions, and permitted use.