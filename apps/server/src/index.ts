import { createContext } from "@bhb-login/api/context";
import { appRouter } from "@bhb-login/api/routers/index";
import { auth } from "@bhb-login/auth";
import { env } from "@bhb-login/env/server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const app = new Hono();

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
