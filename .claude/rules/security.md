---
description: 安全规范 — 认证、授权、密钥、输入校验、CORS/Cookie 的强制约束
globs: ["packages/auth/**", "packages/api/**", "packages/env/**", "apps/server/**"]
---

# 安全规范

本项目为 Better-T-Stack 全栈应用(Hono + tRPC + Prisma + Better-Auth)。以下规则为强制约束。

## 认证 (Better-Auth)

- 认证统一由 `@bhb-login/auth`(Better-Auth)承载,禁止自行实现口令哈希、会话签发或令牌校验。
- `BETTER_AUTH_SECRET` 必须来自环境变量且长度 ≥ 32(已在 `packages/env/src/server.ts` 用 zod 强校验),禁止硬编码或提交进仓库。
- 会话通过 `auth.api.getSession({ headers })` 从请求头解析,禁止信任客户端传入的用户 ID / 角色等身份字段。
- Cookie 属性遵循 `packages/auth` 中 `defaultCookieAttributes`:`httpOnly: true`、`secure: true`、`sameSite: "none"`。跨站部署下不得降级为 `secure: false`。

## 授权 (tRPC)

- 需要登录的 procedure 必须使用 `protectedProcedure`(`packages/api/src/index.ts`),它在 `ctx.session` 缺失时抛出 `UNAUTHORIZED`。禁止用 `publicProcedure` 承载受保护数据。
- 授权判定只依据服务端 `ctx.session`,不得依据入参中的身份声明。
- 越权防护:凡涉及"按资源归属读写"的查询,必须在 where 条件中带上当前 `session.user.id`,防止水平越权(IDOR)。
- 错误信息不回传敏感内部细节;`TRPCError` 的 `message` 面向用户,`cause` 仅用于日志。

## 密钥与环境变量

- 所有服务端密钥/连接串(`DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`CORS_ORIGIN`)只经 `@bhb-login/env/server` 读取,新增变量必须补 zod schema。
- `.env` 文件禁止提交(确认已在 `.gitignore`);仅提交 `.env.example` 占位。
- 前端(`packages/env/src/web.ts`)只暴露 `VITE_`/公开变量,禁止把服务端密钥透传到 web 包。
- 禁止 `console.log` 输出 session、token、密码、连接串等敏感值。

## 输入校验

- 每个 tRPC procedure 的 `input` 必须用 zod 定义并校验,禁止直接消费未校验的 `unknown`。
- 数据库访问统一走 Prisma 参数化查询;禁止 `$queryRawUnsafe` / 字符串拼接 SQL。确需 raw 时用 `Prisma.sql` 模板标签。
- 前端渲染用户内容时避免 `dangerouslySetInnerHTML`;必须使用时先做消毒。

## CORS 与传输

- CORS 白名单来自 `env.CORS_ORIGIN`(见 `apps/server/src/index.ts`),禁止使用 `origin: "*"` 搭配 `credentials: true`。
- `allowHeaders` 保持最小集合(`Content-Type`、`Authorization`);新增头需评审。
- 生产环境必须走 HTTPS(`BETTER_AUTH_URL` 为 https),否则 `secure` Cookie 不生效。

## 依赖与提交前

- 提交前运行 `pnpm run check`(Ultracite/Biome),修复安全相关 lint(如 `target="_blank"` 缺 `rel="noopener"`、`eval`、直接写 `document.cookie`)。
- 定期审查依赖漏洞,避免引入未维护的认证/加密库。
