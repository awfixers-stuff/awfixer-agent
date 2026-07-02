package auth

import (
	"bytes"
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// InstallationTokenSource mints cached GitHub App installation access tokens.
type InstallationTokenSource interface {
	InstallationToken(ctx context.Context, installationID int64) (string, error)
}

type cachedInstallationToken struct {
	token     string
	expiresAt time.Time
}

// GitHubApp authenticates as a GitHub App and caches installation tokens.
type GitHubApp struct {
	appID      int64
	privateKey *rsa.PrivateKey
	baseURL    string
	httpClient *http.Client

	mu    sync.Mutex
	cache map[int64]cachedInstallationToken
}

// NewGitHubApp parses the PEM private key and returns an auth client.
func NewGitHubApp(appID int64, privateKeyPEM string, httpClient *http.Client) (*GitHubApp, error) {
	key, err := parseRSAPrivateKey(privateKeyPEM)
	if err != nil {
		return nil, err
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &GitHubApp{
		appID:      appID,
		privateKey: key,
		baseURL:    "https://api.github.com",
		httpClient: httpClient,
		cache:      make(map[int64]cachedInstallationToken),
	}, nil
}

// WithBaseURL overrides the GitHub API base URL (for tests).
func (g *GitHubApp) WithBaseURL(baseURL string) *GitHubApp {
	g.baseURL = strings.TrimRight(baseURL, "/")
	return g
}

func parseRSAPrivateKey(pemBody string) (*rsa.PrivateKey, error) {
	pemBody = strings.ReplaceAll(pemBody, `\n`, "\n")
	block, _ := pem.Decode([]byte(pemBody))
	if block == nil {
		return nil, fmt.Errorf("invalid PEM private key")
	}
	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err == nil {
		return key, nil
	}
	parsed, err2 := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err2 != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}
	rsaKey, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is not RSA")
	}
	return rsaKey, nil
}

func (g *GitHubApp) InstallationToken(ctx context.Context, installationID int64) (string, error) {
	g.mu.Lock()
	if entry, ok := g.cache[installationID]; ok && time.Now().Before(entry.expiresAt) {
		g.mu.Unlock()
		return entry.token, nil
	}
	g.mu.Unlock()

	token, expiresAt, err := g.fetchInstallationToken(ctx, installationID)
	if err != nil {
		return "", err
	}

	g.mu.Lock()
	g.cache[installationID] = cachedInstallationToken{token: token, expiresAt: expiresAt}
	g.mu.Unlock()
	return token, nil
}

func (g *GitHubApp) fetchInstallationToken(ctx context.Context, installationID int64) (string, time.Time, error) {
	jwt, err := g.mintJWT()
	if err != nil {
		return "", time.Time{}, err
	}

	url := fmt.Sprintf("%s/app/installations/%d/access_tokens", g.baseURL, installationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, http.NoBody)
	if err != nil {
		return "", time.Time{}, err
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("Accept", "application/vnd.github+json")

	res, err := g.httpClient.Do(req)
	if err != nil {
		return "", time.Time{}, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return "", time.Time{}, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", time.Time{}, fmt.Errorf("github installation token: status %d: %s", res.StatusCode, bytes.TrimSpace(body))
	}

	var parsed struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", time.Time{}, err
	}
	if parsed.Token == "" {
		return "", time.Time{}, fmt.Errorf("github installation token: empty token")
	}
	expiresAt := parsed.ExpiresAt.Add(-5 * time.Minute)
	if expiresAt.Before(time.Now()) {
		expiresAt = time.Now().Add(30 * time.Minute)
	}
	return parsed.Token, expiresAt, nil
}

func (g *GitHubApp) mintJWT() (string, error) {
	now := time.Now()
	claims := jwt.RegisteredClaims{
		Issuer:    fmt.Sprintf("%d", g.appID),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(9 * time.Minute)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(g.privateKey)
}