package github

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Profile struct {
	AvatarURL   string    `json:"avatar_url"`
	Bio         string    `json:"bio"`
	Blog        string    `json:"blog"`
	Company     string    `json:"company"`
	CreatedAt   time.Time `json:"created_at"`
	Email       string    `json:"email"`
	Followers   int       `json:"followers"`
	Following   int       `json:"following"`
	HTMLURL     string    `json:"html_url"`
	ID          int64     `json:"id"`
	Location    string    `json:"location"`
	Login       string    `json:"login"`
	Name        string    `json:"name"`
	PublicRepos int       `json:"public_repos"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (client *Client) GetProfile(ctx context.Context, username string) (Profile, error) {
	endpoint := fmt.Sprintf("%s/users/%s", client.baseURL, url.PathEscape(username))
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Profile{}, fmt.Errorf("create GitHub request: %w", err)
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "bhb-login-go-profile")
	request.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	response, err := client.httpClient.Do(request)
	if err != nil {
		return Profile{}, fmt.Errorf("request GitHub profile: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound {
		return Profile{}, ErrProfileNotFound
	}
	if response.StatusCode != http.StatusOK {
		return Profile{}, fmt.Errorf("GitHub returned status %d", response.StatusCode)
	}

	var profile Profile
	if err := json.NewDecoder(response.Body).Decode(&profile); err != nil {
		return Profile{}, fmt.Errorf("decode GitHub profile: %w", err)
	}
	return profile, nil
}

var ErrProfileNotFound = fmt.Errorf("GitHub profile not found")
