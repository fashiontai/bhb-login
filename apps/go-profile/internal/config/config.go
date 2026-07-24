package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
)

type Config struct {
	CorsOrigin           string
	DatabaseURL          string
	GitHubAPIURL         string
	InternalServiceToken string
	Port                 string
}

func Load() (Config, error) {
	databaseURL, err := loadDatabaseURL()
	if err != nil {
		return Config{}, err
	}

	config := Config{
		CorsOrigin:           envOrDefault("GO_CORS_ORIGIN", "http://localhost:3001"),
		DatabaseURL:          databaseURL,
		GitHubAPIURL:         envOrDefault("GITHUB_API_URL", "https://api.github.com"),
		InternalServiceToken: os.Getenv("GO_INTERNAL_SERVICE_TOKEN"),
		Port:                 envOrDefault("GO_SERVER_PORT", "8080"),
	}

	if len(config.InternalServiceToken) < 32 {
		return Config{}, fmt.Errorf("GO_INTERNAL_SERVICE_TOKEN must contain at least 32 characters")
	}

	return config, nil
}

func loadDatabaseURL() (string, error) {
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		return databaseURL, nil
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

	return databaseURL.String(), nil
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
