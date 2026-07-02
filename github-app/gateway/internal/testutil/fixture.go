package testutil

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// PullRequestOpenedFixture returns the shared pull_request opened webhook JSON bytes.
func PullRequestOpenedFixture(t *testing.T) []byte {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	// internal/testutil/fixture.go -> github-app/shared/fixtures
	root := filepath.Join(filepath.Dir(file), "..", "..", "..", "shared", "fixtures", "pull_request_opened.json")
	data, err := os.ReadFile(root)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	return data
}