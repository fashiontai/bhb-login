package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
)

type Config struct {
	CloudflarePagesDomain string
	CorsOrigin            string
	DatabaseSchema        string
	DatabaseURL           string
	GitHubAPIURL          string
	InternalServiceToken  string
	PerformanceQueueURL   string
	Port                  string
}

func Load() (Config, error) {
	databaseSchema := envOrDefault("DATABASE_SCHEMA", "public")
	if !isValidDatabaseSchema(databaseSchema) {
		return Config{}, fmt.Errorf("DATABASE_SCHEMA must be public or match pr_<number>")
	}

	databaseURL, err := loadDatabaseURL(databaseSchema)
	if err != nil {
		return Config{}, err
	}

	config := Config{
		CloudflarePagesDomain: envOrDefault("CLOUDFLARE_PAGES_DOMAIN", "bhb-login.pages.dev"),
		CorsOrigin:            envOrDefault("GO_CORS_ORIGIN", "http://localhost:3001"),
		DatabaseSchema:        databaseSchema,
		DatabaseURL:           databaseURL,
		GitHubAPIURL:          envOrDefault("GITHUB_API_URL", "https://api.github.com"),
		InternalServiceToken:  os.Getenv("GO_INTERNAL_SERVICE_TOKEN"),
		PerformanceQueueURL:   os.Getenv("PERFORMANCE_EVENTS_QUEUE_URL"),
		Port:                  envOrDefault("GO_SERVER_PORT", "8080"),
	}

	if len(config.InternalServiceToken) < 32 {
		return Config{}, fmt.Errorf("GO_INTERNAL_SERVICE_TOKEN must contain at least 32 characters")
	}

	return config, nil
}

func loadDatabaseURL(databaseSchema string) (string, error) {
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		return addDatabaseSchema(databaseURL, databaseSchema)
	}

	requiredValues := map[string]string{
		"DATABASE_HOST":     os.Getenv("DATABASE_HOST"),
		"DATABASE_NAME":     os.Getenv("DATABASE_NAME"),
		"DATABASE_PASSWORD": os.Getenv("DATABASE_PASSWORD"),
		"DATABASE_USERNAME": os.Getenv("DATABASE_USERNAME"),
	}
	for key, value := range requiredValues {
		if value == "" {
			return "", fmt.Errorf("DATABASE_URL or %s is required", key)
		}
	}

	databaseURL := &url.URL{
		Scheme: "postgresql",
		User: url.UserPassword(
			requiredValues["DATABASE_USERNAME"],
			requiredValues["DATABASE_PASSWORD"],
		),
		Host: net.JoinHostPort(
			requiredValues["DATABASE_HOST"],
			envOrDefault("DATABASE_PORT", "5432"),
		),
		Path:     "/" + requiredValues["DATABASE_NAME"],
		RawQuery: "sslmode=" + url.QueryEscape(envOrDefault("DATABASE_SSL_MODE", "require")),
	}

	return addDatabaseSchema(databaseURL.String(), databaseSchema)
}

func addDatabaseSchema(databaseURL, databaseSchema string) (string, error) {
	parsedURL, err := url.Parse(databaseURL)
	if err != nil {
		return "", fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	query := parsedURL.Query()
	query.Set("search_path", databaseSchema)
	parsedURL.RawQuery = query.Encode()
	return parsedURL.String(), nil
}

func isValidDatabaseSchema(databaseSchema string) bool {
	if databaseSchema == "public" {
		return true
	}
	if len(databaseSchema) < 4 || databaseSchema[:3] != "pr_" {
		return false
	}
	for _, character := range databaseSchema[3:] {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
