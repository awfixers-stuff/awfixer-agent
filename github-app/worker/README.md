# prwatch worker

Claims `review_jobs` from Railway Postgres and runs PR reviews (agent-RPC + E2B).

```bash
pip install -e '.[dev]'
pytest -q
prwatch worker
```