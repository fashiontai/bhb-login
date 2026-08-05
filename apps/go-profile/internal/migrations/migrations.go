package migrations

import (
	"context"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5"
)

//go:embed 001_create_personal_introduction.sql 002_create_performance_events.sql
var migrationFiles embed.FS

func Run(ctx context.Context, databaseURL, databaseSchema string) error {
	connection, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("connect for migration: %w", err)
	}
	defer func() { _ = connection.Close(ctx) }()

	if databaseSchema != "public" {
		quotedSchema := pgx.Identifier{databaseSchema}.Sanitize()
		if _, err := connection.Exec(ctx, "CREATE SCHEMA IF NOT EXISTS "+quotedSchema); err != nil {
			return fmt.Errorf("create preview schema: %w", err)
		}
		if _, err := connection.Exec(ctx, "SET search_path TO "+quotedSchema+", public"); err != nil {
			return fmt.Errorf("select preview schema: %w", err)
		}
		if _, err := connection.Exec(ctx, "CREATE TABLE IF NOT EXISTS github_account (LIKE public.github_account INCLUDING ALL)"); err != nil {
			return fmt.Errorf("create preview GitHub account table: %w", err)
		}
	}

	for _, filename := range []string{"001_create_personal_introduction.sql", "002_create_performance_events.sql"} {
		migration, err := migrationFiles.ReadFile(filename)
		if err != nil {
			return fmt.Errorf("read Go profile migration %s: %w", filename, err)
		}
		if _, err := connection.Exec(ctx, string(migration), pgx.QueryExecModeSimpleProtocol); err != nil {
			return fmt.Errorf("run Go profile migration %s: %w", filename, err)
		}
	}
	return nil
}

func DropSchema(ctx context.Context, databaseURL, databaseSchema string) error {
	if databaseSchema == "public" {
		return fmt.Errorf("refusing to drop the public schema")
	}
	connection, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("connect for schema cleanup: %w", err)
	}
	defer func() { _ = connection.Close(ctx) }()

	quotedSchema := pgx.Identifier{databaseSchema}.Sanitize()
	if _, err := connection.Exec(ctx, "DROP SCHEMA IF EXISTS "+quotedSchema+" CASCADE"); err != nil {
		return fmt.Errorf("drop preview schema: %w", err)
	}
	return nil
}
