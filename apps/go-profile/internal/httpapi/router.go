package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/fashiontai/bhb-login/apps/go-profile/internal/github"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/introduction"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/store"
)

var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`)

type profileClient interface {
	GetProfile(context.Context, string) (github.Profile, error)
}

type introductionStore interface {
	GetIntroduction(context.Context, string, string) (store.Introduction, error)
	Ping(context.Context) error
	SaveIntroduction(context.Context, github.Profile, string, string, string) (store.Introduction, error)
}

type Router struct {
	corsOrigin    string
	githubClient  profileClient
	internalToken string
	store         introductionStore
}

type generateRequest struct {
	Locale   string `json:"locale"`
	UserID   string `json:"userId"`
	Username string `json:"username"`
}

func New(corsOrigin, internalToken string, githubClient profileClient, dataStore introductionStore) http.Handler {
	router := &Router{corsOrigin: corsOrigin, githubClient: githubClient, internalToken: internalToken, store: dataStore}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", router.health)
	mux.HandleFunc("GET /ready", router.ready)
	mux.HandleFunc("GET /public/v1/introductions/{username}", router.getIntroduction)
	mux.HandleFunc("POST /internal/v1/introductions/generate", router.requireInternalToken(router.generateIntroduction))
	return router.withMiddleware(mux)
}

func (router *Router) health(response http.ResponseWriter, _ *http.Request) {
	writeJSON(response, http.StatusOK, map[string]string{"service": "go-profile", "status": "ok"})
}

func (router *Router) ready(response http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancel()
	if err := router.store.Ping(ctx); err != nil {
		writeError(response, http.StatusServiceUnavailable, "DATABASE_UNAVAILABLE", "Database is not ready.")
		return
	}
	writeJSON(response, http.StatusOK, map[string]string{"status": "ready"})
}

func (router *Router) getIntroduction(response http.ResponseWriter, request *http.Request) {
	username := request.PathValue("username")
	locale := normalizeLocale(request.URL.Query().Get("locale"))
	if !usernamePattern.MatchString(username) {
		writeError(response, http.StatusBadRequest, "INVALID_USERNAME", "GitHub username is invalid.")
		return
	}

	result, err := router.store.GetIntroduction(request.Context(), username, locale)
	if errors.Is(err, store.ErrIntroductionNotFound) {
		writeError(response, http.StatusNotFound, "INTRODUCTION_NOT_FOUND", "No generated introduction was found.")
		return
	}
	if err != nil {
		slog.Error("failed to load introduction", "error", err)
		writeError(response, http.StatusInternalServerError, "INTRODUCTION_LOAD_FAILED", "Failed to load introduction.")
		return
	}
	writeJSON(response, http.StatusOK, map[string]store.Introduction{"introduction": result})
}

func (router *Router) generateIntroduction(response http.ResponseWriter, request *http.Request) {
	var payload generateRequest
	decoder := json.NewDecoder(http.MaxBytesReader(response, request.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		writeError(response, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON.")
		return
	}
	payload.Username = strings.TrimSpace(payload.Username)
	payload.UserID = strings.TrimSpace(payload.UserID)
	payload.Locale = normalizeLocale(payload.Locale)
	if !usernamePattern.MatchString(payload.Username) || payload.UserID == "" {
		writeError(response, http.StatusBadRequest, "INVALID_REQUEST", "GitHub username and user ID are required.")
		return
	}

	profile, err := router.githubClient.GetProfile(request.Context(), payload.Username)
	if errors.Is(err, github.ErrProfileNotFound) {
		writeError(response, http.StatusNotFound, "GITHUB_PROFILE_NOT_FOUND", "GitHub profile was not found.")
		return
	}
	if err != nil {
		slog.Error("failed to request GitHub profile", "error", err)
		writeError(response, http.StatusBadGateway, "GITHUB_REQUEST_FAILED", "Failed to request GitHub profile.")
		return
	}

	content := introduction.Generate(profile, payload.Locale)
	result, err := router.store.SaveIntroduction(request.Context(), profile, payload.UserID, payload.Locale, content)
	if err != nil {
		slog.Error("failed to save introduction", "error", err)
		writeError(response, http.StatusInternalServerError, "INTRODUCTION_SAVE_FAILED", "Failed to save introduction.")
		return
	}
	writeJSON(response, http.StatusOK, map[string]store.Introduction{"introduction": result})
}

func (router *Router) requireInternalToken(next http.HandlerFunc) http.HandlerFunc {
	return func(response http.ResponseWriter, request *http.Request) {
		provided := request.Header.Get("X-Internal-Service-Token")
		if len(provided) != len(router.internalToken) || subtle.ConstantTimeCompare([]byte(provided), []byte(router.internalToken)) != 1 {
			writeError(response, http.StatusUnauthorized, "UNAUTHORIZED", "Internal service authentication failed.")
			return
		}
		next(response, request)
	}
}

func (router *Router) withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Access-Control-Allow-Origin", router.corsOrigin)
		response.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		response.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		response.Header().Set("Vary", "Origin")
		response.Header().Set("X-Content-Type-Options", "nosniff")
		if request.Method == http.MethodOptions {
			response.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(response, request)
	})
}

func normalizeLocale(locale string) string {
	if locale == "en-US" {
		return locale
	}
	return "zh-CN"
}

func writeError(response http.ResponseWriter, status int, code, message string) {
	writeJSON(response, status, map[string]string{"error": code, "message": message})
}

func writeJSON(response http.ResponseWriter, status int, value any) {
	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.WriteHeader(status)
	if err := json.NewEncoder(response).Encode(value); err != nil {
		slog.Error("failed to encode response", "error", err)
	}
}
