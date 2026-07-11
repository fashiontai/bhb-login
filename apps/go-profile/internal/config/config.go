package config

import (
	"fmt"
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
	config := Config{
		CorsOrigin:           envOrDefault("GO_CORS_ORIGIN", "http://localhost:3001"),
		DatabaseURL:          os.Getenv("DATABASE_URL"),
		GitHubAPIURL:         envOrDefault("GITHUB_API_URL", "https://api.github.com"),
		InternalServiceToken: os.Getenv("GO_INTERNAL_SERVICE_TOKEN"),
		Port:                 envOrDefault("GO_SERVER_PORT", "8080"),
	}

	if config.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if len(config.InternalServiceToken) < 32 {
		return Config{}, fmt.Errorf("GO_INTERNAL_SERVICE_TOKEN must contain at least 32 characters")
	}

	return config, nil
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
