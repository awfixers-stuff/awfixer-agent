package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store is the gateway's Postgres access layer.
type Store struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{Pool: pool}
}

// EnqueueReviewJob upserts installation/repo/PR and inserts a review job (dedup on delivery_id).
// Returns jobID and true when a new job was created.
func (s *Store) EnqueueReviewJob(ctx context.Context, in EnqueueInput) (jobID int64, created bool, err error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return 0, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var instRowID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO installations (installation_id, account_login, account_type, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (installation_id) DO UPDATE SET
		  account_login = EXCLUDED.account_login,
		  updated_at = now()
		RETURNING id`,
		in.InstallationID, in.AccountLogin, in.AccountType,
	).Scan(&instRowID)
	if err != nil {
		return 0, false, err
	}

	var repoRowID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO repos (installation_id, full_name, default_branch, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (installation_id, full_name) DO UPDATE SET
		  default_branch = EXCLUDED.default_branch,
		  updated_at = now()
		RETURNING id`,
		in.InstallationID, in.RepoFullName, in.DefaultBranch,
	).Scan(&repoRowID)
	if err != nil {
		return 0, false, err
	}

	var prRowID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO pull_requests (repo_id, number, head_sha, state, base_ref, head_ref, author, title, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
		ON CONFLICT (repo_id, number, head_sha) DO UPDATE SET
		  state = EXCLUDED.state,
		  title = EXCLUDED.title,
		  updated_at = now()
		RETURNING id`,
		repoRowID, in.PRNumber, in.HeadSHA, in.PRState, in.BaseRef, in.HeadRef, in.Author, in.Title,
	).Scan(&prRowID)
	if err != nil {
		return 0, false, err
	}

	var newID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO review_jobs (pr_id, head_sha, trigger_event, delivery_id, state, needs_browser)
		VALUES ($1, $2, $3, $4, 'queued', $5)
		ON CONFLICT (delivery_id) DO NOTHING
		RETURNING id`,
		prRowID, in.HeadSHA, in.TriggerEvent, in.DeliveryID, in.NeedsBrowser,
	).Scan(&newID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if err := tx.Commit(ctx); err != nil {
				return 0, false, err
			}
			return 0, false, nil
		}
		return 0, false, err
	}

	_, err = tx.Exec(ctx, `SELECT pg_notify('review_job_queued', $1)`, fmt.Sprintf("%d", newID))
	if err != nil {
		return 0, false, err
	}

	detail, _ := json.Marshal(map[string]any{"job_id": newID, "repo": in.RepoFullName, "pr": in.PRNumber})
	_, _ = tx.Exec(ctx, `INSERT INTO audit_log(action, detail) VALUES ($1, $2)`, "review_job_enqueued", detail)

	if err := tx.Commit(ctx); err != nil {
		return 0, false, err
	}
	return newID, true, nil
}

// EnqueueInput is the data required to enqueue a review from a webhook.
type EnqueueInput struct {
	InstallationID int64
	AccountLogin   string
	AccountType    string
	RepoFullName   string
	DefaultBranch  string
	PRNumber       int
	HeadSHA        string
	PRState        string
	BaseRef        string
	HeadRef        string
	Author         string
	Title          string
	TriggerEvent   string
	DeliveryID     string
	NeedsBrowser   bool
}