import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

import { createOpsMcpServer } from "./server.js";

const server = createOpsMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
