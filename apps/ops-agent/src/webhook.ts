import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { SNSEvent, SQSBatchResponse, SQSEvent } from "aws-lambda";

const WEBHOOK_TIMEOUT_MS = 8000;
const RESPONSE_PREVIEW_LENGTH = 300;
const MAX_WEBHOOK_TEXT_LENGTH = 3500;
const AGGREGATION_WINDOW_SECONDS = 120;

export type OpsPriority = "P0" | "P1" | "P2";

export type WebhookProvider =
	| "dingtalk"
	| "feishu"
	| "generic"
	| "slack"
	| "wecom";

interface NotificationFinding {
	area: string;
	evidence: string;
	recommendedAction: string;
	severity: string;
	summary: string;
}

export interface OpsNotification {
	aggregation?: {
		counts: Record<OpsPriority, number>;
		total: number;
		windowSeconds: number;
	};
	findings: NotificationFinding[];
	priority: OpsPriority;
	recommendedActions: string[];
	requiresApproval: true;
	severity: string;
	subject: string;
	summary: string;
	triageEvaluatedAt?: string;
	type: "ops.notification.created";
}

export interface WebhookDestination {
	provider: WebhookProvider;
	url: string;
}

interface WebhookHandlerDependencies {
	getDestination: () => Promise<WebhookDestination>;
	request: typeof fetch;
}

const ssm = new SSMClient({});
let destinationPromise: Promise<WebhookDestination> | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isWebhookProvider = (value: unknown): value is WebhookProvider =>
	value === "dingtalk" ||
	value === "feishu" ||
	value === "generic" ||
	value === "slack" ||
	value === "wecom";

const isOpsPriority = (value: unknown): value is OpsPriority =>
	value === "P0" || value === "P1" || value === "P2";

const requireHttpsUrl = (value: string): string => {
	const url = new URL(value);
	if (url.protocol !== "https:") {
		throw new Error("Webhook URL must use HTTPS");
	}
	return url.toString();
};

const parseProvider = (value: unknown): WebhookProvider => {
	if (!isWebhookProvider(value)) {
		throw new Error(`Unsupported webhook provider: ${String(value)}`);
	}
	return value;
};

export const parseWebhookDestination = (
	value: string,
	fallbackProvider: WebhookProvider
): WebhookDestination => {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (isRecord(parsed) && typeof parsed.url === "string") {
			return {
				provider:
					parsed.provider === undefined
						? fallbackProvider
						: parseProvider(parsed.provider),
				url: requireHttpsUrl(parsed.url),
			};
		}
	} catch (error) {
		if (error instanceof SyntaxError) {
			return {
				provider: fallbackProvider,
				url: requireHttpsUrl(value),
			};
		}
		throw error;
	}

	throw new Error("Webhook parameter must be an HTTPS URL or JSON with a url");
};

const loadWebhookDestination = async (): Promise<WebhookDestination> => {
	const parameterName = process.env.OPS_WEBHOOK_PARAMETER_NAME?.trim();
	if (!parameterName) {
		throw new Error("OPS_WEBHOOK_PARAMETER_NAME is required");
	}
	const provider = parseProvider(
		process.env.OPS_WEBHOOK_PROVIDER?.trim() || "generic"
	);
	const response = await ssm.send(
		new GetParameterCommand({
			Name: parameterName,
			WithDecryption: true,
		})
	);
	const value = response.Parameter?.Value?.trim();
	if (!value) {
		throw new Error("Webhook parameter has no value");
	}
	return parseWebhookDestination(value, provider);
};

const getWebhookDestination = (): Promise<WebhookDestination> => {
	destinationPromise ??= loadWebhookDestination();
	return destinationPromise;
};

export const parseOpsNotification = (value: string): OpsNotification => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value) as unknown;
	} catch {
		throw new Error("Webhook Notifier received invalid JSON");
	}
	if (
		!isRecord(parsed) ||
		parsed.type !== "ops.notification.created" ||
		typeof parsed.subject !== "string" ||
		typeof parsed.summary !== "string" ||
		typeof parsed.severity !== "string" ||
		!isOpsPriority(parsed.priority) ||
		!Array.isArray(parsed.findings) ||
		!Array.isArray(parsed.recommendedActions)
	) {
		throw new Error("Webhook Notifier received an invalid notification");
	}
	return parsed as unknown as OpsNotification;
};

const uniqueStrings = (values: string[]): string[] => [
	...new Set(values.filter(Boolean)),
];

const uniqueFindings = (
	findings: NotificationFinding[]
): NotificationFinding[] => {
	const unique = new Map<string, NotificationFinding>();
	for (const finding of findings) {
		const key = `${finding.area}\u0000${finding.summary}`;
		if (!unique.has(key)) {
			unique.set(key, finding);
		}
	}
	return [...unique.values()];
};

const priorityRank: Record<OpsPriority, number> = {
	P0: 0,
	P1: 1,
	P2: 2,
};

export const mergeNotifications = (
	notifications: OpsNotification[]
): OpsNotification => {
	const firstNotification = notifications.at(0);
	if (!firstNotification) {
		throw new Error("Cannot aggregate an empty notification batch");
	}

	const counts: Record<OpsPriority, number> = { P0: 0, P1: 0, P2: 0 };
	for (const notification of notifications) {
		counts[notification.priority] += 1;
	}
	const priority = notifications.reduce<OpsPriority>(
		(highest, notification) =>
			priorityRank[notification.priority] < priorityRank[highest]
				? notification.priority
				: highest,
		firstNotification.priority
	);
	const summaries = uniqueStrings(
		notifications.map((notification) => notification.summary)
	);
	const evaluatedAt = notifications
		.map((notification) => notification.triageEvaluatedAt)
		.filter((value): value is string => Boolean(value))
		.sort()
		.at(-1);

	return {
		aggregation: {
			counts,
			total: notifications.length,
			windowSeconds: AGGREGATION_WINDOW_SECONDS,
		},
		findings: uniqueFindings(
			notifications.flatMap((notification) => notification.findings)
		),
		priority,
		recommendedActions: uniqueStrings(
			notifications.flatMap((notification) => notification.recommendedActions)
		),
		requiresApproval: true,
		severity: priority === "P1" ? "DEGRADED" : "UNKNOWN",
		subject: `[bhb-login][${priority}] ${notifications.length} 条运维告警合并通知`,
		summary: summaries.join("；") || "聚合窗口内收到运维告警",
		triageEvaluatedAt: evaluatedAt,
		type: "ops.notification.created",
	};
};

const truncateText = (value: string): string =>
	value.length <= MAX_WEBHOOK_TEXT_LENGTH
		? value
		: `${value.slice(0, MAX_WEBHOOK_TEXT_LENGTH - 1)}…`;

const createMessageText = (notification: OpsNotification): string => {
	const actions =
		notification.recommendedActions.length > 0
			? notification.recommendedActions
					.map((action, index) => `${index + 1}. ${action}`)
					.join("\n")
			: "请查看 CloudWatch 日志并人工确认。";
	const aggregation = notification.aggregation
		? [
				`聚合窗口：${notification.aggregation.windowSeconds / 60} 分钟`,
				`告警统计：共 ${notification.aggregation.total} 条（P1 ${notification.aggregation.counts.P1} / P2 ${notification.aggregation.counts.P2}）`,
			]
		: [];
	return truncateText(
		[
			notification.subject,
			`优先级：${notification.priority}`,
			`严重级别：${notification.severity}`,
			...aggregation,
			`摘要：${notification.summary}`,
			"建议操作：",
			actions,
		].join("\n")
	);
};

export const buildWebhookPayload = (
	notification: OpsNotification,
	provider: WebhookProvider
): unknown => {
	const text = createMessageText(notification);
	switch (provider) {
		case "feishu":
			return { content: { text }, msg_type: "text" };
		case "dingtalk":
			return {
				markdown: {
					text: text.replaceAll("\n", "\n\n"),
					title: notification.subject,
				},
				msgtype: "markdown",
			};
		case "wecom":
			return {
				markdown: { content: text },
				msgtype: "markdown",
			};
		case "slack":
			return { text };
		case "generic":
			return {
				event: "bhb-login.ops.notification",
				notification,
			};
		default:
			throw new Error(`Unsupported webhook provider: ${provider}`);
	}
};

const sendWebhook = async (
	destination: WebhookDestination,
	notification: OpsNotification,
	request: typeof fetch
): Promise<void> => {
	const response = await request(destination.url, {
		body: JSON.stringify(
			buildWebhookPayload(notification, destination.provider)
		),
		headers: { "content-type": "application/json" },
		method: "POST",
		signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
	});
	if (response.ok) {
		return;
	}
	const responsePreview = (await response.text()).slice(
		0,
		RESPONSE_PREVIEW_LENGTH
	);
	throw new Error(
		`Webhook returned HTTP ${response.status}: ${responsePreview}`
	);
};

export const createWebhookHandler = (
	overrides: Partial<WebhookHandlerDependencies> = {}
) => {
	const getDestination = overrides.getDestination ?? getWebhookDestination;
	const request = overrides.request ?? fetch;
	return async (
		event: SNSEvent | SQSEvent
	): Promise<undefined | SQSBatchResponse> => {
		const destination = await getDestination();
		const isSnsEvent = event.Records.every((record) => "Sns" in record);
		if (isSnsEvent) {
			for (const record of (event as SNSEvent).Records) {
				const notification = parseOpsNotification(record.Sns.Message);
				await sendWebhook(destination, notification, request);
				console.info(
					JSON.stringify({
						messageId: record.Sns.MessageId,
						mode: "immediate",
						priority: notification.priority,
						provider: destination.provider,
						severity: notification.severity,
						type: "ops.webhook.delivered",
					})
				);
			}
			return;
		}

		const sqsRecords = (event as SQSEvent).Records;
		try {
			const notifications = sqsRecords.map((record) =>
				parseOpsNotification(record.body)
			);
			const notification = mergeNotifications(notifications);
			await sendWebhook(destination, notification, request);
			console.info(
				JSON.stringify({
					messageCount: sqsRecords.length,
					messageIds: sqsRecords.map((record) => record.messageId),
					mode: "aggregated",
					priority: notification.priority,
					provider: destination.provider,
					severity: notification.severity,
					type: "ops.webhook.delivered",
				})
			);
			return { batchItemFailures: [] };
		} catch (error) {
			console.error("Webhook Notifier failed to process aggregate", {
				error: error instanceof Error ? error.message : String(error),
				messageIds: sqsRecords.map((record) => record.messageId),
			});
			return {
				batchItemFailures: sqsRecords.map((record) => ({
					itemIdentifier: record.messageId,
				})),
			};
		}
	};
};

export const handler = createWebhookHandler();
