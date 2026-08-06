import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { SNSEvent } from "aws-lambda";

const WEBHOOK_TIMEOUT_MS = 8000;
const RESPONSE_PREVIEW_LENGTH = 300;

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
	findings: NotificationFinding[];
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
		!Array.isArray(parsed.findings) ||
		!Array.isArray(parsed.recommendedActions)
	) {
		throw new Error("Webhook Notifier received an invalid notification");
	}
	return parsed as unknown as OpsNotification;
};

const createMessageText = (notification: OpsNotification): string => {
	const actions =
		notification.recommendedActions.length > 0
			? notification.recommendedActions
					.map((action, index) => `${index + 1}. ${action}`)
					.join("\n")
			: "请查看 CloudWatch 日志并人工确认。";
	return [
		notification.subject,
		`严重级别：${notification.severity}`,
		`摘要：${notification.summary}`,
		"建议操作：",
		actions,
	].join("\n");
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
	return async (event: SNSEvent): Promise<void> => {
		const destination = await getDestination();
		for (const record of event.Records) {
			const notification = parseOpsNotification(record.Sns.Message);
			await sendWebhook(destination, notification, request);
			console.info(
				JSON.stringify({
					messageId: record.Sns.MessageId,
					provider: destination.provider,
					severity: notification.severity,
					type: "ops.webhook.delivered",
				})
			);
		}
	};
};

export const handler = createWebhookHandler();
