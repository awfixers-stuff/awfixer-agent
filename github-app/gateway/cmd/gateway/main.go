package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/awfixerai/github-app/gateway/internal/config"
	"github.com/awfixerai/github-app/gateway/internal/migrate"
	"github.com/awfixerai/github-app/gateway/internal/store"
	"github.com/awfixerai/github-app/gateway/internal/webhook"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if cfg.GitHubWebhookSecret == "" {
		log.Fatal("GITHUB_WEBHOOK_SECRET is required")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	if cfg.MigrateOnStart {
		if err := migrate.Up(ctx, pool); err != nil {
			log.Fatalf("migrate: %v", err)
		}
	}

	st := store.New(pool)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.Handle("/webhook/github", &webhook.Handler{Secret: cfg.GitHubWebhookSecret, Store: st})

	srv := &http.Server{Addr: cfg.BindAddr, Handler: mux}
	go func() {
		log.Printf("gateway listening on %s", cfg.BindAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}