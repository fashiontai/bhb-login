import assert from "node:assert/strict";
import test from "node:test";

import {
	buildWebhookPayload,
	createWebhookHandler,
	mergeNotifications,
	parseOpsNotification,
	parseWebhookDestination,
} from "../dist/webhook.mjs";

const criticalPattern = /CRITICAL/;
const twoAlertsPattern = /共 2 条/;
const invalidNotificationPattern =
	/Webhook Notifier received an invalid notification/;
const webhookHttpsPattern = /Webhook URL must use HTTPS/;

const notification = {
	type: "ops.notification.created",
	severity: "CRITICAL",
	priority: "P0",
	requiresApproval: true,
	subject: "[bhb-login][CRITICAL] 运维告警需要确认",
	summary: "Aurora PostgreSQL 不可用",
	findings: [
		{
			area: "database",
			evidence: "Aurora status=failing-over",
			recommendedAction: "检查 Aurora 事件",
			severity: "CRITICAL",
			summary: "Aurora PostgreSQL 不可用",
		},
	],
	recommendedActions: ["检查 Aurora 事件"],
};

const snsEvent = {
	Records: [
		{
			Sns: {
				Message: JSON.stringify(notification),
				MessageId: "message-1",
			},
		},
	],
};

test("parses a raw HTTPS webhook destination", () => {
	assert.deepEqual(
		parseWebhookDestination("https://example.com/webhook", "generic"),
		{
			provider: "generic",
			url: "https://example.com/webhook",
		}
	);
});

test("allows the secure parameter to select a provider", () => {
	assert.deepEqual(
		parseWebhookDestination(
			JSON.stringify({
				provider: "feishu",
				url: "https://example.com/feishu",
			}),
			"generic"
		),
		{
			provider: "feishu",
			url: "https://example.com/feishu",
		}
	);
});

test("rejects non-HTTPS webhook destinations", () => {
	assert.throws(
		() => parseWebhookDestination("http://example.com/webhook", "generic"),
		webhookHttpsPattern
	);
});

test("builds provider-specific webhook payloads", () => {
	assert.equal(buildWebhookPayload(notification, "feishu").msg_type, "text");
	assert.equal(
		buildWebhookPayload(notification, "dingtalk").msgtype,
		"markdown"
	);
	assert.equal(buildWebhookPayload(notification, "wecom").msgtype, "markdown");
	assert.match(
		buildWebhookPayload(notification, "slack").text,
		criticalPattern
	);
	assert.equal(
		buildWebhookPayload(notification, "generic").event,
		"bhb-login.ops.notification"
	);
});

test("delivers an SNS notification to the configured webhook", async () => {
	let requestBody = "";
	const handler = createWebhookHandler({
		getDestination: async () => ({
			provider: "generic",
			url: "https://example.com/webhook",
		}),
		request: (_url, init) => {
			requestBody = init?.body?.toString() ?? "";
			return Promise.resolve(new Response(null, { status: 204 }));
		},
	});

	await handler(snsEvent);

	assert.equal(JSON.parse(requestBody).event, "bhb-login.ops.notification");
});

test("merges P1 and P2 notifications into one digest", () => {
	const result = mergeNotifications([
		{ ...notification, priority: "P1", severity: "DEGRADED" },
		{
			...notification,
			priority: "P2",
			severity: "UNKNOWN",
			summary: "无法确认 Aurora 当前状态",
		},
	]);

	assert.equal(result.priority, "P1");
	assert.equal(result.aggregation?.total, 2);
	assert.equal(result.aggregation?.counts.P1, 1);
	assert.equal(result.aggregation?.counts.P2, 1);
	assert.equal(result.findings.length, 1);
});

test("delivers one webhook request for a scheduled queue drain", async () => {
	const deletedMessageIds = [];
	const requestBodies = [];
	const handler = createWebhookHandler({
		deleteBufferedNotifications: (messages) => {
			deletedMessageIds.push(...messages.map((message) => message.messageId));
			return Promise.resolve();
		},
		getDestination: async () => ({
			provider: "wecom",
			url: "https://example.com/webhook",
		}),
		receiveBufferedNotifications: async () => [
			{
				messageId: "message-p1",
				notification: {
					...notification,
					priority: "P1",
					severity: "DEGRADED",
				},
				receiptHandle: "receipt-p1",
			},
			{
				messageId: "message-p2",
				notification: {
					...notification,
					priority: "P2",
					severity: "UNKNOWN",
				},
				receiptHandle: "receipt-p2",
			},
		],
		request: (_url, init) => {
			requestBodies.push(init?.body?.toString() ?? "");
			return Promise.resolve(new Response(null, { status: 204 }));
		},
	});
	await handler({ source: "aws.events" });

	assert.equal(requestBodies.length, 1);
	assert.deepEqual(deletedMessageIds, ["message-p1", "message-p2"]);
	assert.match(JSON.parse(requestBodies[0]).markdown.content, twoAlertsPattern);
});

test("keeps buffered notifications when webhook delivery fails", async () => {
	let deleteCalled = false;
	const handler = createWebhookHandler({
		deleteBufferedNotifications: () => {
			deleteCalled = true;
			return Promise.resolve();
		},
		getDestination: async () => ({
			provider: "wecom",
			url: "https://example.com/webhook",
		}),
		receiveBufferedNotifications: async () => [
			{
				messageId: "message-p1",
				notification: {
					...notification,
					priority: "P1",
					severity: "DEGRADED",
				},
				receiptHandle: "receipt-p1",
			},
		],
		request: () =>
			Promise.resolve(new Response("temporary failure", { status: 503 })),
	});

	await assert.rejects(() => handler({ source: "aws.events" }));
	assert.equal(deleteCalled, false);
});

test("rejects invalid notification messages", () => {
	assert.throws(
		() => parseOpsNotification(JSON.stringify({ type: "other" })),
		invalidNotificationPattern
	);
});
