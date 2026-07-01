-- prwatch v1 schema (Postgres). Applied by gateway migrate under pg_advisory_lock.

CREATE TABLE IF NOT EXISTS installations (
  id              BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL UNIQUE,
  account_login   TEXT NOT NULL,
  account_type    TEXT NOT NULL DEFAULT 'Organization',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repos (
  id               BIGSERIAL PRIMARY KEY,
  installation_id  BIGINT NOT NULL REFERENCES installations(installation_id) ON DELETE CASCADE,
  full_name        TEXT NOT NULL,
  default_branch   TEXT NOT NULL DEFAULT 'main',
  tracked          BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installation_id, full_name)
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id          BIGSERIAL PRIMARY KEY,
  repo_id     BIGINT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,
  head_sha    TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open',
  base_ref    TEXT NOT NULL DEFAULT '',
  head_ref    TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_id, number, head_sha)
);

CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_number ON pull_requests(repo_id, number);

CREATE TABLE IF NOT EXISTS review_jobs (
  id             BIGSERIAL PRIMARY KEY,
  pr_id          BIGINT NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  head_sha       TEXT NOT NULL,
  trigger_event  TEXT NOT NULL,
  delivery_id    TEXT UNIQUE,
  state          TEXT NOT NULL DEFAULT 'queued'
                 CHECK (state IN ('queued', 'running', 'done', 'failed')),
  claimed_at     TIMESTAMPTZ,
  worker_id      TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  max_attempts   INTEGER NOT NULL DEFAULT 3,
  needs_browser  BOOLEAN NOT NULL DEFAULT false,
  enqueued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ,
  last_error     TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_jobs_state_enqueued
  ON review_jobs(state, enqueued_at)
  WHERE state = 'queued';

CREATE TABLE IF NOT EXISTS findings (
  id             BIGSERIAL PRIMARY KEY,
  review_job_id  BIGINT NOT NULL REFERENCES review_jobs(id) ON DELETE CASCADE,
  path           TEXT NOT NULL,
  line           INTEGER NOT NULL,
  side           TEXT NOT NULL DEFAULT 'RIGHT',
  severity       TEXT NOT NULL DEFAULT 'info',
  category       TEXT NOT NULL DEFAULT '',
  message        TEXT NOT NULL,
  rule_id        TEXT,
  confidence     REAL
);

CREATE TABLE IF NOT EXISTS reviews (
  id                BIGSERIAL PRIMARY KEY,
  review_job_id     BIGINT NOT NULL UNIQUE REFERENCES review_jobs(id) ON DELETE CASCADE,
  github_review_id  BIGINT,
  summary           TEXT NOT NULL DEFAULT '',
  check_run_id      BIGINT,
  conclusion        TEXT
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id               BIGSERIAL PRIMARY KEY,
  token_hash       TEXT NOT NULL UNIQUE,
  label            TEXT NOT NULL DEFAULT '',
  installation_id  BIGINT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  action      TEXT NOT NULL,
  actor       TEXT NOT NULL DEFAULT 'system',
  detail      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);