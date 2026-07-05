import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	// Lambda CodeUri 只上传 dist/、不含 node_modules，
	// 故把所有第三方依赖打进产物，避免冷启动模块解析失败。
	noExternal: [/.*/],
});
