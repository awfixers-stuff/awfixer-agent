package api_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/awfixerai/github-app/gateway/internal/api"
	"github.com/awfixerai/github-app/gateway/internal/auth"
	"github.com/awfixerai/github-app/gateway/internal/store"
	"github.com/awfixerai/github-app/gateway/internal/testutil"
)

func TestAPI_me_requiresAuth(t *testing.T) {
	pool := testutil.StartPostgres(t)
	st := store.New(pool)
	srv := api.NewServer(st)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d", rec.Code)
	}
}

func TestAPI_me_and_rereview(t *testing.T) {
	pool := testutil.StartPostgres(t)
	st := store.New(pool)
	ctx := context.Background()

	plain := "test-bearer-token-abc"
	hash, err := auth.HashAPIToken(plain)
	if err != nil {
		t.Fatal(err)
	}
	instID := int64(12345)
	if err := st.InsertAPIToken(ctx, hash, "test", &instID); err != nil {
		t.Fatal(err)
	}

	in := store.EnqueueInput{
		InstallationID: instID,
		AccountLogin:   "awfixerai",
		AccountType:    "Organization",
		RepoFullName:   "awfixerai/example",
		DefaultBranch:  "main",
		PRNumber:       7,
		HeadSHA:        "deadbeef",
		PRState:        "open",
		BaseRef:        "main",
		HeadRef:        "feat",
		Author:         "dev",
		Title:          "test",
		TriggerEvent:   "pull_request.opened",
		DeliveryID:     "api-test-seed",
	}
	if _, _, err := st.EnqueueReviewJob(ctx, in); err != nil {
		t.Fatal(err)
	}

	srv := api.NewServer(st)

	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+plain)
	meRec := httptest.NewRecorder()
	srv.ServeHTTP(meRec, meReq)
	if meRec.Code != http.StatusOK {
		t.Fatalf("me status=%d body=%s", meRec.Code, meRec.Body.String())
	}
	var me map[string]any
	if err := json.Unmarshal(meRec.Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if me["label"] != "test" {
		t.Fatalf("me=%v", me)
	}

	rrReq := httptest.NewRequest(http.MethodPost, "/api/v1/repos/awfixerai/example/prs/7/re-review", nil)
	rrReq.Header.Set("Authorization", "Bearer "+plain)
	rrRec := httptest.NewRecorder()
	srv.ServeHTTP(rrRec, rrReq)
	if rrRec.Code != http.StatusAccepted {
		t.Fatalf("rereview status=%d body=%s", rrRec.Code, rrRec.Body.String())
	}
	var rr map[string]any
	if err := json.Unmarshal(rrRec.Body.Bytes(), &rr); err != nil {
		t.Fatal(err)
	}
	if rr["job_id"] == nil {
		t.Fatalf("rereview=%v", rr)
	}

	var jobCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM review_jobs WHERE trigger_event = 'api.manual_rereview'`).Scan(&jobCount); err != nil {
		t.Fatal(err)
	}
	if jobCount != 1 {
		t.Fatalf("manual jobs=%d", jobCount)
	}
}