# user-auth-core — 技术设计

## 设计版本

| 日期       | 版本 | 说明     |
| ---------- | ---- | -------- |
| 2026-07-05 | v1   | 初始设计 |

## 项目架构

- 架构类型: monorepo（pnpm workspaces + Turborepo）
- 涉及层:
  - 后端鉴权: `packages/auth`（Better Auth 实例）、`apps/server`（Hono 挂载 `/api/auth/*`）
  - 前端: `apps/web`（TanStack Router 路由守卫、表单组件、i18n）
  - 公共 UI: `packages/ui`（AuthShell / AuthCard / AuthField，本 feature 不改动契约）

## 功能模块设计

### 模块 1: 鉴权配置（无邮箱验证 / 无邮箱绑定）

在 `packages/auth/src/index.ts` 的 `betterAuth({...})` 中显式声明不要求邮箱验证，保证注册后自动会话：

```ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: false, // 暂不考虑邮箱验证/绑定，注册后可直接使用
},
```

**涉及层及关键设计:**
- 不新增数据库字段；沿用 `User/Session/Account`。
- 注册走 `authClient.signUp.email`（Better Auth 默认注册后建立会话），前端保持现有 `navigate('/dashboard')`。

### 模块 2: 登录/注册错误国际化映射

Better Auth 在 `onError` 回调返回 `error.error.message / code / statusText`。当前直接把英文 message 丢进 toast。改为在前端建立错误码 → i18n 文案的映射函数，未命中时回退原 message。

**涉及层及关键设计:**
- 新增 `apps/web/src/lib/auth-error.ts`：`mapAuthError(error, t): string`，识别常见场景（邮箱已存在 / 无效凭据 / 密码过短）。
- `i18n.tsx` 的 `validation` 或新增 `authErrors` 段补充中英文文案（`emailExists`、`invalidCredentials`、`unknown`）。
- `sign-in-form.tsx` / `sign-up-form.tsx` 的 `onError` 改为 `toast.error(mapAuthError(error, t))`。

### 模块 3: 会话守卫与退出登录回归

现状已具备：`apps/web/src/routes/_auth/route.tsx` 的 `beforeLoad` 用 `authClient.getSession()` 判定并 `redirect('/login')`；`dashboard.tsx` 用 `authClient.signOut` 后跳转。本模块以核对/加固为主。

**涉及层及关键设计:**
- 核对退出后 `getSession` 立即失效（必要时在 `signOut` 成功回调后 `router.invalidate()` 或强制刷新会话）。
- 核对 `/` → `/login` 重定向、`/dashboard` 未登录重定向链路。

### 模块 4: 登录页占位清理

`sign-in-form.tsx` 移除「忘记密码」按钮（对应 `forgotPassword` / `passwordResetNotConfigured`）；保留 Google 占位（`GoogleButton` + `googleNotConfigured` toast）。

**涉及层及关键设计:**
- 删除 password 字段的 `action` 内「忘记密码」`Button`。
- i18n 中 `signIn.forgotPassword` / `signIn.passwordResetNotConfigured` 文案随之移除（或保留 key 不引用，优先移除以避免死代码）。

## 接口契约

- 复用 Better Auth 内置 HTTP 端点（`/api/auth/sign-in/email`、`/api/auth/sign-up/email`、`/api/auth/sign-out`、`/api/auth/get-session`），本 feature 不新增自定义 tRPC procedure。
- 前端契约：`authClient.signIn.email` / `signUp.email` / `signOut` / `getSession` / `useSession`。

## 数据模型

- 无新增。沿用 `packages/db/prisma/schema`（User / Session / Account / Verification）。

## 安全考虑

- 密码最小长度 8（zod 校验，前后端一致语义）。
- 遵循 `.claude/CLAUDE.md`：不在生产代码保留 `console.log`；`throw Error` 使用 Error 对象；`target="_blank"` 加 `rel="noopener"`（footer 链接如启用）。
- Cookie 属性沿用 `advanced.defaultCookieAttributes`（httpOnly/secure/sameSite=none）。

## 技术决策

| 决策             | 选项                                   | 理由                                     |
| ---------------- | -------------------------------------- | ---------------------------------------- |
| 是否邮箱验证     | 关闭（requireEmailVerification:false） | PRD 明确暂不考虑邮箱绑定，注册即用       |
| 错误提示实现     | 前端映射函数 + i18n                    | 后端 Better Auth 错误码稳定，前端映射轻量 |
| 忘记密码占位     | 移除                                   | 邮件重置依赖邮箱绑定，超出本期范围        |
| Google 占位      | 保留为「暂未配置」                     | 预留未来 OAuth，不引入实际依赖            |
