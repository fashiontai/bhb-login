import assert from "node:assert/strict";
import test from "node:test";

import {
	createReleaseNotification,
	parseTriageResult,
} from "../dist/release.mjs";

const healthyResult = {
	type: "ops.triage.completed",
	severity: "HEALTHY",
	findings: [],
	recommendedActions: [],
	requiresApproval: false,
	evaluatedAt: "2026-07-30T04:00:00.000Z",
};

const criticalResult = {
	type: "ops.triage.completed",
	severity: "CRITICAL",
	findings: [
		{
			area: "database",
			evidence: "Aurora status=failing-over",
			recommendedAction: "检查 Aurora 事件、容量和数据库连接",
			severity: "CRITICAL",
			summary: "Aurora PostgreSQL 不可用",
		},
	],
	recommendedActions: ["检查 Aurora 事件、容量和数据库连接"],
	requiresApproval: true,
	evaluatedAt: "2026-07-30T04:00:00.000Z",
};

test("does not notify for a healthy triage result", () => {
	assert.equal(createReleaseNotification(healthyResult), undefined);
});

test("creates an approval notification for a critical result", () => {
	const result = createReleaseNotification(criticalResult);

	assert.equal(result?.type, "ops.notification.created");
	assert.equal(result?.severity, "CRITICAL");
	assert.equal(result?.requiresApproval, true);
	assert.match(result?.subject ?? "", /CRITICAL/);
});

test("parses a triage result from an SNS envelope", () => {
	const result = parseTriageResult(
		JSON.stringify({ Message: JSON.stringify(criticalResult) })
	);

	assert.equal(result.type, "ops.triage.completed");
	assert.equal(result.severity, "CRITICAL");
});

test("rejects an incomplete triage result", () => {
	assert.throws(
		() => parseTriageResult(JSON.stringify({ type: "ops.triage.completed" })),
		/Release Agent received an incomplete triage payload/
	);
});
