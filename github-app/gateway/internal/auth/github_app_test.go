package auth_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/awfixerai/github-app/gateway/internal/auth"
	"github.com/golang-jwt/jwt/v5"
)

func TestGitHubApp_installationToken_cached(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})

	var requests atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.Method != http.MethodPost || r.URL.Path != "/app/installations/99/access_tokens" {
			http.Error(w, "unexpected path", http.StatusBadRequest)
			return
		}
		authz := r.Header.Get("Authorization")
		if len(authz) < 8 || authz[:7] != "Bearer " {
			http.Error(w, "missing bearer", http.StatusUnauthorized)
			return
		}
		parsed, err := jwt.Parse(authz[7:], func(token *jwt.Token) (any, error) {
			return &key.PublicKey, nil
		})
		if err != nil || !parsed.Valid {
			http.Error(w, "invalid jwt", http.StatusUnauthorized)
			return
		}
		claims, ok := parsed.Claims.(jwt.MapClaims)
		if !ok || claims["iss"] != "42" {
			http.Error(w, "bad iss", http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"token":      "inst_abc",
			"expires_at": "2030-01-01T00:00:00Z",
		})
	}))
	defer srv.Close()

	app, err := auth.NewGitHubApp(42, string(pemBytes), srv.Client())
	if err != nil {
		t.Fatal(err)
	}
	client := app.WithBaseURL(srv.URL)

	ctx := context.Background()
	tok1, err := client.InstallationToken(ctx, 99)
	if err != nil {
		t.Fatal(err)
	}
	if tok1 != "inst_abc" {
		t.Fatalf("token1=%q", tok1)
	}
	tok2, err := client.InstallationToken(ctx, 99)
	if err != nil {
		t.Fatal(err)
	}
	if tok2 != "inst_abc" {
		t.Fatalf("token2=%q", tok2)
	}
	if requests.Load() != 1 {
		t.Fatalf("expected 1 github request, got %d", requests.Load())
	}
}

func TestNewGitHubApp_parsesPEM(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
	app, err := auth.NewGitHubApp(1, string(pemBytes), nil)
	if err != nil {
		t.Fatal(err)
	}
	if app == nil {
		t.Fatal("nil app")
	}
}