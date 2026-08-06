import assert from "node:assert/strict";
import test from "node:test";

process.env.OPS_API_FUNCTION_NAME = "bhb-login-api";
process.env.OPS_DATABASE_CLUSTER_IDENTIFIER = "bhb-login-database";
process.env.OPS_ECS_CLUSTER_NAME = "bhb-login-go-profile";
process.env.OPS_ECS_SERVICE_NAME = "bhb-login-go-profile";
process.env.OPS_GITHUB_EVENTS_DLQ_URL =
	"https://sqs.ap-northeast-1.amazonaws.com/123456789012/events-dlq";
process.env.OPS_GITHUB_EVENTS_QUEUE_URL =
	"https://sqs.ap-northeast-1.amazonaws.com/123456789012/events";
process.env.OPS_GO_TARGET_GROUP_ARN =
	"arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:targetgroup/test/123";

const { handler } = await import("../dist/lambda.mjs");
const serverNamePattern = /bhb-login-ops-mcp/;
const toolsCapabilityPattern = /tools/;

test("handles an MCP initialize request through the Lambda adapter", async () => {
	const response = await handler({
		body: JSON.stringify({
			id: 1,
			jsonrpc: "2.0",
			method: "initialize",
			params: {
				capabilities: {},
				clientInfo: { name: "lambda-test", version: "1.0.0" },
				protocolVersion: "2025-11-25",
			},
		}),
		headers: {
			accept: "application/json, text/event-stream",
			"content-type": "application/json",
		},
		isBase64Encoded: false,
		rawPath: "/mcp",
		rawQueryString: "",
		requestContext: {
			domainName: "example.execute-api.ap-northeast-1.amazonaws.com",
			http: { method: "POST" },
		},
	});

	assert.equal(response.statusCode, 200);
	assert.match(response.body ?? "", serverNamePattern);
	assert.match(response.body ?? "", toolsCapabilityPattern);
});
