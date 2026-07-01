# prwatch (GitHub App)

PR review + Check Runs for installed repos. **Gateway and worker run on Railway**; **untrusted PR commands run in [E2B](https://e2b.dev) sandboxes**; state lives in **Railway Postgres** (`LISTEN/NOTIFY`, no Redis in v1).

Design: [`docs/superpowers/specs/2026-06-30-github-app-design.md`](../docs/superpowers/specs/2026-06-30-github-app-design.md)  
Plan: [`docs/superpowers/plans/2026-07-01-github-app-v1.md`](../docs/superpowers/plans/2026-07-01-github-app-v1.md)

## Layout

```
github-app/
  gateway/          # Go: webhook, migrations, enqueue, (API/checks TODO)
  worker/           # Python prwatch: claim jobs, omp-RPC, E2B (scaffold)
  shared/           # OpenAPI + fixtures (TODO)
  Dockerfile.gateway
  Dockerfile.worker
  docker-compose.yml
  railway.toml
```

## Local dev

```bash
cp github-app/.env.example github-app/.env
docker compose -f github-app/docker-compose.yml up --build
curl -fsS http://localhost:8090/healthz
```

Gateway tests:

```bash
cd github-app/gateway && go test ./...
```

Worker tests:

```bash
cd github-app/worker && pip install -e '.[dev]' && pytest -q
```

## Railway

1. Add **PostgreSQL** to the project; copy `DATABASE_URL` to **gateway** and **worker**.
2. **Gateway** service: root context, `github-app/Dockerfile.gateway`, public URL, health `/healthz`.
3. **Worker** service: `github-app/Dockerfile.worker`, private, `E2B_API_KEY`, model/`omp` config (extend `pi` image as in autoawfixer).
4. GitHub App webhook: `https://<gateway>/webhook/github`, secret = `GITHUB_WEBHOOK_SECRET`.

## Status (scaffold)

| Piece | State |
|-------|--------|
| Postgres schema + migrate | Done (gateway embed) |
| Webhook HMAC + enqueue + NOTIFY | Done |
| Worker claim loop | Done (no omp/GitHub yet) |
| E2B `run_in_sandbox` | Interface + stub |
| Check Runs + REST API | Planned |
| omp-RPC review persona | Planned |

Issue triage stays in **`python/autoawfixer`**; this app only reviews PRs.