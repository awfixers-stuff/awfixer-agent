package webhook_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/awfixerai/github-app/gateway/internal/store"
	"github.com/awfixerai/github-app/gateway/internal/testutil"
	"github.com/awfixerai/github-app/gateway/internal/webhook"
)

func TestHandler_pullRequestOpened_validHMAC_returns202(t *testing.T) {
	pool := testutil.StartPostgres(t)
	st := store.New(pool)
	body := testutil.PullRequestOpenedFixture(t)
	secret := "test-secret"
	deliveryID := "handler-it-delivery-1"

	req := httptest.NewRequest(http.MethodPost, "/webhook/github", bytes.NewReader(body))
	req.Header.Set("X-GitHub-Event", "pull_request")
	req.Header.Set("X-GitHub-Delivery", deliveryID)
	req.Header.Set("X-Hub-Signature-256", webhook.SignBody(secret, body))

	rec := httptest.NewRecorder()
	h := &webhook.Handler{Secret: secret, Store: st}
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}

	var jobCount int
	err := pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM review_jobs WHERE delivery_id = $1`, deliveryID,
	).Scan(&jobCount)
	if err != nil {
		t.Fatal(err)
	}
	if jobCount != 1 {
		t.Fatalf("expected 1 job, got %d", jobCount)
	}
}

func TestHandler_pullRequestOpened_duplicateDelivery_dedups(t *testing.T) {
	pool := testutil.StartPostgres(t)
	st := store.New(pool)
	body := testutil.PullRequestOpenedFixture(t)
	secret := "test-secret"
	deliveryID := "handler-it-delivery-dedup"

	h := &webhook.Handler{Secret: secret, Store: st}
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/webhook/github", bytes.NewReader(body))
		req.Header.Set("X-GitHub-Event", "pull_request")
		req.Header.Set("X-GitHub-Delivery", deliveryID)
		req.Header.Set("X-Hub-Signature-256", webhook.SignBody(secret, body))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusAccepted {
			t.Fatalf("request %d: status=%d", i+1, rec.Code)
		}
	}

	var jobCount int
	if err := pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM review_jobs WHERE delivery_id = $1`, deliveryID,
	).Scan(&jobCount); err != nil {
		t.Fatal(err)
	}
	if jobCount != 1 {
		t.Fatalf("expected 1 job after duplicate delivery, got %d", jobCount)
	}
}