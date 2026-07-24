package config

import (
	"net/url"
	"testing"
)

const testInternalToken = "0123456789abcdef0123456789abcdef"

func TestLoadUsesDatabaseURLWhenProvided(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgresql://local:password@localhost:5432/bhblogin")
	t.Setenv("GO_INTERNAL_SERVICE_TOKEN", testInternalToken)

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load() returned an error: %v", err)
	}
	parsed, err := url.Parse(loaded.DatabaseURL)
	if err != nil {
		t.Fatalf("database URL could not be parsed: %v", err)
	}
	if parsed.Query().Get("search_path") != "public" {
		t.Fatalf("unexpected database URL: %s", loaded.DatabaseURL)
	}
}

func TestLoadBuildsDatabaseURLFromECSVariables(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DATABASE_HOST", "database.internal")
	t.Setenv("DATABASE_NAME", "bhblogin")
	t.Setenv("DATABASE_PASSWORD", "p@ss/word")
	t.Setenv("DATABASE_PORT", "5432")
	t.Setenv("DATABASE_SSL_MODE", "require")
	t.Setenv("DATABASE_USERNAME", "bhbadmin")
	t.Setenv("GO_INTERNAL_SERVICE_TOKEN", testInternalToken)

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load() returned an error: %v", err)
	}
	parsed, err := url.Parse(loaded.DatabaseURL)
	if err != nil {
		t.Fatalf("database URL could not be parsed: %v", err)
	}
	if parsed.Host != "database.internal:5432" || parsed.Path != "/bhblogin" {
		t.Fatalf("unexpected database URL: %s", loaded.DatabaseURL)
	}
	if password, _ := parsed.User.Password(); parsed.User.Username() != "bhbadmin" || password != "p@ss/word" {
		t.Fatalf("database credentials were not encoded correctly: %s", loaded.DatabaseURL)
	}
	if parsed.Query().Get("sslmode") != "require" {
		t.Fatalf("unexpected sslmode: %s", parsed.Query().Get("sslmode"))
	}
	if parsed.Query().Get("search_path") != "public" {
		t.Fatalf("unexpected search_path: %s", parsed.Query().Get("search_path"))
	}
}

func TestLoadAddsPullRequestSchemaToDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgresql://local:password@localhost:5432/bhblogin?sslmode=require")
	t.Setenv("DATABASE_SCHEMA", "pr_42")
	t.Setenv("GO_INTERNAL_SERVICE_TOKEN", testInternalToken)

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load() returned an error: %v", err)
	}
	parsed, err := url.Parse(loaded.DatabaseURL)
	if err != nil {
		t.Fatalf("database URL could not be parsed: %v", err)
	}
	if loaded.DatabaseSchema != "pr_42" || parsed.Query().Get("search_path") != "pr_42" {
		t.Fatalf("unexpected PR database configuration: %#v", loaded)
	}
}

func TestLoadRejectsUnsafeDatabaseSchema(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgresql://local:password@localhost:5432/bhblogin")
	t.Setenv("DATABASE_SCHEMA", "pr_42;drop schema public")
	t.Setenv("GO_INTERNAL_SERVICE_TOKEN", testInternalToken)

	if _, err := Load(); err == nil {
		t.Fatal("Load() accepted an unsafe database schema")
	}
}
