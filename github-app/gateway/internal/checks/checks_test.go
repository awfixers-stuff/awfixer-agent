package checks_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/awfixerai/github-app/gateway/internal/checks"
)

type fakeTokens struct {
	token string
}

func (f fakeTokens) InstallationToken(context.Context, int64) (string, error) {
	return f.token, nil
}

func TestReporter_startAndComplete_prwatch(t *testing.T) {
	var posts atomic.Int32
	var patches atomic.Int32
	var lastPatch map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		switch {
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/check-runs"):
			posts.Add(1)
			var req map[string]any
			if err := json.Unmarshal(body, &req); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			if req["name"] != "prwatch" {
				http.Error(w, "bad name", http.StatusBadRequest)
				return
			}
			if req["status"] != "in_progress" {
				http.Error(w, "bad status", http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"id": 9001})
		case r.Method == http.MethodPatch && strings.Contains(r.URL.Path, "/check-runs/9001"):
			patches.Add(1)
			if err := json.Unmarshal(body, &lastPatch); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusOK)
		default:
			http.Error(w, "unexpected", http.StatusBadRequest)
		}
	}))
	defer srv.Close()

	reporter := checks.NewReporter(fakeTokens{token: "tok"}, srv.Client()).WithBaseURL(srv.URL)
	ctx := context.Background()

	id, err := reporter.Start(ctx, 1, "awfixerai", "example", "sha1")
	if err != nil {
		t.Fatal(err)
	}
	if id != 9001 {
		t.Fatalf("id=%d", id)
	}
	if err := reporter.Complete(ctx, 1, "awfixerai", "example", id, "success", "all good"); err != nil {
		t.Fatal(err)
	}
	if posts.Load() != 1 || patches.Load() != 1 {
		t.Fatalf("posts=%d patches=%d", posts.Load(), patches.Load())
	}
	if lastPatch["status"] != "completed" || lastPatch["conclusion"] != "success" {
		t.Fatalf("patch=%v", lastPatch)
	}
}