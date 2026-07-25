import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({
	path: "../../.env",
});
dotenv.config({
	path: "../../apps/server/.env",
});

const databaseUrl =
	process.env.DATABASE_URL ||
	"postgresql://prisma:prisma@localhost:5432/prisma";

export default defineConfig({
	schema: path.join("prisma", "schema"),
	migrations: {
		path: path.join("prisma", "migrations"),
	},
	datasource: {
		url: databaseUrl,
	},
});
