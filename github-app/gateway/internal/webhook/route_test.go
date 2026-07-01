package webhook

import "testing"

func TestShouldEnqueueReview_pullRequest(t *testing.T) {
	if !ShouldEnqueueReview("pull_request", "opened") {
		t.Fatal("opened should enqueue")
	}
	if ShouldEnqueueReview("pull_request", "closed") {
		t.Fatal("closed should not enqueue")
	}
}

func TestNeedsBrowserHeuristic_tsx(t *testing.T) {
	if !NeedsBrowserHeuristic([]string{"src/App.tsx"}) {
		t.Fatal("tsx should need browser flag")
	}
}