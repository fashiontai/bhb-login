package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/fashiontai/bhb-login/apps/go-profile/internal/config"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/migrations"
)

func main() {
	appConfig, err := config.Load()
	if err != nil {
		slog.Error("failed to load migration configuration", "error", err)
		os.Exit(1)
	}
	if err := migrations.Run(context.Background(), appConfig.DatabaseURL); err != nil {
		slog.Error("Go profile migration failed", "error", err)
		os.Exit(1)
	}
	slog.Info("Go profile migration completed")
}
