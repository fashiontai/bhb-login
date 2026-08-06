import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import {
	collectIncidentContext,
	getAlbTargetHealth,
	getDatabaseHealth,
	getEcsServiceHealth,
	getLambdaAliasHealth,
	getQueueHealth,
	getRecentLogs,
	loadOpsMcpConfig,
} from "./tools.js";

const asToolResult = (value: unknown) => ({
	content: [{ text: JSON.stringify(value), type: "text" as const }],
	structuredContent: value as Record<string, unknown>,
});

const readOnlyAnnotations = {
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: true,
	readOnlyHint: true,
};

export const createOpsMcpServer = (): McpServer => {
	const config = loadOpsMcpConfig();
	const server = new McpServer(
		{ name: "bhb-login-ops-mcp", version: "1.0.0" },
		{ capabilities: { tools: {} } }
	);

	server.registerTool(
		"collect_incident_context",
		{
			annotations: readOnlyAnnotations,
			description:
				"Collect a read-only incident snapshot for Lambda, ECS, ALB, Aurora, SQS and optional recent error logs.",
			inputSchema: z.object({
				alarmName: z.string().min(1).optional(),
				includeLogs: z.boolean().default(true),
				logMinutes: z.number().int().min(1).max(60).default(15),
			}),
			title: "收集运维事件上下文",
		},
		async (input) => asToolResult(await collectIncidentContext(config, input))
	);

	server.registerTool(
		"get_lambda_alias_health",
		{
			annotations: readOnlyAnnotations,
			description: "Read the production Lambda live alias and canary routing.",
			inputSchema: z.object({}),
			title: "查询 Lambda 灰度别名",
		},
		async () => asToolResult(await getLambdaAliasHealth(config))
	);

	server.registerTool(
		"get_ecs_service_health",
		{
			annotations: readOnlyAnnotations,
			description: "Read the Go ECS cluster and service deployment state.",
			inputSchema: z.object({}),
			title: "查询 ECS 服务状态",
		},
		async () => asToolResult(await getEcsServiceHealth(config))
	);

	server.registerTool(
		"get_alb_target_health",
		{
			annotations: readOnlyAnnotations,
			description: "Read target health from the Go service ALB target group.",
			inputSchema: z.object({}),
			title: "查询 ALB Target Health",
		},
		async () => asToolResult(await getAlbTargetHealth(config))
	);

	server.registerTool(
		"get_aurora_health",
		{
			annotations: readOnlyAnnotations,
			description: "Read Aurora PostgreSQL cluster availability and capacity.",
			inputSchema: z.object({}),
			title: "查询 Aurora 状态",
		},
		async () => asToolResult(await getDatabaseHealth(config))
	);

	server.registerTool(
		"get_queue_health",
		{
			annotations: readOnlyAnnotations,
			description: "Read the business SQS queue and dead-letter queue depth.",
			inputSchema: z.object({}),
			title: "查询 SQS 与 DLQ",
		},
		async () => asToolResult(await getQueueHealth(config))
	);

	server.registerTool(
		"get_recent_logs",
		{
			annotations: readOnlyAnnotations,
			description:
				"Read recent events from an allow-listed project CloudWatch Logs group.",
			inputSchema: z.object({
				filterPattern: z.string().max(256).optional(),
				limit: z.number().int().min(1).max(50).default(20),
				minutes: z.number().int().min(1).max(60).default(15),
				service: z.enum([
					"api",
					"go",
					"processor",
					"observer",
					"triage",
					"release",
				]),
			}),
			title: "查询近期项目日志",
		},
		async (input) => asToolResult(await getRecentLogs(config, input))
	);

	return server;
};
