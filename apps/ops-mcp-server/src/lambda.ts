import { createMcpHandler } from "@modelcontextprotocol/server";
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

import { createOpsMcpServer } from "./server.js";

const mcpHandler = createMcpHandler(() => createOpsMcpServer(), {
	legacy: "stateless",
	onerror: (error) => {
		console.error("Ops MCP request failed", { message: error.message });
	},
	responseMode: "json",
});

const requestBody = (event: APIGatewayProxyEventV2): string | undefined => {
	if (!event.body) {
		return;
	}
	return event.isBase64Encoded
		? Buffer.from(event.body, "base64").toString("utf8")
		: event.body;
};

const requestUrl = (event: APIGatewayProxyEventV2): string => {
	const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
	return `https://${event.requestContext.domainName}${event.rawPath}${query}`;
};

export const handler = async (
	event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
	const body = requestBody(event);
	const request = new Request(requestUrl(event), {
		body,
		headers: new Headers(
			Object.entries(event.headers).filter(
				(entry): entry is [string, string] => typeof entry[1] === "string"
			)
		),
		method: event.requestContext.http.method,
	});
	const response = await mcpHandler.fetch(request);
	return {
		body: await response.text(),
		headers: Object.fromEntries(response.headers.entries()),
		isBase64Encoded: false,
		statusCode: response.status,
	};
};
