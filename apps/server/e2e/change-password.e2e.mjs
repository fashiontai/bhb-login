/**
 * change-password 端到端核验（对应 specs/2.change-password T-006 / AC-002·004·005·F-006）。
 *
 * 依赖真实运行的 Better Auth 服务端 + 可写 PostgreSQL，故设计为“环境不可达即跳过、绝不 fail”：
 * 沙箱/CI 无库时 skip，具备环境时提供可复核的自动化轨迹。
 *
 * 运行：
 *   1. 先起服务端与库：`pnpm run dev:server` 且 PostgreSQL 已 `pnpm db:push`。
 *   2. `E2E_BASE_URL=http://localhost:3000 E2E_ORIGIN=http://localhost:3001 \
 *       node --test apps/server/e2e/change-password.e2e.mjs`
 *
 * 环境变量：
 *   - E2E_BASE_URL：服务端根地址（默认 http://localhost:3000）。
 *   - E2E_ORIGIN：受信任来源（Better Auth CSRF 校验用，默认取 E2E_BASE_URL；
 *     本地须设为 CORS_ORIGIN，如 http://localhost:3001）。
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(
	/\/$/,
	""
);
const ORIGIN = process.env.E2E_ORIGIN ?? BASE_URL;
const AUTH = `${BASE_URL}/api/auth`;

const STRONG_PASSWORD = "OldPassw0rd!";
const NEW_PASSWORD = "NewPassw0rd!";
const INVALID_PASSWORD = "WrongPassw0rd!";

/** 解析 Set-Cookie 头，累积进 store，并返回当前 Cookie 请求串。 */
function absorbCookies(store, response) {
	const raw = response.headers.getSetCookie?.() ?? [];
	for (const line of raw) {
		const pair = line.split(";", 1)[0];
		const eq = pair.indexOf("=");
		if (eq > 0) {
			store.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
		}
	}
	return cookieHeader(store);
}

function cookieHeader(store) {
	return [...store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function authFetch(path, { body, cookie } = {}) {
	const headers = { origin: ORIGIN };
	if (body !== undefined) {
		headers["content-type"] = "application/json";
	}
	if (cookie) {
		headers.cookie = cookie;
	}
	return fetch(`${AUTH}${path}`, {
		method: body === undefined ? "GET" : "POST",
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(5000),
	});
}

// 唯一邮箱，避免与历史数据冲突。
const email = `e2e-cp-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
const cookies = new Map();
let staleSessionCookie = "";

/**
 * 预检：真正打一次碰库的注册请求。可达且返回 200 才算环境可用；
 * 服务端不可达或无库（500/网络错误）→ 返回跳过原因，让整套 E2E skip 而非 fail。
 */
async function preflight() {
	let res;
	try {
		res = await authFetch("/sign-up/email", {
			body: { name: "E2E User", email, password: STRONG_PASSWORD },
		});
	} catch {
		return `服务端 ${BASE_URL} 不可达（需 dev:server + 可写 PostgreSQL），跳过 E2E。`;
	}
	if (res.status !== 200) {
		return `注册预检返回 ${res.status}（多为无可写 PostgreSQL），跳过 E2E。`;
	}
	staleSessionCookie = absorbCookies(cookies, res);
	if (!staleSessionCookie) {
		return "注册未下发会话 cookie，环境异常，跳过 E2E。";
	}
	return false;
}

describe("change-password E2E", async () => {
	const skip = await preflight();

	it("AC-002：当前密码错误报错，且旧密码仍可登录", { skip }, async () => {
		const bad = await authFetch("/change-password", {
			cookie: cookieHeader(cookies),
			body: {
				currentPassword: INVALID_PASSWORD,
				newPassword: NEW_PASSWORD,
				revokeOtherSessions: true,
			},
		});
		assert.equal(bad.status, 400, "当前密码错误应返回 400");
		const payload = await bad.json();
		assert.equal(
			payload.code,
			"INVALID_PASSWORD",
			"错误码应为 INVALID_PASSWORD（前端作用域映射为 invalidCurrentPassword）"
		);

		const stillValid = await authFetch("/sign-in/email", {
			body: { email, password: STRONG_PASSWORD },
		});
		assert.equal(stillValid.status, 200, "改密失败后旧密码仍应可登录");
		absorbCookies(cookies, stillValid);
	});

	it("AC-004 / F-006：成功改密、旧密码失效、新密码可登录、其他会话被注销", {
		skip,
	}, async () => {
		const ok = await authFetch("/change-password", {
			cookie: cookieHeader(cookies),
			body: {
				currentPassword: STRONG_PASSWORD,
				newPassword: NEW_PASSWORD,
				revokeOtherSessions: true,
			},
		});
		assert.equal(ok.status, 200, "正确当前密码应改密成功");

		const oldLogin = await authFetch("/sign-in/email", {
			body: { email, password: STRONG_PASSWORD },
		});
		assert.equal(oldLogin.status, 401, "旧密码应登录失败");

		const newLogin = await authFetch("/sign-in/email", {
			body: { email, password: NEW_PASSWORD },
		});
		assert.equal(newLogin.status, 200, "新密码应登录成功");

		const revoked = await authFetch("/get-session", {
			cookie: staleSessionCookie,
		});
		const session = await revoked.json();
		assert.equal(
			session,
			null,
			"revokeOtherSessions=true 后改密前的会话应被注销"
		);
	});

	after(() => {
		if (skip) {
			process.stdout.write(`[change-password E2E] ${skip}\n`);
		}
	});
});
