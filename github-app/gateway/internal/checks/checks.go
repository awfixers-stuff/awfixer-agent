package checks

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/awfixerai/github-app/gateway/internal/auth"
)

const checkName = "prwatch"

// Reporter writes GitHub Check Runs for prwatch reviews.
type Reporter struct {
	tokens  auth.InstallationTokenSource
	baseURL string
	http    *http.Client
}

// NewReporter returns a check-run reporter using installation tokens.
func NewReporter(tokens auth.InstallationTokenSource, httpClient *http.Client) *Reporter {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Reporter{
		tokens:  tokens,
		baseURL: "https://api.github.com",
		http:    httpClient,
	}
}

// WithBaseURL overrides the GitHub API base URL (for tests).
func (r *Reporter) WithBaseURL(baseURL string) *Reporter {
	r.baseURL = strings.TrimRight(baseURL, "/")
	return r
}

// Start creates an in-progress check run on headSHA.
func (r *Reporter) Start(ctx context.Context, installationID int64, owner, repo, headSHA string) (int64, error) {
	token, err := r.tokens.InstallationToken(ctx, installationID)
	if err != nil {
		return 0, err
	}
	body := map[string]any{
		"name":     checkName,
		"head_sha": headSHA,
		"status":   "in_progress",
	}
	return r.createCheckRun(ctx, token, owner, repo, body)
}

// Complete marks a check run completed with conclusion and summary.
func (r *Reporter) Complete(ctx context.Context, installationID int64, owner, repo string, checkRunID int64, conclusion, summary string) error {
	token, err := r.tokens.InstallationToken(ctx, installationID)
	if err != nil {
		return err
	}
	body := map[string]any{
		"status":     "completed",
		"conclusion": conclusion,
		"output": map[string]any{
			"title":   checkName,
			"summary": summary,
		},
	}
	url := fmt.Sprintf("%s/repos/%s/%s/check-runs/%d", r.baseURL, owner, repo, checkRunID)
	return r.patch(ctx, token, url, body)
}

func (r *Reporter) createCheckRun(ctx context.Context, token, owner, repo string, body map[string]any) (int64, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/check-runs", r.baseURL, owner, repo)
	resBody, err := r.doJSON(ctx, http.MethodPost, token, url, body)
	if err != nil {
		return 0, err
	}
	var parsed struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(resBody, &parsed); err != nil {
		return 0, err
	}
	if parsed.ID == 0 {
		return 0, fmt.Errorf("github check run: missing id")
	}
	return parsed.ID, nil
}

func (r *Reporter) patch(ctx context.Context, token, url string, body map[string]any) error {
	_, err := r.doJSON(ctx, http.MethodPatch, token, url, body)
	return err
}

func (r *Reporter) doJSON(ctx context.Context, method, token, url string, body map[string]any) ([]byte, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	res, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	resBody, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("github check run: status %d: %s", res.StatusCode, bytes.TrimSpace(resBody))
	}
	return resBody, nil
}