import assert from "node:assert/strict";
import test from "node:test";

import { parseObservation, triage } from "../dist/triage.mjs";

const invalidObservationPattern =
	/Triage received an invalid observation payload/;

const healthySnapshot = {
	type: "ops.observation.completed",
	event: {
		source: "aws.cloudwatch",
		detailType: "CloudWatch Alarm State Change",
		stateValue: "OK",
	},
	resources: {
		alarm: { status: "ok", value: {} },
		lambdaAlias: { status: "ok", value: {} },
		ecs: {
			status: "ok",
			value: {
				service: { status: "ACTIVE", runningCount: 1, desiredCount: 1 },
			},
		},
		alb: {
			status: "ok",
			value: { targetCount: 1, states: { healthy: 1, unhealthy: 0 } },
		},
		database: { status: "ok", value: { status: "available" } },
		queues: {
			status: "ok",
			value: { githubProfileEventsDlq: { visible: "0" } },
		},
	},
	failedChecks: [],
};

test("classifies a healthy observation", () => {
	const result = triage(healthySnapshot);

	assert.equal(result.type, "ops.triage.completed");
	assert.equal(result.severity, "HEALTHY");
	assert.equal(result.findings.length, 0);
	assert.equal(result.requiresApproval, false);
});

test("classifies a production risk and requires approval", () => {
	const result = triage({
		...healthySnapshot,
		event: { ...healthySnapshot.event, stateValue: "ALARM" },
		resources: {
			...healthySnapshot.resources,
			database: { status: "ok", value: { status: "failing-over" } },
			queues: {
				status: "ok",
				value: { githubProfileEventsDlq: { visible: "2" } },
			},
		},
	});

	assert.equal(result.severity, "CRITICAL");
	assert.equal(result.requiresApproval, true);
	assert.ok(result.findings.some((finding) => finding.area === "database"));
	assert.ok(result.findings.some((finding) => finding.area === "queues"));
});

test("adds recent MCP error logs to the triage evidence", () => {
	const result = triage(healthySnapshot, {
		context: {
			collectedAt: "2026-08-06T00:00:00.000Z",
			resources: {
				apiErrors: {
					status: "ok",
					value: { events: [{ message: "ERROR request failed" }] },
				},
				goErrors: { status: "ok", value: { events: [] } },
			},
		},
		status: "ok",
	});

	assert.equal(result.severity, "DEGRADED");
	assert.equal(result.mcpEvidence.status, "ok");
	assert.ok(result.findings.some((finding) => finding.area === "apiErrors"));
});

test("keeps rule-based triage available when MCP is disabled", () => {
	const result = triage(healthySnapshot, { status: "disabled" });

	assert.equal(result.severity, "HEALTHY");
	assert.equal(result.mcpEvidence.status, "disabled");
});

test("parses an observation from an SNS envelope", () => {
	const result = parseObservation(
		JSON.stringify({ Message: JSON.stringify(healthySnapshot) })
	);

	assert.equal(result.type, "ops.observation.completed");
	assert.equal(result.resources.database.status, "ok");
});

test("rejects malformed observations", () => {
	assert.throws(() => parseObservation("not-json"), invalidObservationPattern);
});
