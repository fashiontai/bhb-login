package migrations

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed 001_create_personal_introduction.sql
var initialMigration string

func Run(ctx context.Context, databaseURL string) error {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("create migration pool: %w", err)
	}
	defer pool.Close()

	if _, err := pool.Exec(ctx, initialMigration, pgx.QueryExecModeSimpleProtocol); err != nil {
		return fmt.Errorf("run Go profile migration: %w", err)
	}
	return nil
}
