package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/config"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/github"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/httpapi"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/migrations"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/performance"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/store"
)

func main() {
	var err error
	if len(os.Args) > 1 {
		err = runCommand(os.Args[1])
	} else {
		err = run()
	}
	if err != nil {
		slog.Error("Go profile service stopped", "error", err)
		os.Exit(1)
	}
}

func runCommand(command string) error {
	appConfig, err := config.Load()
	if err != nil {
		return err
	}

	switch command {
	case "migrate":
		return migrations.Run(context.Background(), appConfig.DatabaseURL, appConfig.DatabaseSchema)
	case "drop-schema":
		return migrations.DropSchema(context.Background(), appConfig.DatabaseURL, appConfig.DatabaseSchema)
	case "processor":
		return runProcessor(appConfig)
	default:
		return fmt.Errorf("unknown command %q", command)
	}
}

func runProcessor(appConfig config.Config) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dataStore, err := store.New(ctx, appConfig.DatabaseURL)
	if err != nil {
		return err
	}
	defer dataStore.Close()

	awsConfig, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		return fmt.Errorf("load AWS configuration: %w", err)
	}
	processor := performance.NewProcessor(sqs.NewFromConfig(awsConfig), appConfig.PerformanceQueueURL, dataStore)
	return processor.Run(ctx)
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
		Handler:           httpapi.New(appConfig.CorsOrigin, appConfig.CloudflarePagesDomain, appConfig.InternalServiceToken, github.NewClient(appConfig.GitHubAPIURL), dataStore),
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
