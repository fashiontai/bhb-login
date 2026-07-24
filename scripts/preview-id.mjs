import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const MAX_SLUG_LENGTH = 20;

export const createPreviewId = (branchName) => {
	const normalizedBranch = branchName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_SLUG_LENGTH);
	const branchHash = createHash("sha256")
		.update(branchName)
		.digest("hex")
		.slice(0, 8);
	const slug = normalizedBranch || "branch";

	return `pr-${slug}-${branchHash}`;
};

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const branchName = process.argv[2];
	if (!branchName) {
		throw new Error("A branch name is required");
	}
	process.stdout.write(createPreviewId(branchName));
}
