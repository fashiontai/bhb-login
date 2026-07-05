import { createContext } from "@bhb-login/api/context";
import { appRouter } from "@bhb-login/api/routers/index";
import { auth } from "@bhb-login/auth";
import db from "@bhb-login/db";
import { runDatabaseMigrations } from "@bhb-login/db/migrations";
import { env } from "@bhb-login/env/server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";

export const app = new Hono();

const githubProfileRequestSchema = z.object({
	token: z.string().trim().min(1).max(512),
});

const githubAccountFieldRequestSchema = z.object({
	key: z.string().trim().min(1).max(64),
	value: z.string().trim().min(1).max(512),
});

const githubUserSchema = z.object({
	avatar_url: z.string().nullable(),
	bio: z.string().nullable(),
	blog: z.string().nullable(),
	company: z.string().nullable(),
	created_at: z.string(),
	email: z.string().nullable(),
	followers: z.number(),
	following: z.number(),
	html_url: z.string(),
	id: z.number(),
	location: z.string().nullable(),
	login: z.string(),
	name: z.string().nullable(),
	public_repos: z.number(),
	updated_at: z.string(),
});

const githubAccountInclude = {
	fields: {
		orderBy: {
			createdAt: "asc" as const,
		},
	},
};

const getGithubAccounts = () =>
	db.githubAccount.findMany({
		include: githubAccountInclude,
		orderBy: {
			updatedAt: "desc",
		},
	});

type GithubAccountWithFields = Awaited<
	ReturnType<typeof getGithubAccounts>
>[number];
type GithubUser = z.infer<typeof githubUserSchema>;

const getGithubUser = async (token: string): Promise<GithubUser> => {
	const response = await fetch("https://api.github.com/user", {
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"User-Agent": "bhb-login",
			"X-GitHub-Api-Version": "2026-03-10",
		},
	});

	if (response.status === 401) {
		throw new Response(
			JSON.stringify({
				error: "UNAUTHORIZED",
				message: "GitHub token is invalid or expired.",
			}),
			{ status: 401, headers: { "Content-Type": "application/json" } }
		);
	}

	if (response.status === 403) {
		throw new Response(
			JSON.stringify({
				error: "FORBIDDEN",
				message: "GitHub API rejected this token or rate limit was exceeded.",
			}),
			{ status: 403, headers: { "Content-Type": "application/json" } }
		);
	}

	if (!response.ok) {
		throw new Response(
			JSON.stringify({
				error: "GITHUB_REQUEST_FAILED",
				message: `GitHub API request failed with status ${response.status}.`,
			}),
			{ status: 502, headers: { "Content-Type": "application/json" } }
		);
	}

	const githubPayload = await response.json();
	const parsedUser = githubUserSchema.safeParse(githubPayload);

	if (!parsedUser.success) {
		throw new Response(
			JSON.stringify({
				error: "GITHUB_RESPONSE_INVALID",
				message: "GitHub API returned an unexpected profile payload.",
			}),
			{ status: 502, headers: { "Content-Type": "application/json" } }
		);
	}

	return parsedUser.data;
};

const toGithubAccountData = (user: GithubUser) => ({
	avatarUrl: user.avatar_url,
	bio: user.bio,
	blog: user.blog,
	company: user.company,
	email: user.email,
	followers: user.followers,
	following: user.following,
	githubCreatedAt: new Date(user.created_at),
	githubId: user.id,
	githubUpdatedAt: new Date(user.updated_at),
	location: user.location,
	login: user.login,
	name: user.name,
	profileUrl: user.html_url,
	publicRepos: user.public_repos,
});

const toGithubAccountResponse = (account: GithubAccountWithFields) => ({
	avatarUrl: account.avatarUrl,
	bio: account.bio,
	blog: account.blog,
	company: account.company,
	createdAt: account.createdAt.toISOString(),
	email: account.email,
	fields: account.fields.map((field) => ({
		createdAt: field.createdAt.toISOString(),
		id: field.id,
		key: field.key,
		updatedAt: field.updatedAt.toISOString(),
		value: field.value,
	})),
	followers: account.followers,
	following: account.following,
	githubCreatedAt: account.githubCreatedAt.toISOString(),
	githubId: account.githubId,
	githubUpdatedAt: account.githubUpdatedAt.toISOString(),
	id: account.id,
	location: account.location,
	login: account.login,
	name: account.name,
	profileUrl: account.profileUrl,
	publicRepos: account.publicRepos,
	updatedAt: account.updatedAt.toISOString(),
});

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => createContext({ context }),
	})
);

app.get("/", (c) => c.text("OK"));
app.get("/api/hello", (c) =>
	c.json({
		message: "Hello from Hono on AWS SAM",
		runtime: "hono",
		service: "bhb-login",
		timestamp: new Date().toISOString(),
	})
);

app.post("/api/github/profile", async (c) => {
	let payload: unknown;

	try {
		payload = await c.req.json();
	} catch {
		return c.json(
			{
				error: "INVALID_JSON",
				message: "Request body must be valid JSON.",
			},
			400
		);
	}

	const parsedRequest = githubProfileRequestSchema.safeParse(payload);
	if (!parsedRequest.success) {
		return c.json(
			{
				error: "INVALID_TOKEN",
				message: "GitHub token is required.",
			},
			400
		);
	}

	try {
		const profile = await getGithubUser(parsedRequest.data.token);
		return c.json({ profile });
	} catch (error) {
		if (error instanceof Response) {
			return error;
		}

		return c.json(
			{
				error: "GITHUB_REQUEST_FAILED",
				message: "GitHub API request failed.",
			},
			502
		);
	}
});

app.get("/api/github/accounts", async (c) => {
	try {
		const accounts = await getGithubAccounts();

		return c.json({ accounts: accounts.map(toGithubAccountResponse) });
	} catch {
		return c.json(
			{
				error: "GITHUB_ACCOUNTS_LOAD_FAILED",
				message: "Failed to load saved GitHub accounts.",
			},
			500
		);
	}
});

app.post("/api/github/accounts", async (c) => {
	let payload: unknown;

	try {
		payload = await c.req.json();
	} catch {
		return c.json(
			{
				error: "INVALID_JSON",
				message: "Request body must be valid JSON.",
			},
			400
		);
	}

	const parsedRequest = githubProfileRequestSchema.safeParse(payload);
	if (!parsedRequest.success) {
		return c.json(
			{
				error: "INVALID_TOKEN",
				message: "GitHub token is required.",
			},
			400
		);
	}

	try {
		const profile = await getGithubUser(parsedRequest.data.token);
		const accountData = toGithubAccountData(profile);
		const account = await db.githubAccount.upsert({
			create: accountData,
			include: githubAccountInclude,
			update: accountData,
			where: {
				githubId: profile.id,
			},
		});

		return c.json({ account: toGithubAccountResponse(account) });
	} catch (error) {
		if (error instanceof Response) {
			return error;
		}

		return c.json(
			{
				error: "GITHUB_ACCOUNT_SAVE_FAILED",
				message: "Failed to save GitHub account.",
			},
			500
		);
	}
});

app.delete("/api/github/accounts/:accountId", async (c) => {
	const accountId = c.req.param("accountId");

	try {
		await db.githubAccount.delete({
			where: {
				id: accountId,
			},
		});
		return c.json({ ok: true });
	} catch {
		return c.json(
			{
				error: "GITHUB_ACCOUNT_DELETE_FAILED",
				message: "Failed to delete GitHub account.",
			},
			404
		);
	}
});

app.post("/api/github/accounts/:accountId/fields", async (c) => {
	const accountId = c.req.param("accountId");
	let payload: unknown;

	try {
		payload = await c.req.json();
	} catch {
		return c.json(
			{
				error: "INVALID_JSON",
				message: "Request body must be valid JSON.",
			},
			400
		);
	}

	const parsedRequest = githubAccountFieldRequestSchema.safeParse(payload);
	if (!parsedRequest.success) {
		return c.json(
			{
				error: "INVALID_FIELD",
				message: "Field key and value are required.",
			},
			400
		);
	}

	try {
		const field = await db.githubAccountField.upsert({
			create: {
				accountId,
				key: parsedRequest.data.key,
				value: parsedRequest.data.value,
			},
			update: {
				value: parsedRequest.data.value,
			},
			where: {
				accountId_key: {
					accountId,
					key: parsedRequest.data.key,
				},
			},
		});

		return c.json({
			field: {
				createdAt: field.createdAt.toISOString(),
				id: field.id,
				key: field.key,
				updatedAt: field.updatedAt.toISOString(),
				value: field.value,
			},
		});
	} catch {
		return c.json(
			{
				error: "GITHUB_ACCOUNT_FIELD_SAVE_FAILED",
				message: "Failed to save GitHub account field.",
			},
			500
		);
	}
});

app.delete("/api/github/accounts/:accountId/fields/:fieldId", async (c) => {
	const accountId = c.req.param("accountId");
	const fieldId = c.req.param("fieldId");

	try {
		await db.githubAccountField.delete({
			where: {
				id: fieldId,
				accountId,
			},
		});
		return c.json({ ok: true });
	} catch {
		return c.json(
			{
				error: "GITHUB_ACCOUNT_FIELD_DELETE_FAILED",
				message: "Failed to delete GitHub account field.",
			},
			404
		);
	}
});

export const handler = handle(app);

export const migrationHandler = async () => {
	const result = await runDatabaseMigrations();

	return {
		ok: true,
		...result,
	};
};

if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
	const { serve } = await import("@hono/node-server");

	serve(
		{
			fetch: app.fetch,
			port: 3000,
		},
		(info) => {
			console.log(`Server is running on http://localhost:${info.port}`);
		}
	);
}
