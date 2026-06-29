---
name: go-security
description: Security guidelines and tools for Go projects
---

# Go Security

## Purpose

Guide agents through auditing Go applications and libraries.

## Key Areas

1. **Race Conditions**: Run `go test -race`.
2. **Insecure PRNG**: Replace `math/rand` with `crypto/rand` for security tokens.
3. **Goroutine Leaks**: Ensure contexts have timeouts, channels are closed.
4. **Path Traversal**: Use `filepath.Clean` before accessing the filesystem.
5. **Unsafe Package**: Audit imports of `unsafe`.

## Tools

- `govulncheck`: `go install golang.org/x/vuln/cmd/govulncheck@latest`
- `gosec`: `gosec ./...`
