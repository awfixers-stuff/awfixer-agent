package webhook

import "strings"

// ShouldEnqueueReview returns whether a GitHub App webhook should create a review job.
func ShouldEnqueueReview(eventType, action string) bool {
	switch eventType {
	case "pull_request":
		switch action {
		case "opened", "synchronize", "reopened", "ready_for_review":
			return true
		}
	case "pull_request_review_comment":
		if action == "created" {
			return true
		}
	}
	return false
}

// NeedsBrowserHeuristic is a v1 flag for Kernel browser opt-in (UI-touched paths).
func NeedsBrowserHeuristic(changedPaths []string) bool {
	for _, p := range changedPaths {
		lower := strings.ToLower(p)
		if strings.Contains(lower, "/ui/") ||
			strings.HasSuffix(lower, ".tsx") ||
			strings.HasSuffix(lower, ".jsx") ||
			strings.Contains(lower, "playwright") {
			return true
		}
	}
	return false
}