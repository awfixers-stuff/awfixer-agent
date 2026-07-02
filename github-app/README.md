# prwatch (GitHub App)

PR review + Check Runs for installed repos. **Gateway and worker run on Railway**; **untrusted PR commands run in [E2B](https://e2b.dev) sandboxes**; state lives in **Railway Postgres** (`LISTEN/NOTIFY`, no Redis in v1).

Design: [`docs/superpowers/specs/2026-06-30-github-app-design.md`](../docs/superpowers/specs/2026-06-30-github-app-design.md)  
Plan: [`docs/superpowers/plans/2026-07-01-github-app-v1.md`](../docs/superpowers/plans/2026-07-01-github-app-v1.md)

## Layout

```
github-app/
  gateway/          # Go: webhook, migrations, enqueue, REST API
  worker/           # Python prwatch: claim jobs, agent-RPC, E2B, GitHub post
  shared/           # OpenAPI + fixtures
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
cd github-app/worker
pip install -e '.[dev,omp]' -e ../../python/omp-rpc
pytest -x
```

Set `PRWATCH_STUB_PIPELINE=true` on the worker service to exercise claim/finish without GitHub or agent credentials.

### Integration smoke (webhook → queued → claimed)

With compose running:

```bash
# Sign fixture with GITHUB_WEBHOOK_SECRET=dev-secret (see gateway handler tests)
curl -X POST http://localhost:8090/webhook/github \
  -H "X-GitHub-Event: pull_request" \
  -H "X-GitHub-Delivery: smoke-$(date +%s)" \
  -H "X-Hub-Signature-256: sha256=<hmac>" \
  --data-binary @github-app/shared/fixtures/pull_request_opened.json
```

Worker logs should show `claimed review job`. Full GitHub review post requires real `GITHUB_APP_*`, model API keys, and optionally `E2B_API_KEY`.

Gated pytest smoke:

```bash
PRWATCH_INTEGRATION=1 pytest tests/test_integration_smoke.py -v
```

## Railway

1. Add **PostgreSQL** to the project; copy `DATABASE_URL` to **gateway** and **worker**.
2. **Gateway** service: root context, `github-app/Dockerfile.gateway`, public URL, health `/healthz`.
3. **Worker** service: `github-app/Dockerfile.worker`, private, `E2B_API_KEY`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `PRWATCH_MODEL` / provider keys for `agent`.
4. GitHub App webhook: `https://<gateway>/webhook/github`, secret = `GITHUB_WEBHOOK_SECRET`.

## Status

| Piece | State |
|-------|--------|
| Postgres schema + migrate | Done (gateway embed) |
| Webhook HMAC + enqueue + NOTIFY | Done |
| REST API + manual re-review | Done |
| Worker LISTEN/NOTIFY + claim loop | Done |
| Worktree materialization | Done |
| E2B `run_in_sandbox` | Done (tar sync; stub without `E2B_API_KEY`) |
| agent-RPC review + host tools | Done |
| GitHub review + Check Run post | Done (worker) |
| Kernel browser | Stub (`needs_browser` flag) |

Issue triage stays in **`python/autoawfixer`**; this app only reviews PRs.