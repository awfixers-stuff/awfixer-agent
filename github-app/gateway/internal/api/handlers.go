package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	tok, ok := TokenFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":               tok.ID,
		"label":            tok.Label,
		"installation_id":  tok.InstallationID,
	})
}

func (s *Server) handleInstallations(w http.ResponseWriter, r *http.Request) {
	tok, ok := TokenFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	insts, err := s.store.GetInstallations(r.Context(), tok.InstallationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list installations failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"installations": insts})
}

func (s *Server) handleRepos(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("installation")
	if raw == "" {
		writeError(w, http.StatusBadRequest, "installation query required")
		return
	}
	installationID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid installation")
		return
	}
	if tok, ok := TokenFromContext(r.Context()); ok && tok.InstallationID != nil && *tok.InstallationID != installationID {
		writeError(w, http.StatusForbidden, "installation not allowed")
		return
	}
	repos, err := s.store.ListTrackedRepos(r.Context(), installationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list repos failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"repos": repos})
}

func (s *Server) handleListPRs(w http.ResponseWriter, r *http.Request) {
	owner := r.PathValue("owner")
	repo := r.PathValue("repo")
	fullName := owner + "/" + repo
	prs, err := s.store.ListOpenPRs(r.Context(), fullName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list prs failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"pull_requests": prs})
}

func (s *Server) handleGetPR(w http.ResponseWriter, r *http.Request) {
	owner := r.PathValue("owner")
	repo := r.PathValue("repo")
	number, err := strconv.Atoi(r.PathValue("number"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid pr number")
		return
	}
	pr, reviews, err := s.store.GetPRWithReviews(r.Context(), owner+"/"+repo, number)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "get pr failed")
		return
	}
	if pr == nil {
		writeError(w, http.StatusNotFound, "pull request not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"pull_request": pr,
		"reviews":      reviews,
	})
}

func (s *Server) handleGetReview(w http.ResponseWriter, r *http.Request) {
	owner := r.PathValue("owner")
	repo := r.PathValue("repo")
	number, err := strconv.Atoi(r.PathValue("number"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid pr number")
		return
	}
	reviewID, err := strconv.ParseInt(r.PathValue("review_id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid review id")
		return
	}
	findings, err := s.store.GetReviewFindings(r.Context(), owner+"/"+repo, number, reviewID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "get findings failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"findings": findings})
}

func (s *Server) handleRereview(w http.ResponseWriter, r *http.Request) {
	owner := r.PathValue("owner")
	repo := r.PathValue("repo")
	number, err := strconv.Atoi(r.PathValue("number"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid pr number")
		return
	}
	jobID, err := s.store.EnqueueManualRereview(r.Context(), owner+"/"+repo, number)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "enqueue failed")
		return
	}
	if jobID == 0 {
		writeError(w, http.StatusNotFound, "pull request not found")
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]int64{"job_id": jobID})
}

func (s *Server) handleGetJob(w http.ResponseWriter, r *http.Request) {
	jobID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return
	}
	job, err := s.store.GetJob(r.Context(), jobID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "get job failed")
		return
	}
	if job == nil {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": strings.TrimSpace(msg)})
}