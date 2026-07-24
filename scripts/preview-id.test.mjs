import assert from "node:assert/strict";
import test from "node:test";

import { createPreviewId } from "./preview-id.mjs";

const previewIdPattern = /^pr-[a-z0-9-]+-[a-f0-9]{8}$/;

test("creates stable DNS-safe preview IDs", () => {
	const previewId = createPreviewId("feature/Go Profile");

	assert.match(previewId, previewIdPattern);
	assert.equal(previewId, createPreviewId("feature/Go Profile"));
});

test("keeps different branches distinct after truncation", () => {
	const first = createPreviewId("feature/a-very-long-branch-name-one");
	const second = createPreviewId("feature/a-very-long-branch-name-two");

	assert.notEqual(first, second);
	assert.ok(first.length <= 32);
	assert.ok(second.length <= 32);
});
