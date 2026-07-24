CREATE TABLE IF NOT EXISTS personal_introduction (
    id TEXT PRIMARY KEY,
    github_account_id TEXT NOT NULL REFERENCES github_account(id) ON DELETE CASCADE,
    generated_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    locale TEXT NOT NULL CHECK (locale IN ('zh-CN', 'en-US')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (github_account_id, locale)
);

CREATE INDEX IF NOT EXISTS personal_introduction_generated_by_user_id_idx
    ON personal_introduction(generated_by_user_id);
