---
description: 后端 API 规范 — Hono + tRPC + Better-Auth + Prisma 的 procedure、认证、context、错误处理约定
globs: apps/server/**, packages/api/**, packages/auth/**, packages/db/**, packages/env/**
---

# 后端 API 规范

本项目后端为 Turborepo monorepo 下的 Hono + tRPC (Node.js) 服务,数据层用 Prisma ORM,认证用 Better-Auth。API 通过 `packages/api` 定义,由 `apps/server` 挂载运行。所有代码遵循根目录 `.claude/CLAUDE.md` 的 Ultracite / Biome 标准。

## 目录与包职责

- `apps/server` — 运行时入口。用 Hono 组装:CORS、logger、Better-Auth handler (`/api/auth/*`)、tRPC handler (`/trpc/*`)。同时支持 AWS Lambda (`hono/aws-lambda`) 与本地 `@hono/node-server`。**只做组装,不写业务逻辑。**
- `packages/api` — tRPC 定义层。`index.ts` 导出 `router` / `publicProcedure` / `protectedProcedure`,`context.ts` 构建请求上下文,`routers/` 存放各业务 router。
- `packages/auth` — Better-Auth 配置(`createAuth`)。
- `packages/db` — Prisma client 工厂(`createPrismaClient`)与 schema。
- `packages/env` — 用 `@t3-oss/env-core` + zod 做环境变量校验,服务端从 `@bhb-login/env/server` 引入。

## tRPC Procedure 约定

- 从 `../index` 引入 `publicProcedure` / `protectedProcedure` / `router`,**不要**重新 `initTRPC`(单例定义在 `packages/api/src/index.ts`)。
- 需要登录的接口一律用 `protectedProcedure`;它已校验 `ctx.session` 并在缺失时抛 `TRPCError({ code: "UNAUTHORIZED" })`。公开接口用 `publicProcedure`。
- 新增业务 router 放在 `packages/api/src/routers/`,并在 `routers/index.ts` 的 `appRouter` 上挂载。保持 `export type AppRouter = typeof appRouter` 供前端类型推导。
- 每个 procedure 用 `.input(zodSchema)` 显式校验入参;查询用 `.query`,写操作用 `.mutation`。不要接收未经 zod 校验的原始入参。
- 入参/出参类型由 zod 与推导得出,避免手写 `any`;类型未知时用 `unknown`。

## Context 与认证

- 请求上下文由 `createContext` 构建,内含 `session`(来自 `auth.api.getSession({ headers })`)。在 procedure 内通过 `ctx.session` 取用户身份。
- 认证由 Better-Auth 统一处理,路由 `/api/auth/*` 直接交给 `auth.handler`。**不要**自己实现登录/注册/会话逻辑,扩展能力通过 Better-Auth plugins 完成。
- 当前启用 `emailAndPassword`;新增 OAuth / 插件时改 `packages/auth/src/index.ts` 的 `createAuth`,并同步 `trustedOrigins`。
- Cookie 属性走 `advanced.defaultCookieAttributes`(`sameSite: none` / `secure` / `httpOnly`)。跨域改动需同时校对 `apps/server` 的 CORS `origin` 与 `credentials`。

## 数据访问 (Prisma)

- 通过 `createPrismaClient()`(`@bhb-login/db`)获取 client,底层用 `@prisma/adapter-pg` 连 PostgreSQL,连接串来自 `env.DATABASE_URL`。
- Schema 位于 `packages/db/prisma/schema/`(`schema.prisma` + `auth.prisma`)。**不要手改** `packages/db/prisma/generated/`,它是生成产物。
- 模型/字段变更后需重新生成 client 并走 migration,再在 API 层使用。business SQL 只在 API/service 层触达,不下沉到 `apps/server` 入口。

## 错误处理

- 抛错用 `TRPCError`,给出恰当 `code`(如 `UNAUTHORIZED` / `BAD_REQUEST` / `NOT_FOUND` / `FORBIDDEN`)与可读 `message`。不要抛字符串。
- 校验失败交给 zod `.input`,不要在 handler 里手动堆叠条件判断。
- 遵循 CLAUDE.md:async 里 `await` 所有 promise;用 try-catch 有意义地处理异步错误;生产代码移除 `console.log`(logger 由 Hono middleware 统一提供)。

## 环境变量

- 新增服务端环境变量:先在 `packages/env/src/server.ts` 的 zod schema 里声明并校验,再在代码中经 `env.*` 读取,**禁止**直接读 `process.env`。
- 密钥类保持约束(如 `BETTER_AUTH_SECRET` 最少 32 位;URL 用 `z.url()`)。

## 命令

- 安装:`pnpm install`
- 开发:`pnpm run dev`(Turborepo 并行启动)
- 构建:`pnpm run build`
- 检查/lint:`pnpm run check`(等价 `pnpm dlx ultracite check`)
- 提交前运行 `pnpm dlx ultracite fix` 保证格式与 lint 合规。
