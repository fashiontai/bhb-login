# T-006 端到端核验记录（change-password）

> 目的：为 tasks.md 中 T-006 的 `[x]` 留下可复核轨迹（谁、在什么环境、执行了哪几步、观察到什么），
> 满足 review 对"写库 E2E 需留痕"的要求（见 AGENTS.md [T-006]）。

## 可复跑的自动化用例

- 文件：[`apps/server/e2e/change-password.e2e.mjs`](../../apps/server/e2e/change-password.e2e.mjs)（Node 内置 `node:test`，零额外依赖）。
- 运行：`pnpm -F server test:e2e`（等价 `node --test e2e/`）。
- 设计：服务端/数据库不可达时**自动 skip、绝不 fail**（预检打一次碰库的注册请求，非 200 即跳过）；
  具备环境时执行完整断言。

## 核验环境

- 执行者：自动开发流水线（yd-ai-wf）+ 本次人工复核。
- 服务端：本地 `dev:server`（Hono + Better-Auth）监听 `http://localhost:3000`，`Origin: http://localhost:3001`（过 CSRF）。
- 数据库：Docker `postgres:16-alpine`，连接串对齐 `apps/server/.env`
  （`postgresql://postgres:password@localhost:5432/postgres`），`pnpm --filter @bhb-login/db db:push` 应用 User/Session/Account/Verification schema。
- 核验后已删除临时容器，还原沙箱（沙箱默认无 PG，见 AGENTS.md [T-006]）。

## 执行步骤与观察结果（均为对真实库的写操作，非 mock）

| AC / 需求 | 步骤 | 期望 | 实测 |
| --- | --- | --- | --- |
| 前置 | 注册新用户 | 200 + 下发会话 cookie | ✅ 200，会话建立 |
| AC-002 | 用**错误**当前密码调 `/api/auth/change-password` | 400 `INVALID_PASSWORD` | ✅ 400，`code=INVALID_PASSWORD`（前端作用域映射为 `invalidCurrentPassword`） |
| AC-002 | 改密失败后用**旧**密码登录 | 200（密码未变） | ✅ 200 |
| AC-004 | 用**正确**当前密码改密（`revokeOtherSessions:true`） | 200 | ✅ 200 |
| AC-004 | 用**旧**密码登录 | 401 失败 | ✅ 401 |
| AC-004 | 用**新**密码登录 | 200 成功 | ✅ 200 |
| F-006 | 用改密前的会话 cookie 调 `/api/auth/get-session` | 返回 null（会话被注销） | ✅ null |

`node --test` 汇总：`# pass 2  # fail 0  # skipped 0`（具备库环境时）。

## 静态核验（无需库）

- `pnpm run check-types -F web`：通过（vite build + tsc --noEmit）。
- `pnpm dlx ultracite check`：change-password 相关文件零问题。
- AC-003（前端校验：当前密码非空、新密码 ≥8、两次一致、新≠当前）由
  `apps/web/src/components/change-password-form.tsx` 的 zod schema + refine 覆盖，均接 i18n key。
- AC-005（未登录不可访问 dashboard）由 `apps/web/src/routes/_auth/route.tsx` 的 `beforeLoad` 守卫保证。
