import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { config } from "dotenv";

import { createOpsMcpServer } from "./server.js";

config({
	path: fileURLToPath(new URL("../../../.env", import.meta.url)),
	quiet: true,
});

const server = createOpsMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
