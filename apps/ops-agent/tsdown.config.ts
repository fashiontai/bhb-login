import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	entry: ["src/observer.ts", "src/triage.ts", "src/release.ts"],
	format: ["esm"],
	noExternal: [/.*/],
	outDir: "dist",
	platform: "node",
});
