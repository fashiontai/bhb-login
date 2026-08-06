import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

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

interface TriageFinding {
	area: string;
	evidence: string;
	recommendedAction: string;
	severity: string;
	summary: string;
}

interface TriageResult {
	evaluatedAt?: string;
	event?: RecordValue;
	findings: TriageFinding[];
	recommendedActions: string[];
	requiresApproval: boolean;
	severity: "HEALTHY" | "DEGRADED" | "CRITICAL" | "UNKNOWN";
	type: "ops.triage.completed";
}

export type OpsPriority = "P0" | "P1" | "P2";

export interface ReleaseNotification {
	findings: TriageFinding[];
	priority: OpsPriority;
	recommendedActions: string[];
	requiresApproval: true;
	severity: Exclude<TriageResult["severity"], "HEALTHY">;
	subject: string;
	summary: string;
	triageEvaluatedAt?: string;
	type: "ops.notification.created";
}

const sns = new SNSClient({});
const notificationsTopicArn = process.env.OPS_NOTIFICATIONS_TOPIC_ARN ?? "";

const priorityBySeverity: Record<
	Exclude<TriageResult["severity"], "HEALTHY">,
	OpsPriority
> = {
	CRITICAL: "P0",
	DEGRADED: "P1",
	UNKNOWN: "P2",
};

const isRecord = (value: unknown): value is RecordValue =>
	typeof value === "object" && value !== null;

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

export const parseTriageResult = (body: string): TriageResult => {
	const event = unwrapMessage(body);
	if (!isRecord(event) || event.type !== "ops.triage.completed") {
		throw new Error("Release Agent received an invalid triage payload");
	}

	if (
		!(Array.isArray(event.findings) && Array.isArray(event.recommendedActions))
	) {
		throw new Error("Release Agent received an incomplete triage payload");
	}

	return event as unknown as TriageResult;
};

export const createReleaseNotification = (
	result: TriageResult
): ReleaseNotification | undefined => {
	if (result.severity === "HEALTHY") {
		return;
	}

	const subject = `[bhb-login][${result.severity}] 运维告警需要确认`;
	const summary = result.findings
		.map((finding) => `${finding.area}: ${finding.summary}`)
		.join("；");

	return {
		findings: result.findings,
		priority: priorityBySeverity[result.severity],
		recommendedActions: result.recommendedActions,
		requiresApproval: true,
		severity: result.severity,
		subject,
		summary: summary || "Triage Agent 需要人工确认当前运维状态",
		triageEvaluatedAt: result.evaluatedAt,
		type: "ops.notification.created",
	};
};

const publishNotification = async (
	notification: ReleaseNotification
): Promise<void> => {
	if (!notificationsTopicArn) {
		return;
	}

	await sns.send(
		new PublishCommand({
			Message: JSON.stringify(notification),
			MessageAttributes: {
				priority: {
					DataType: "String",
					StringValue: notification.priority,
				},
			},
			Subject: notification.subject,
			TopicArn: notificationsTopicArn,
		})
	);
};

export const handler = async (event: SqsEvent) => {
	const batchItemFailures: Array<{ itemIdentifier: string }> = [];

	for (const record of event.Records) {
		try {
			const result = parseTriageResult(record.body);
			const notification = createReleaseNotification(result);
			if (notification) {
				await publishNotification(notification);
			}
			console.info(
				JSON.stringify({
					notificationPublished: Boolean(notification && notificationsTopicArn),
					severity: result.severity,
					type: "ops.release.gated",
				})
			);
		} catch (error) {
			console.error("Release Agent failed to process event", {
				error: error instanceof Error ? error.message : String(error),
				messageId: record.messageId,
			});
			batchItemFailures.push({ itemIdentifier: record.messageId });
		}
	}

	return { batchItemFailures };
};
