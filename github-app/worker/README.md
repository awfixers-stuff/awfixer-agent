# prwatch worker

Claims `review_jobs` from Railway Postgres and runs PR reviews (`agent --mode rpc` + E2B + GitHub post).

```bash
pip install -e '.[dev]' -e ../../python/omp-rpc
pytest -x
prwatch worker
```

Set `PRWATCH_STUB_PIPELINE=true` to exercise the claim/finish loop without GitHub or agent credentials (used in `docker-compose.yml`).