# Migrations

Canonical SQL for Railway Postgres lives in **`gateway/internal/migrate/migrations/`** (embedded by the Go gateway on startup).

Copy or reference those files from here if you add tooling that expects `shared/migrations/` per the design spec.