import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

import { collectMcpEvidence, type McpEvidence } from "./mcp-client.js";

interface RecordValue {
	[key: string]: unknown;
}

interface SqsRecord {
	body: string;
	messageId: string;
}

interface SqsEvent {
	Records: SqsRecord[];
}

interface ObservationSection {
	error?: string;
	status: "ok" | "error";
	value?: unknown;
}

interface ObservationSnapshot {
	event: {
		alarmName?: string;
		detailType?: string;
		source?: string;
		stateValue?: string;
	};
	failedChecks?: string[];
	observedAt?: string;
	resources: Record<string, ObservationSection>;
	type: "ops.observation.completed";
}

export type TriageSeverity = "HEALTHY" | "DEGRADED" | "CRITICAL" | "UNKNOWN";

export interface TriageFinding {
	area: string;
	evidence: string;
	recommendedAction: string;
	severity: Exclude<TriageSeverity, "HEALTHY" | "UNKNOWN">;
	summary: string;
}

export interface TriageResult {
	confidence: number;
	evaluatedAt: string;
	event: ObservationSnapshot["event"];
	findings: TriageFinding[];
	mcpEvidence: {
		collectedAt?: string;
		error?: string;
		status: McpEvidence["status"];
	};
	recommendedActions: string[];
	requiresApproval: boolean;
	severity: TriageSeverity;
	type: "ops.triage.completed";
}

const isRecord = (value: unknown): value is RecordValue =>
	typeof value === "object" && value !== null;

const sns = new SNSClient({});
const triageResultsTopicArn = process.env.OPS_TRIAGE_RESULTS_TOPIC_ARN ?? "";

const parseJson = (value: string): unknown => {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return;
	}
};

const unwrapMessage = (body: string): unknown => {
	const parsed = parseJson(body);
	if (!isRecord(parsed)) {
		return;
	}

	const message = parsed.Message;
	return typeof message === "string" ? parseJson(message) : parsed;
};

export const parseObservation = (body: string): ObservationSnapshot => {
	const event = unwrapMessage(body);
	if (!isRecord(event) || event.type !== "ops.observation.completed") {
		throw new Error("Triage received an invalid observation payload");
	}

	if (!isRecord(event.resources)) {
		throw new Error("Triage received an observation without resources");
	}

	return event as unknown as ObservationSnapshot;
};

const numericValue = (value: unknown): number | undefined => {
	if (typeof value === "number") {
		return value;
	}

	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	return;
};

const sectionValue = (
	snapshot: ObservationSnapshot,
	name: string
): RecordValue | undefined => {
	const section = snapshot.resources[name];
	return section?.status === "ok" && isRecord(section.value)
		? section.value
		: undefined;
};

const addSectionError = (
	findings: TriageFinding[],
	name: string,
	section: ObservationSection | undefined
): void => {
	if (section?.status !== "error") {
		return;
	}

	findings.push({
		area: name,
		evidence:
			section.error ?? "Observer failed to collect this resource section",
		recommendedAction: `检查 ${name} 的权限、服务状态和最近部署日志`,
		severity: "CRITICAL",
		summary: `${name} 观测失败`,
	});
};

const inspectLambda = (
	snapshot: ObservationSnapshot,
	findings: TriageFinding[]
): void => {
	const section = snapshot.resources.lambdaAlias;
	addSectionError(findings, "lambdaAlias", section);
};

const inspectEcs = (
	snapshot: ObservationSnapshot,
	findings: TriageFinding[]
): void => {
	const section = snapshot.resources.ecs;
	addSectionError(findings, "ecs", section);
	const service = sectionValue(snapshot, "ecs")?.service;
	if (!isRecord(service)) {
		return;
	}

	const runningCount = numericValue(service.runningCount);
	const desiredCount = numericValue(service.desiredCount);
	if (service.status !== "ACTIVE" || service.rolloutState === "FAILED") {
		findings.push({
			area: "ecs",
			evidence: `service status=${String(service.status)}, rolloutState=${String(service.rolloutState)}`,
			recommendedAction: "检查 ECS Service 事件和最近任务停止原因",
			severity: "CRITICAL",
			summary: "Go ECS 服务未处于稳定状态",
		});
		return;
	}

	if (
		desiredCount !== undefined &&
		runningCount !== undefined &&
		runningCount === 0 &&
		desiredCount > 0
	) {
		findings.push({
			area: "ecs",
			evidence: `runningCount=${runningCount}, desiredCount=${desiredCount}`,
			recommendedAction: "检查 ECS 任务启动失败原因和容器日志",
			severity: "CRITICAL",
			summary: "Go ECS 没有运行中的任务",
		});
		return;
	}

	if (
		desiredCount !== undefined &&
		runningCount !== undefined &&
		runningCount < desiredCount
	) {
		findings.push({
			area: "ecs",
			evidence: `runningCount=${runningCount}, desiredCount=${desiredCount}`,
			recommendedAction: "检查 ECS 任务扩容进度和任务事件",
			severity: "DEGRADED",
			summary: "Go ECS 运行任务数低于期望值",
		});
	}
};

const inspectAlb = (
	snapshot: ObservationSnapshot,
	findings: TriageFinding[]
): void => {
	const section = snapshot.resources.alb;
	addSectionError(findings, "alb", section);
	const value = sectionValue(snapshot, "alb");
	const targetCount = numericValue(value?.targetCount);
	const states = isRecord(value?.states) ? value.states : {};
	const healthyCount = numericValue(states.healthy) ?? 0;
	const unhealthyCount = numericValue(states.unhealthy) ?? 0;

	if (targetCount === 0) {
		findings.push({
			area: "alb",
			evidence: "targetCount=0",
			recommendedAction: "检查 ALB Target Group 注册目标和 ECS 服务",
			severity: "CRITICAL",
			summary: "Go ALB 没有注册目标",
		});
		return;
	}

	if (healthyCount === 0 && targetCount !== undefined) {
		findings.push({
			area: "alb",
			evidence: `healthy=${healthyCount}, targetCount=${targetCount}`,
			recommendedAction: "检查健康检查路径、端口和 ECS 安全组",
			severity: "CRITICAL",
			summary: "Go ALB 没有健康目标",
		});
		return;
	}

	if (unhealthyCount > 0) {
		findings.push({
			area: "alb",
			evidence: `unhealthy=${unhealthyCount}, healthy=${healthyCount}`,
			recommendedAction: "检查不健康目标的 Target Health reason",
			severity: "DEGRADED",
			summary: "Go ALB 存在不健康目标",
		});
	}
};

const inspectDatabase = (
	snapshot: ObservationSnapshot,
	findings: TriageFinding[]
): void => {
	const section = snapshot.resources.database;
	addSectionError(findings, "database", section);
	const status = sectionValue(snapshot, "database")?.status;
	if (status && status !== "available") {
		findings.push({
			area: "database",
			evidence: `Aurora status=${String(status)}`,
			recommendedAction: "检查 Aurora 事件、容量和数据库连接",
			severity: "CRITICAL",
			summary: "Aurora PostgreSQL 不可用",
		});
	}
};

const inspectQueues = (
	snapshot: ObservationSnapshot,
	findings: TriageFinding[]
): void => {
	const section = snapshot.resources.queues;
	addSectionError(findings, "queues", section);
	if (section?.status !== "ok" || !isRecord(section.value)) {
		return;
	}

	for (const [name, queue] of Object.entries(section.value)) {
		if (!isRecord(queue)) {
			continue;
		}

		const visible = numericValue(queue.visible) ?? 0;
		if (name.toLowerCase().includes("dlq") && visible > 0) {
			findings.push({
				area: "queues",
				evidence: `${name}.visible=${visible}`,
				recommendedAction: "检查失败消息原因，人工确认后再决定是否重放 DLQ",
				severity: "CRITICAL",
				summary: "业务死信队列存在待处理消息",
			});
		}
	}
};

const inspectAlarm = (
	snapshot: ObservationSnapshot,
	findings: TriageFinding[]
): void => {
	if (snapshot.event.stateValue === "ALARM") {
		findings.push({
			area: "alarm",
			evidence: "CloudWatch Alarm entered ALARM state",
			recommendedAction: "结合告警指标和资源观测结果确认影响范围",
			severity: "DEGRADED",
			summary: "CloudWatch 告警处于 ALARM 状态",
		});
		return;
	}

	if (snapshot.event.stateValue === "INSUFFICIENT_DATA") {
		findings.push({
			area: "alarm",
			evidence: "CloudWatch Alarm entered INSUFFICIENT_DATA state",
			recommendedAction: "检查指标采集、维度配置和监控数据源",
			severity: "DEGRADED",
			summary: "CloudWatch 告警缺少足够指标数据",
		});
	}
};

const inspectMcpLogs = (
	evidence: McpEvidence,
	findings: TriageFinding[]
): void => {
	if (evidence.status !== "ok" || !isRecord(evidence.context?.resources)) {
		return;
	}
	for (const name of ["apiErrors", "goErrors"]) {
		const section = evidence.context.resources[name];
		if (
			!isRecord(section) ||
			section.status !== "ok" ||
			!isRecord(section.value)
		) {
			continue;
		}
		const events = Array.isArray(section.value.events)
			? section.value.events
			: [];
		if (events.length > 0) {
			findings.push({
				area: name,
				evidence: `${name}.events=${events.length} in the last 15 minutes`,
				recommendedAction: "查看 MCP 返回的近期错误日志并确认首个异常时间点",
				severity: "DEGRADED",
				summary: `${name} 存在近期错误日志`,
			});
		}
	}
};

export const triage = (
	snapshot: ObservationSnapshot,
	mcpEvidence: McpEvidence = { status: "disabled" }
): TriageResult => {
	const findings: TriageFinding[] = [];
	for (const name of snapshot.failedChecks ?? []) {
		findings.push({
			area: name,
			evidence: `Observer failedChecks includes ${name}`,
			recommendedAction: `检查 ${name} 的 AWS API 权限和资源状态`,
			severity: "CRITICAL",
			summary: `${name} 观测失败`,
		});
	}

	inspectAlarm(snapshot, findings);
	inspectLambda(snapshot, findings);
	inspectEcs(snapshot, findings);
	inspectAlb(snapshot, findings);
	inspectDatabase(snapshot, findings);
	inspectQueues(snapshot, findings);
	inspectMcpLogs(mcpEvidence, findings);

	const hasCriticalFinding = findings.some(
		(finding) => finding.severity === "CRITICAL"
	);
	const hasDegradedFinding = findings.some(
		(finding) => finding.severity === "DEGRADED"
	);
	let severity: TriageSeverity = "HEALTHY";
	if (hasCriticalFinding) {
		severity = "CRITICAL";
	} else if (hasDegradedFinding) {
		severity = "DEGRADED";
	}
	const recommendedActions = [
		...new Set(findings.map((finding) => finding.recommendedAction)),
	];

	return {
		confidence: findings.length > 0 ? 0.9 : 0.8,
		evaluatedAt: new Date().toISOString(),
		event: snapshot.event,
		findings,
		mcpEvidence: {
			collectedAt: mcpEvidence.context?.collectedAt,
			error: mcpEvidence.error,
			status: mcpEvidence.status,
		},
		recommendedActions,
		requiresApproval: findings.length > 0,
		severity,
		type: "ops.triage.completed",
	};
};

const publishTriageResult = async (result: TriageResult): Promise<void> => {
	if (!triageResultsTopicArn) {
		return;
	}

	await sns.send(
		new PublishCommand({
			Message: JSON.stringify(result),
			TopicArn: triageResultsTopicArn,
		})
	);
};

export const handler = async (event: SqsEvent) => {
	const batchItemFailures: Array<{ itemIdentifier: string }> = [];

	for (const record of event.Records) {
		try {
			const snapshot = parseObservation(record.body);
			const mcpEvidence = await collectMcpEvidence({
				alarmName: snapshot.event.alarmName,
			});
			const result = triage(snapshot, mcpEvidence);
			await publishTriageResult(result);
			console.info(JSON.stringify(result));
		} catch (error) {
			console.error("Triage failed to process event", {
				error: error instanceof Error ? error.message : String(error),
				messageId: record.messageId,
			});
			batchItemFailures.push({ itemIdentifier: record.messageId });
		}
	}

	return { batchItemFailures };
};
