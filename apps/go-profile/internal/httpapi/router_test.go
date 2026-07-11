package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/fashiontai/bhb-login/apps/go-profile/internal/github"
	"github.com/fashiontai/bhb-login/apps/go-profile/internal/store"
)

type fakeGithubClient struct{}

func (fakeGithubClient) GetProfile(_ context.Context, username string) (github.Profile, error) {
	return github.Profile{ID: 1, Login: username, HTMLURL: "https://github.com/" + username}, nil
}

type fakeStore struct{}

func (fakeStore) GetIntroduction(_ context.Context, _, _ string) (store.Introduction, error) {
	return store.Introduction{}, store.ErrIntroductionNotFound
}

func (fakeStore) Ping(_ context.Context) error { return nil }

func (fakeStore) SaveIntroduction(_ context.Context, profile github.Profile, _, locale, content string) (store.Introduction, error) {
	return store.Introduction{Content: content, Locale: locale, Username: profile.Login}, nil
}

func TestInternalGenerateRequiresServiceToken(t *testing.T) {
	handler := New("http://localhost:3001", strings.Repeat("a", 32), fakeGithubClient{}, fakeStore{})
	request := httptest.NewRequest(http.MethodPost, "/internal/v1/introductions/generate", strings.NewReader(`{"username":"fashiontai","userId":"user-1"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestInternalGenerateAcceptsServiceToken(t *testing.T) {
	token := strings.Repeat("a", 32)
	handler := New("http://localhost:3001", token, fakeGithubClient{}, fakeStore{})
	request := httptest.NewRequest(http.MethodPost, "/internal/v1/introductions/generate", strings.NewReader(`{"username":"fashiontai","userId":"user-1","locale":"en-US"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Internal-Service-Token", token)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, response.Code, response.Body.String())
	}
}
