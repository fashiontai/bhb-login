package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fashiontai/bhb-login/apps/go-profile/internal/config"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/github"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/httpapi"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/store"
)

func main() {
	if err := run(); err != nil {
		slog.Error("Go profile service stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	appConfig, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dataStore, err := store.New(ctx, appConfig.DatabaseURL)
	if err != nil {
		return err
	}
	defer dataStore.Close()

	server := &http.Server{
		Addr:              ":" + appConfig.Port,
		Handler:           httpapi.New(appConfig.CorsOrigin, appConfig.InternalServiceToken, github.NewClient(appConfig.GitHubAPIURL), dataStore),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		slog.Info("Go profile service started", "address", server.Addr)
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}
