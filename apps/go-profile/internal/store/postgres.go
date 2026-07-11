package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/fashiontai/bhb-login/apps/go-profile/internal/github"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Introduction struct {
	AvatarURL   string    `json:"avatarUrl"`
	Content     string    `json:"content"`
	GeneratedAt time.Time `json:"generatedAt"`
	Locale      string    `json:"locale"`
	Name        string    `json:"name"`
	ProfileURL  string    `json:"profileUrl"`
	Username    string    `json:"username"`
}

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create database pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (store *Store) Close() {
	store.pool.Close()
}

func (store *Store) Ping(ctx context.Context) error {
	return store.pool.Ping(ctx)
}

func (store *Store) SaveIntroduction(ctx context.Context, profile github.Profile, userID, locale, content string) (Introduction, error) {
	tx, err := store.pool.Begin(ctx)
	if err != nil {
		return Introduction{}, fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	accountID, err := randomID()
	if err != nil {
		return Introduction{}, err
	}
	var storedAccountID string
	err = tx.QueryRow(ctx, `
		INSERT INTO github_account (
			id, "githubId", login, name, "avatarUrl", "profileUrl", bio, company, blog,
			location, email, "publicRepos", followers, following, "githubCreatedAt",
			"githubUpdatedAt", "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''),
			NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''), $12, $13, $14, $15, $16, NOW(), NOW())
		ON CONFLICT ("githubId") DO UPDATE SET
			login = EXCLUDED.login,
			name = EXCLUDED.name,
			"avatarUrl" = EXCLUDED."avatarUrl",
			"profileUrl" = EXCLUDED."profileUrl",
			bio = EXCLUDED.bio,
			company = EXCLUDED.company,
			blog = EXCLUDED.blog,
			location = EXCLUDED.location,
			email = EXCLUDED.email,
			"publicRepos" = EXCLUDED."publicRepos",
			followers = EXCLUDED.followers,
			following = EXCLUDED.following,
			"githubUpdatedAt" = EXCLUDED."githubUpdatedAt",
			"updatedAt" = NOW()
		RETURNING id`,
		accountID, profile.ID, profile.Login, profile.Name, profile.AvatarURL, profile.HTMLURL,
		profile.Bio, profile.Company, profile.Blog, profile.Location, profile.Email,
		profile.PublicRepos, profile.Followers, profile.Following, profile.CreatedAt, profile.UpdatedAt,
	).Scan(&storedAccountID)
	if err != nil {
		return Introduction{}, fmt.Errorf("upsert GitHub account: %w", err)
	}

	introductionID, err := randomID()
	if err != nil {
		return Introduction{}, err
	}
	var generatedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO personal_introduction (id, github_account_id, generated_by_user_id, locale, content)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (github_account_id, locale) DO UPDATE SET
			generated_by_user_id = EXCLUDED.generated_by_user_id,
			content = EXCLUDED.content,
			updated_at = NOW()
		RETURNING updated_at`, introductionID, storedAccountID, userID, locale, content,
	).Scan(&generatedAt)
	if err != nil {
		return Introduction{}, fmt.Errorf("upsert introduction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Introduction{}, fmt.Errorf("commit transaction: %w", err)
	}

	return Introduction{AvatarURL: profile.AvatarURL, Content: content, GeneratedAt: generatedAt, Locale: locale, Name: profile.Name, ProfileURL: profile.HTMLURL, Username: profile.Login}, nil
}

func (store *Store) GetIntroduction(ctx context.Context, username, locale string) (Introduction, error) {
	var introduction Introduction
	err := store.pool.QueryRow(ctx, `
		SELECT COALESCE(account."avatarUrl", ''), intro.content, intro.updated_at, intro.locale,
			COALESCE(account.name, ''), account."profileUrl", account.login
		FROM personal_introduction AS intro
		JOIN github_account AS account ON account.id = intro.github_account_id
		WHERE LOWER(account.login) = LOWER($1) AND intro.locale = $2`, username, locale,
	).Scan(&introduction.AvatarURL, &introduction.Content, &introduction.GeneratedAt, &introduction.Locale, &introduction.Name, &introduction.ProfileURL, &introduction.Username)
	if errors.Is(err, pgx.ErrNoRows) {
		return Introduction{}, ErrIntroductionNotFound
	}
	if err != nil {
		return Introduction{}, fmt.Errorf("get introduction: %w", err)
	}
	return introduction, nil
}

func randomID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

var ErrIntroductionNotFound = errors.New("introduction not found")
