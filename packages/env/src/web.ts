import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		VITE_SERVER_URL: z.url(),
		VITE_GO_PROFILE_URL: z.url(),
		VITE_PREVIEW_ID: z
			.string()
			.regex(/^pr-[a-z0-9-]+-[a-f0-9]{8}$/)
			.optional(),
	},
	runtimeEnv: (
		import.meta as ImportMeta & {
			env: Record<string, string | undefined>;
		}
	).env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
