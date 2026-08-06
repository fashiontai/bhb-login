import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";

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

const { createOpsMcpServer } = await import("../dist/server.mjs");

test("publishes the expected read-only operations tools", async () => {
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const server = createOpsMcpServer();
	const client = new Client({ name: "ops-mcp-test", version: "1.0.0" });
	await server.connect(serverTransport);
	await client.connect(clientTransport);

	const result = await client.listTools();
	const names = result.tools.map((tool) => tool.name).sort();
	assert.deepEqual(names, [
		"collect_incident_context",
		"get_alb_target_health",
		"get_aurora_health",
		"get_ecs_service_health",
		"get_lambda_alias_health",
		"get_queue_health",
		"get_recent_logs",
	]);
	assert.ok(result.tools.every((tool) => tool.annotations?.readOnlyHint));

	await client.close();
	await server.close();
});
