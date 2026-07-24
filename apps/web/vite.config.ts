import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { createPreviewId } from "../../scripts/preview-id.mjs";

const cloudflareBranch = process.env.CF_PAGES_BRANCH;
if (
	!process.env.VITE_PREVIEW_ID &&
	cloudflareBranch &&
	cloudflareBranch !== "main"
) {
	process.env.VITE_PREVIEW_ID = createPreviewId(cloudflareBranch);
}

export default defineConfig({
	server: {
		port: 3001,
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		tailwindcss(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
	],
});
