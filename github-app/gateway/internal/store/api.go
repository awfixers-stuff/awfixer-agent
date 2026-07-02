package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// APIToken is a verified bearer token row.
type APIToken struct {
	ID              int64
	Label           string
	InstallationID  *int64
	TokenHash       string
}

// Installation row for REST listing.
type Installation struct {
	ID              int64  `json:"id"`
	InstallationID  int64  `json:"installation_id"`
	AccountLogin    string `json:"account_login"`
	AccountType     string `json:"account_type"`
}

// Repo row for REST listing.
type Repo struct {
	ID              int64  `json:"id"`
	FullName        string `json:"full_name"`
	DefaultBranch   string `json:"default_branch"`
	Tracked         bool   `json:"tracked"`
	InstallationID  int64  `json:"installation_id"`
}

// PullRequestSummary for list/detail endpoints.
type PullRequestSummary struct {
	ID           int64     `json:"id"`
	Number       int       `json:"number"`
	HeadSHA      string    `json:"head_sha"`
	State        string    `json:"state"`
	Title        string    `json:"title"`
	Author       string    `json:"author"`
	UpdatedAt    time.Time `json:"updated_at"`
	LatestJobID  *int64    `json:"latest_job_id,omitempty"`
	LatestState  *string   `json:"latest_job_state,omitempty"`
	LatestReview *string   `json:"latest_conclusion,omitempty"`
}

// ReviewSummary for PR history.
type ReviewSummary struct {
	ID           int64     `json:"id"`
	ReviewJobID  int64     `json:"review_job_id"`
	Summary      string    `json:"summary"`
	Conclusion   *string   `json:"conclusion,omitempty"`
	EnqueuedAt   time.Time `json:"enqueued_at"`
	FinishedAt   *time.Time `json:"finished_at,omitempty"`
}

// Finding row.
type Finding struct {
	ID         int64    `json:"id"`
	Path       string   `json:"path"`
	Line       int      `json:"line"`
	Side       string   `json:"side"`
	Severity   string   `json:"severity"`
	Category   string   `json:"category"`
	Message    string   `json:"message"`
	RuleID     *string  `json:"rule_id,omitempty"`
	Confidence *float32 `json:"confidence,omitempty"`
}

// JobStatus for polling.
type JobStatus struct {
	ID           int64      `json:"id"`
	PRID         int64      `json:"pr_id"`
	HeadSHA      string     `json:"head_sha"`
	TriggerEvent string     `json:"trigger_event"`
	State        string     `json:"state"`
	Attempts     int        `json:"attempts"`
	MaxAttempts  int        `json:"max_attempts"`
	EnqueuedAt   time.Time  `json:"enqueued_at"`
	ClaimedAt    *time.Time `json:"claimed_at,omitempty"`
	FinishedAt   *time.Time `json:"finished_at,omitempty"`
	LastError    *string    `json:"last_error,omitempty"`
}

// ListActiveAPITokens returns non-revoked API tokens for bearer verification.
func (s *Store) ListActiveAPITokens(ctx context.Context) ([]APIToken, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, label, installation_id, token_hash
		FROM api_tokens
		WHERE revoked_at IS NULL`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []APIToken
	for rows.Next() {
		var tok APIToken
		if err := rows.Scan(&tok.ID, &tok.Label, &tok.InstallationID, &tok.TokenHash); err != nil {
			return nil, err
		}
		out = append(out, tok)
	}
	return out, rows.Err()
}

// InsertAPIToken stores a hashed token (tests/admin).
func (s *Store) InsertAPIToken(ctx context.Context, tokenHash, label string, installationID *int64) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO api_tokens (token_hash, label, installation_id)
		VALUES ($1, $2, $3)`,
		tokenHash, label, installationID,
	)
	return err
}

// GetInstallations lists installations, optionally scoped to one installation_id.
func (s *Store) GetInstallations(ctx context.Context, installationID *int64) ([]Installation, error) {
	var rows pgx.Rows
	var err error
	if installationID != nil {
		rows, err = s.Pool.Query(ctx, `
			SELECT id, installation_id, account_login, account_type
			FROM installations
			WHERE installation_id = $1
			ORDER BY account_login`, *installationID)
	} else {
		rows, err = s.Pool.Query(ctx, `
			SELECT id, installation_id, account_login, account_type
			FROM installations
			ORDER BY account_login`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Installation
	for rows.Next() {
		var inst Installation
		if err := rows.Scan(&inst.ID, &inst.InstallationID, &inst.AccountLogin, &inst.AccountType); err != nil {
			return nil, err
		}
		out = append(out, inst)
	}
	return out, rows.Err()
}

// ListTrackedRepos returns tracked repos for an installation.
func (s *Store) ListTrackedRepos(ctx context.Context, installationID int64) ([]Repo, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, full_name, default_branch, tracked, installation_id
		FROM repos
		WHERE installation_id = $1 AND tracked = true
		ORDER BY full_name`, installationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Repo
	for rows.Next() {
		var repo Repo
		if err := rows.Scan(&repo.ID, &repo.FullName, &repo.DefaultBranch, &repo.Tracked, &repo.InstallationID); err != nil {
			return nil, err
		}
		out = append(out, repo)
	}
	return out, rows.Err()
}

// ListOpenPRs returns open PRs with latest job/review state.
func (s *Store) ListOpenPRs(ctx context.Context, repoFullName string) ([]PullRequestSummary, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT p.id, p.number, p.head_sha, p.state, p.title, p.author, p.updated_at,
		       lj.id, lj.state, rv.conclusion
		FROM pull_requests p
		JOIN repos r ON r.id = p.repo_id
		LEFT JOIN LATERAL (
		  SELECT j.id, j.state
		  FROM review_jobs j
		  WHERE j.pr_id = p.id
		  ORDER BY j.enqueued_at DESC
		  LIMIT 1
		) lj ON true
		LEFT JOIN reviews rv ON rv.review_job_id = lj.id
		WHERE r.full_name = $1 AND p.state = 'open'
		ORDER BY p.number DESC`, repoFullName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPRSummaries(rows)
}

// GetPRWithReviews returns one PR and its review history.
func (s *Store) GetPRWithReviews(ctx context.Context, repoFullName string, number int) (*PullRequestSummary, []ReviewSummary, error) {
	var pr PullRequestSummary
	err := s.Pool.QueryRow(ctx, `
		SELECT p.id, p.number, p.head_sha, p.state, p.title, p.author, p.updated_at,
		       lj.id, lj.state, rv.conclusion
		FROM pull_requests p
		JOIN repos r ON r.id = p.repo_id
		LEFT JOIN LATERAL (
		  SELECT j.id, j.state
		  FROM review_jobs j
		  WHERE j.pr_id = p.id
		  ORDER BY j.enqueued_at DESC
		  LIMIT 1
		) lj ON true
		LEFT JOIN reviews rv ON rv.review_job_id = lj.id
		WHERE r.full_name = $1 AND p.number = $2`, repoFullName, number).Scan(
		&pr.ID, &pr.Number, &pr.HeadSHA, &pr.State, &pr.Title, &pr.Author, &pr.UpdatedAt,
		&pr.LatestJobID, &pr.LatestState, &pr.LatestReview,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT rv.id, rv.review_job_id, rv.summary, rv.conclusion, j.enqueued_at, j.finished_at
		FROM reviews rv
		JOIN review_jobs j ON j.id = rv.review_job_id
		JOIN pull_requests p ON p.id = j.pr_id
		JOIN repos r ON r.id = p.repo_id
		WHERE r.full_name = $1 AND p.number = $2
		ORDER BY j.enqueued_at DESC`, repoFullName, number)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var reviews []ReviewSummary
	for rows.Next() {
		var rv ReviewSummary
		if err := rows.Scan(&rv.ID, &rv.ReviewJobID, &rv.Summary, &rv.Conclusion, &rv.EnqueuedAt, &rv.FinishedAt); err != nil {
			return nil, nil, err
		}
		reviews = append(reviews, rv)
	}
	return &pr, reviews, rows.Err()
}

// GetReviewFindings returns findings for a review id scoped to owner/repo/number.
func (s *Store) GetReviewFindings(ctx context.Context, repoFullName string, prNumber int, reviewID int64) ([]Finding, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT f.id, f.path, f.line, f.side, f.severity, f.category, f.message, f.rule_id, f.confidence
		FROM findings f
		JOIN review_jobs j ON j.id = f.review_job_id
		JOIN reviews rv ON rv.review_job_id = j.id
		JOIN pull_requests p ON p.id = j.pr_id
		JOIN repos r ON r.id = p.repo_id
		WHERE rv.id = $1 AND r.full_name = $2 AND p.number = $3
		ORDER BY f.path, f.line`, reviewID, repoFullName, prNumber)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Finding
	for rows.Next() {
		var f Finding
		if err := rows.Scan(&f.ID, &f.Path, &f.Line, &f.Side, &f.Severity, &f.Category, &f.Message, &f.RuleID, &f.Confidence); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// GetJob returns a review job by id.
func (s *Store) GetJob(ctx context.Context, jobID int64) (*JobStatus, error) {
	var job JobStatus
	err := s.Pool.QueryRow(ctx, `
		SELECT id, pr_id, head_sha, trigger_event, state, attempts, max_attempts,
		       enqueued_at, claimed_at, finished_at, last_error
		FROM review_jobs
		WHERE id = $1`, jobID).Scan(
		&job.ID, &job.PRID, &job.HeadSHA, &job.TriggerEvent, &job.State,
		&job.Attempts, &job.MaxAttempts, &job.EnqueuedAt, &job.ClaimedAt, &job.FinishedAt, &job.LastError,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// EnqueueManualRereview enqueues a new review job for an existing PR head.
func (s *Store) EnqueueManualRereview(ctx context.Context, repoFullName string, prNumber int) (int64, error) {
	var in EnqueueInput
	err := s.Pool.QueryRow(ctx, `
		SELECT i.installation_id, i.account_login, i.account_type,
		       r.full_name, r.default_branch,
		       p.number, p.head_sha, p.state, p.base_ref, p.head_ref, p.author, p.title
		FROM pull_requests p
		JOIN repos r ON r.id = p.repo_id
		JOIN installations i ON i.installation_id = r.installation_id
		WHERE r.full_name = $1 AND p.number = $2
		ORDER BY p.updated_at DESC
		LIMIT 1`, repoFullName, prNumber).Scan(
		&in.InstallationID, &in.AccountLogin, &in.AccountType,
		&in.RepoFullName, &in.DefaultBranch,
		&in.PRNumber, &in.HeadSHA, &in.PRState, &in.BaseRef, &in.HeadRef, &in.Author, &in.Title,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	in.TriggerEvent = "api.manual_rereview"
	in.DeliveryID = fmt.Sprintf("api-%s", uuid.NewString())
	jobID, created, err := s.EnqueueReviewJob(ctx, in)
	if err != nil {
		return 0, err
	}
	if !created {
		return 0, fmt.Errorf("manual re-review not created")
	}
	return jobID, nil
}

func scanPRSummaries(rows pgx.Rows) ([]PullRequestSummary, error) {
	var out []PullRequestSummary
	for rows.Next() {
		var pr PullRequestSummary
		if err := rows.Scan(
			&pr.ID, &pr.Number, &pr.HeadSHA, &pr.State, &pr.Title, &pr.Author, &pr.UpdatedAt,
			&pr.LatestJobID, &pr.LatestState, &pr.LatestReview,
		); err != nil {
			return nil, err
		}
		out = append(out, pr)
	}
	return out, rows.Err()
}