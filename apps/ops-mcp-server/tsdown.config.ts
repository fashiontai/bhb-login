import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	entry: ["src/lambda.ts", "src/server.ts", "src/stdio.ts", "src/tools.ts"],
	format: ["esm"],
	noExternal: [/.*/],
	outDir: "dist",
	platform: "node",
});
