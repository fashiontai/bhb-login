import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import {
	Client,
	StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { SignatureV4 } from "@smithy/signature-v4";

interface RecordValue {
	[key: string]: unknown;
}

export interface McpIncidentContext {
	collectedAt?: string;
	resources?: Record<string, unknown>;
	type?: string;
}

export interface McpEvidence {
	context?: McpIncidentContext;
	error?: string;
	status: "disabled" | "error" | "ok";
}

const endpoint = process.env.OPS_MCP_ENDPOINT?.trim() ?? "";
const region = process.env.AWS_REGION?.trim() || "ap-northeast-1";

const isRecord = (value: unknown): value is RecordValue =>
	typeof value === "object" && value !== null;

const requestBody = async (
	request: Request
): Promise<Uint8Array | undefined> => {
	if (request.method === "GET" || request.method === "HEAD") {
		return;
	}
	return new Uint8Array(await request.clone().arrayBuffer());
};

const signedFetch: typeof fetch = async (input, init) => {
	const request = new Request(input, init);
	const url = new URL(request.url);
	const signer = new SignatureV4({
		credentials: defaultProvider(),
		region,
		service: "execute-api",
		sha256: Sha256,
	});
	const headers = Object.fromEntries(request.headers.entries());
	headers.host = url.host;
	const body = await requestBody(request);
	const signed = await signer.sign({
		body,
		headers,
		hostname: url.hostname,
		method: request.method,
		path: `${url.pathname}${url.search}`,
		protocol: url.protocol,
	});
	return fetch(request.url, {
		body,
		headers: signed.headers,
		method: request.method,
		signal: request.signal,
	});
};

const parseToolContext = (result: unknown): McpIncidentContext => {
	if (!isRecord(result)) {
		throw new Error("MCP tool returned a non-object result");
	}
	if (isRecord(result.structuredContent)) {
		return result.structuredContent as McpIncidentContext;
	}
	const content = Array.isArray(result.content) ? result.content : [];
	const text = content.find(
		(item) =>
			isRecord(item) && item.type === "text" && typeof item.text === "string"
	);
	if (!(isRecord(text) && typeof text.text === "string")) {
		throw new Error("MCP tool result did not contain JSON text");
	}
	const parsed = JSON.parse(text.text) as unknown;
	if (!isRecord(parsed)) {
		throw new Error("MCP tool JSON result was not an object");
	}
	return parsed as McpIncidentContext;
};

export const collectMcpEvidence = async (input: {
	alarmName?: string;
}): Promise<McpEvidence> => {
	if (!endpoint) {
		return { status: "disabled" };
	}

	const client = new Client({
		name: "bhb-login-triage-agent",
		version: "1.0.0",
	});
	const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
		fetch: signedFetch,
	});
	try {
		await client.connect(transport);
		const result = await client.callTool({
			arguments: {
				alarmName: input.alarmName,
				includeLogs: true,
				logMinutes: 15,
			},
			name: "collect_incident_context",
		});
		return { context: parseToolContext(result), status: "ok" };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
			status: "error",
		};
	} finally {
		await client.close().catch(() => undefined);
	}
};
