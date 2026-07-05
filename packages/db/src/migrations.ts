import crypto from "node:crypto";

import { env } from "@bhb-login/env/server";
import pg from "pg";

const { Client } = pg;

const initialMigrationSql = `-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_account" (
    "id" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "profileUrl" TEXT NOT NULL,
    "bio" TEXT,
    "company" TEXT,
    "blog" TEXT,
    "location" TEXT,
    "email" TEXT,
    "publicRepos" INTEGER NOT NULL,
    "followers" INTEGER NOT NULL,
    "following" INTEGER NOT NULL,
    "githubCreatedAt" TIMESTAMP(3) NOT NULL,
    "githubUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_account_field" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_account_field_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "github_account_githubId_key" ON "github_account"("githubId");

-- CreateIndex
CREATE INDEX "github_account_login_idx" ON "github_account"("login");

-- CreateIndex
CREATE INDEX "github_account_field_accountId_idx" ON "github_account_field"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "github_account_field_accountId_key_key" ON "github_account_field"("accountId", "key");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_account_field" ADD CONSTRAINT "github_account_field_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "github_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;`;

const migrations = [
	{
		name: "20260705153000_init",
		sql: initialMigrationSql,
	},
];

interface AppliedMigrationRow {
	checksum: string;
	finished_at: Date | null;
	rolled_back_at: Date | null;
}

export interface MigrationRunResult {
	applied: string[];
	skipped: string[];
}

const createMigrationsTableSql = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
`;

const checksumFor = (sql: string) =>
	crypto.createHash("sha256").update(sql).digest("hex");

export async function runDatabaseMigrations(): Promise<MigrationRunResult> {
	const client = new Client({
		connectionString: env.DATABASE_URL,
	});
	const applied: string[] = [];
	const skipped: string[] = [];

	await client.connect();

	try {
		await client.query(createMigrationsTableSql);

		for (const migration of migrations) {
			const checksum = checksumFor(migration.sql);
			const existing = await client.query<AppliedMigrationRow>(
				`
				SELECT checksum, finished_at, rolled_back_at
				FROM "_prisma_migrations"
				WHERE migration_name = $1
				ORDER BY started_at DESC
				LIMIT 1
				`,
				[migration.name]
			);
			const latest = existing.rows[0];

			if (latest?.finished_at && !latest.rolled_back_at) {
				if (latest.checksum !== checksum) {
					throw new Error(
						`Migration ${migration.name} checksum differs from the database record.`
					);
				}
				skipped.push(migration.name);
				continue;
			}

			const id = crypto.randomUUID();
			const startedAt = new Date();

			try {
				await client.query("BEGIN");
				await client.query(migration.sql);
				await client.query(
					`
					INSERT INTO "_prisma_migrations"
						(id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
					VALUES
						($1, $2, now(), $3, NULL, NULL, $4, 1)
					`,
					[id, checksum, migration.name, startedAt]
				);
				await client.query("COMMIT");
				applied.push(migration.name);
			} catch (error) {
				await client.query("ROLLBACK");
				await client.query(
					`
					INSERT INTO "_prisma_migrations"
						(id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
					VALUES
						($1, $2, NULL, $3, $4, now(), $5, 0)
					`,
					[
						id,
						checksum,
						migration.name,
						error instanceof Error ? error.message : String(error),
						startedAt,
					]
				);
				throw error;
			}
		}
	} finally {
		await client.end();
	}

	return { applied, skipped };
}
