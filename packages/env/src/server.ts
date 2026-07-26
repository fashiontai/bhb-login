import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		CLOUDFLARE_PAGES_DOMAIN: z
			.string()
			.regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/)
			.default("bhb-login.pages.dev"),
		GO_PROFILE_SERVICE_URL: z.url().default("http://localhost:8080"),
		GO_PROFILE_SERVICE_NAMESPACE: z.string().min(1).default("bhb-login.local"),
		GO_INTERNAL_SERVICE_TOKEN: z.string().min(32),
		GITHUB_PROFILE_EVENTS_TOPIC_ARN: z.string().min(1).optional(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});

const primaryWebOrigin = new URL(env.CORS_ORIGIN).origin;

export const trustedWebOrigins = [
	primaryWebOrigin,
	`https://${env.CLOUDFLARE_PAGES_DOMAIN}`,
	`https://*.${env.CLOUDFLARE_PAGES_DOMAIN}`,
];

export const isAllowedWebOrigin = (origin: string): boolean => {
	if (origin === primaryWebOrigin) {
		return true;
	}

	try {
		const parsedOrigin = new URL(origin);
		const previewDomain = env.CLOUDFLARE_PAGES_DOMAIN;
		return (
			parsedOrigin.protocol === "https:" &&
			(parsedOrigin.hostname === previewDomain ||
				parsedOrigin.hostname.endsWith(`.${previewDomain}`))
		);
	} catch {
		return false;
	}
};
