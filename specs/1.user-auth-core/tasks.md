# user-auth-core — 任务清单

## 任务版本

| 日期       | 版本 | 说明     |
| ---------- | ---- | -------- |
| 2026-07-05 | v1   | 初始任务 |

## 项目信息

- 项目名: bhb-login
- 架构类型: monorepo（pnpm workspaces + Turborepo）
- specs 路径: specs/1.user-auth-core/

## 任务列表

### 功能 1: 鉴权配置

- [x] T-001: [backend] `packages/auth` 显式配置 `emailAndPassword.requireEmailVerification=false`，核对注册后自动建立会话 ~15min

### 功能 2: 错误国际化映射

- [x] T-002: [frontend] 新增 `apps/web/src/lib/auth-error.ts` 错误码→文案映射，并在 `i18n.tsx` 补充 `authErrors` 中英文文案 ~30min
- [x] T-003: [frontend] `sign-in-form.tsx` / `sign-up-form.tsx` 的 `onError` 接入 `mapAuthError`，覆盖邮箱已存在/无效凭据/密码过短 ~30min

### 功能 3: 守卫与退出回归

- [x] T-004: [frontend] 会话守卫与退出登录回归核对：`_auth` 守卫、`signOut` 成功后失效会话并跳转 `/login` ~15min

### 功能 4: 登录页占位清理

- [x] T-005: [frontend] `sign-in-form.tsx` 移除「忘记密码」占位入口并清理对应 i18n key，保留 Google 占位 ~15min

### 集成与测试

- [x] T-006: [test] 端到端核验：注册→自动进入 dashboard→退出→登录→未登录访问 dashboard 重定向 ~30min

## 依赖关系

- T-003 依赖 T-002
- T-006 依赖 T-001、T-003、T-004、T-005
- 本 feature 是 2、3 的前置：`2.T-*` 与 `3.T-*` 依赖 `1.T-001`（鉴权基线）

## 风险点

- Better Auth 版本默认注册行为若变化（是否自动会话），需以实际 `signUp.email` 返回为准调整。
- 退出后 `getSession` 缓存导致守卫短暂放行 → 在 `signOut` 成功回调中触发路由/会话失效。
- 错误码字段命名依赖 Better Auth 返回结构，映射需对 `code` 与 `message` 双重兜底。
