package config

import (
	"os"
	"strconv"
)

// Env holds gateway configuration from the environment (Railway injects DATABASE_URL, etc.).
type Env struct {
	BindAddr            string
	DatabaseURL         string
	GitHubWebhookSecret string
	GitHubAppID         int64
	GitHubAppPrivateKey string
	MigrateOnStart      bool
}

func Load() Env {
	appID, _ := strconv.ParseInt(os.Getenv("GITHUB_APP_ID"), 10, 64)
	migrate := os.Getenv("PRWATCH_MIGRATE_ON_START") != "false"
	return Env{
		BindAddr:            getenv("PRWATCH_BIND_ADDR", ":8080"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		GitHubWebhookSecret: os.Getenv("GITHUB_WEBHOOK_SECRET"),
		GitHubAppID:         appID,
		GitHubAppPrivateKey: os.Getenv("GITHUB_APP_PRIVATE_KEY"),
		MigrateOnStart:      migrate,
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}