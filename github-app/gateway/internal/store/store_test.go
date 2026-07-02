package store_test

import (
	"context"
	"testing"

	"github.com/awfixerai/github-app/gateway/internal/store"
	"github.com/awfixerai/github-app/gateway/internal/testutil"
)

func TestEnqueueReviewJob_dedupDeliveryID(t *testing.T) {
	pool := testutil.StartPostgres(t)
	st := store.New(pool)
	ctx := context.Background()

	in := store.EnqueueInput{
		InstallationID: 12345,
		AccountLogin:   "awfixerai",
		AccountType:    "Organization",
		RepoFullName:   "awfixerai/example",
		DefaultBranch:  "main",
		PRNumber:       42,
		HeadSHA:        "abc123def456",
		PRState:        "open",
		BaseRef:        "main",
		HeadRef:        "feature/x",
		Author:         "contributor",
		Title:          "feat: example",
		TriggerEvent:   "pull_request.opened",
		DeliveryID:     "delivery-dedup-test-1",
	}

	jobID, created, err := st.EnqueueReviewJob(ctx, in)
	if err != nil {
		t.Fatalf("first enqueue: %v", err)
	}
	if !created || jobID <= 0 {
		t.Fatalf("first enqueue: created=%v jobID=%d", created, jobID)
	}

	jobID2, created2, err := st.EnqueueReviewJob(ctx, in)
	if err != nil {
		t.Fatalf("second enqueue: %v", err)
	}
	if created2 || jobID2 != 0 {
		t.Fatalf("second enqueue should dedup: created=%v jobID=%d", created2, jobID2)
	}

	var jobCount, instCount, repoCount, prCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM review_jobs`).Scan(&jobCount); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM installations`).Scan(&instCount); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM repos`).Scan(&repoCount); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM pull_requests`).Scan(&prCount); err != nil {
		t.Fatal(err)
	}
	if jobCount != 1 || instCount != 1 || repoCount != 1 || prCount != 1 {
		t.Fatalf("counts: jobs=%d inst=%d repos=%d prs=%d", jobCount, instCount, repoCount, prCount)
	}
}