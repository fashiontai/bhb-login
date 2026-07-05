---
description: 测试规范 — Turborepo + pnpm monorepo 下前端(React/TanStack)与后端(Hono/tRPC/Prisma)的测试组织、命名与运行约定
globs: ["apps/**/*.{test,spec}.{ts,tsx}", "packages/**/*.{test,spec}.{ts,tsx}"]
---

# 测试规范

## 现状与基线

- 仓库当前**未配置测试框架**(根 `package.json` 无 `test` 脚本,无 vitest/jest/playwright 配置,无测试文件)。
- 新增测试时统一采用 **Vitest**:与现有 Vite(`apps/web`)、TypeScript、ESM(`"type": "module"`)天然契合,无需额外 Babel/转译。
- E2E 如需覆盖登录等关键流程,采用 **Playwright**,单独置于 `apps/web` 或独立 `e2e` 包。

## 目录与命名

- 单元/集成测试与被测源码**就近放置**:`Foo.ts` → `Foo.test.ts`,`Button.tsx` → `Button.test.tsx`。
- 后缀统一用 `.test.ts` / `.test.tsx`;`.spec.*` 仅保留给 E2E,避免混用。
- 每个包(`apps/*`、`packages/*`)在自身 `package.json` 声明 `"test": "vitest run"` 与 `"test:watch": "vitest"`,由 Turborepo 聚合。
- 测试文件不得放入 `dist/`、构建产物或 `node_modules`。

## 运行方式

- 根目录通过 Turborepo 运行:在 `turbo.json` 增加 `test` task(`"dependsOn": ["^build"]`、`"outputs": []`),根 `package.json` 加 `"test": "turbo run test"`。
- 单包调试:`pnpm -F web test` / `pnpm -F server test`。
- 始终使用 **pnpm**(`pnpm@11.10.0`),禁止 npm/yarn 混用。
- 测试须在 CI 与本地都可无副作用运行:不依赖真实网络、不写生产数据库。

## 前端测试(React + TanStack Router + shadcn/ui)

- 组件测试用 **Vitest + @testing-library/react**,配合 `jsdom`/`happy-dom` 环境。
- 按用户可见行为断言(角色、文本、可访问名),**不测实现细节**;查询优先 `getByRole`/`getByLabelText`。
- 覆盖键盘与鼠标交互;表单(`@tanstack/react-form`)须测校验错误态与提交态。
- tRPC/`@tanstack/react-query` 调用在测试中 **mock 传输层**(mock tRPC client 或 MSW),不打真实后端。
- Router 相关组件用 TanStack Router 的测试工具或内存 history 渲染,避免依赖真实路由挂载。

## 后端测试(Hono + tRPC + Prisma + Better-Auth)

- tRPC procedure 优先做**单元测试**:直接构造 caller(`router.createCaller(ctx)`)调用,断言输入校验(Zod)、输出与错误码。
- Hono 路由用 `app.request()` 做集成测试,校验状态码、响应体与鉴权中间件。
- 认证相关(Better-Auth)测试须覆盖:未登录拒绝、会话有效、越权访问;敏感分支必测。
- Prisma 访问在单元测试中 mock;需要真库时使用独立测试数据库(如 SQLite 或临时 schema),用例前后清理数据,**绝不指向开发/生产库**。
- 数据库集成测试标注为独立分组,允许在无 DB 环境下跳过而不使单元测试失败。

## 断言与用例质量

- 断言写在 `it()` / `test()` 内;异步用 `async/await`,不用 done 回调。
- 禁止提交 `.only` / `.skip`;`describe` 嵌套保持扁平(≤2 层)。
- 每个用例聚焦单一行为,用 `arrange-act-assert` 组织;优先覆盖边界条件与错误路径,而非仅 happy path。
- 测试代码同样遵守 Ultracite/Biome 规范,提交前运行 `pnpm run check`。
