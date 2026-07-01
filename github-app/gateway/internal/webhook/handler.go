package webhook

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/awfixerai/github-app/gateway/internal/store"
)

// Handler serves POST /webhook/github for the GitHub App.
type Handler struct {
	Secret string
	Store  *store.Store
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 8<<20))
	if err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}
	sig := r.Header.Get("X-Hub-Signature-256")
	if !VerifySignature(h.Secret, body, sig) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	eventType := r.Header.Get("X-GitHub-Event")
	deliveryID := r.Header.Get("X-GitHub-Delivery")
	if eventType == "ping" {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	action, _ := payload["action"].(string)
	if !ShouldEnqueueReview(eventType, action) {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	in, ok := parsePREnqueue(payload, eventType, action, deliveryID)
	if !ok {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	_, created, err := h.Store.EnqueueReviewJob(r.Context(), in)
	if err != nil {
		http.Error(w, "enqueue failed", http.StatusInternalServerError)
		return
	}
	if created {
		w.WriteHeader(http.StatusAccepted)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func parsePREnqueue(payload map[string]any, eventType, action, deliveryID string) (store.EnqueueInput, bool) {
	var out store.EnqueueInput
	out.DeliveryID = deliveryID
	out.TriggerEvent = eventType + "." + action

	inst, _ := payload["installation"].(map[string]any)
	if inst == nil {
		return out, false
	}
	instID, _ := inst["id"].(float64)
	if instID == 0 {
		return out, false
	}
	out.InstallationID = int64(instID)
	acc, _ := inst["account"].(map[string]any)
	if acc != nil {
		out.AccountLogin, _ = acc["login"].(string)
		out.AccountType, _ = acc["type"].(string)
	}

	repo, _ := payload["repository"].(map[string]any)
	if repo == nil {
		return out, false
	}
	out.RepoFullName, _ = repo["full_name"].(string)
	out.DefaultBranch, _ = repo["default_branch"].(string)
	if out.RepoFullName == "" {
		return out, false
	}

	pr, _ := payload["pull_request"].(map[string]any)
	if pr == nil {
		return out, false
	}
	if draft, _ := pr["draft"].(bool); draft {
		return out, false
	}
	num, _ := pr["number"].(float64)
	out.PRNumber = int(num)
	head, _ := pr["head"].(map[string]any)
	if head != nil {
		out.HeadSHA, _ = head["sha"].(string)
		out.HeadRef, _ = head["ref"].(string)
	}
	base, _ := pr["base"].(map[string]any)
	if base != nil {
		out.BaseRef, _ = base["ref"].(string)
	}
	out.PRState, _ = pr["state"].(string)
	out.Title, _ = pr["title"].(string)
	user, _ := pr["user"].(map[string]any)
	if user != nil {
		out.Author, _ = user["login"].(string)
	}
	if out.HeadSHA == "" || out.PRNumber == 0 {
		return out, false
	}

	_ = strconv.FormatInt(out.InstallationID, 10)
	return out, true
}