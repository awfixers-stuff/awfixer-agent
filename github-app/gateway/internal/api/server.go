package api

import (
	"net/http"

	"github.com/awfixerai/github-app/gateway/internal/store"
)

// Server serves the Android REST API under /api/v1/.
type Server struct {
	store *store.Store
}

// NewServer registers API routes with bearer auth middleware.
func NewServer(st *store.Store) http.Handler {
	s := &Server{store: st}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/healthz", handleHealthz)
	mux.HandleFunc("GET /api/v1/me", s.handleMe)
	mux.HandleFunc("GET /api/v1/installations", s.handleInstallations)
	mux.HandleFunc("GET /api/v1/repos", s.handleRepos)
	mux.HandleFunc("GET /api/v1/repos/{owner}/{repo}/prs", s.handleListPRs)
	mux.HandleFunc("GET /api/v1/repos/{owner}/{repo}/prs/{number}", s.handleGetPR)
	mux.HandleFunc("GET /api/v1/repos/{owner}/{repo}/prs/{number}/reviews/{review_id}", s.handleGetReview)
	mux.HandleFunc("POST /api/v1/repos/{owner}/{repo}/prs/{number}/re-review", s.handleRereview)
	mux.HandleFunc("GET /api/v1/jobs/{id}", s.handleGetJob)
	return bearerMiddleware(st, mux)
}