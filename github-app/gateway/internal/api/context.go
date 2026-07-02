package api

import (
	"context"

	"github.com/awfixerai/github-app/gateway/internal/store"
)

type tokenContextKey struct{}

// WithToken stores the authenticated API token on ctx.
func WithToken(ctx context.Context, tok store.APIToken) context.Context {
	return context.WithValue(ctx, tokenContextKey{}, tok)
}

// TokenFromContext returns the authenticated API token.
func TokenFromContext(ctx context.Context) (store.APIToken, bool) {
	tok, ok := ctx.Value(tokenContextKey{}).(store.APIToken)
	return tok, ok
}