package api

import (
	"net/http"
	"strings"

	"github.com/awfixerai/github-app/gateway/internal/auth"
	"github.com/awfixerai/github-app/gateway/internal/store"
)

func bearerMiddleware(st *store.Store, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		plain := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		if plain == "" {
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}

		tokens, err := st.ListActiveAPITokens(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "auth lookup failed")
			return
		}
		var matched *store.APIToken
		for i := range tokens {
			if auth.VerifyAPIToken(plain, tokens[i].TokenHash) {
				matched = &tokens[i]
				break
			}
		}
		if matched == nil {
			writeError(w, http.StatusUnauthorized, "invalid bearer token")
			return
		}
		ctx := WithToken(r.Context(), *matched)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}