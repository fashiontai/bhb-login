import { createContext } from "@bhb-login/api/context";
import { appRouter } from "@bhb-login/api/routers/index";
import { auth } from "@bhb-login/auth";
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

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
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

	const response = await fetch("https://api.github.com/user", {
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${parsedRequest.data.token}`,
			"User-Agent": "bhb-login",
			"X-GitHub-Api-Version": "2026-03-10",
		},
	});

	if (response.status === 401) {
		return c.json(
			{
				error: "UNAUTHORIZED",
				message: "GitHub token is invalid or expired.",
			},
			401
		);
	}

	if (response.status === 403) {
		return c.json(
			{
				error: "FORBIDDEN",
				message: "GitHub API rejected this token or rate limit was exceeded.",
			},
			403
		);
	}

	if (!response.ok) {
		return c.json(
			{
				error: "GITHUB_REQUEST_FAILED",
				message: `GitHub API request failed with status ${response.status}.`,
			},
			502
		);
	}

	const githubPayload = await response.json();
	const parsedUser = githubUserSchema.safeParse(githubPayload);

	if (!parsedUser.success) {
		return c.json(
			{
				error: "GITHUB_RESPONSE_INVALID",
				message: "GitHub API returned an unexpected profile payload.",
			},
			502
		);
	}

	return c.json({ profile: parsedUser.data });
});

export const handler = handle(app);

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
