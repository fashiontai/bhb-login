import assert from "node:assert/strict";
import test from "node:test";

import { parseAlarmStateChangeEvent } from "../dist/observer.mjs";

const malformedEventPattern = /Observer received a non-object event payload/;

const alarmEvent = {
	source: "aws.cloudwatch",
	"detail-type": "CloudWatch Alarm State Change",
	detail: {
		alarmName: "bhb-login-ApiAliasErrorAlarm",
		state: {
			value: "ALARM",
			reason: "The threshold was breached",
			timestamp: "2026-07-29T10:00:00.000Z",
		},
	},
};

test("parses a CloudWatch alarm state change event", () => {
	const result = parseAlarmStateChangeEvent(JSON.stringify(alarmEvent));

	assert.deepEqual(result, {
		source: "aws.cloudwatch",
		detailType: "CloudWatch Alarm State Change",
		alarmName: "bhb-login-ApiAliasErrorAlarm",
		stateValue: "ALARM",
		stateReason: "The threshold was breached",
		stateTimestamp: "2026-07-29T10:00:00.000Z",
	});
});

test("unwraps an SNS envelope", () => {
	const result = parseAlarmStateChangeEvent(
		JSON.stringify({
			Type: "Notification",
			Message: JSON.stringify(alarmEvent),
		})
	);

	assert.equal(result.alarmName, "bhb-login-ApiAliasErrorAlarm");
	assert.equal(result.stateValue, "ALARM");
});

test("rejects malformed observer events", () => {
	assert.throws(
		() => parseAlarmStateChangeEvent("not-json"),
		malformedEventPattern
	);
});
