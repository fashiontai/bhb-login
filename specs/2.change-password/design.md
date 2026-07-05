# change-password — 技术设计

## 设计版本

| 日期       | 版本 | 说明     |
| ---------- | ---- | -------- |
| 2026-07-05 | v1   | 初始设计 |

## 项目架构

- 架构类型: monorepo（pnpm workspaces + Turborepo）
- 涉及层:
  - 前端: `apps/web`（Dashboard 卡片、改密表单组件、i18n、校验）
  - 鉴权: Better Auth 内置 `changePassword`，**无需自定义后端 procedure**
  - 公共 UI: `packages/ui`（复用 Button、Input/AuthField；如需独立 Field 保持业务在 web 层）

## 功能模块设计

### 模块 1: 修改密码表单组件

新增 `apps/web/src/components/change-password-form.tsx`，使用 `@tanstack/react-form` + `zod`，字段 `currentPassword` / `newPassword` / `confirmPassword`。

**涉及层及关键设计:**
- 校验 schema（zod）：
  - `currentPassword`: 非空
  - `newPassword`: `min(8)`
  - `confirmPassword`: 与 `newPassword` 相等（`refine` / 表单级校验）
  - 新密码 ≠ 当前密码（表单级 `refine`）
- 字段复用现有 `AuthField`（`type="password"`），风格与登录表单一致。
- 提交态用 `form.Subscribe` 禁用按钮，文案走 i18n（`submitting`）。

### 模块 2: 接入 Better Auth changePassword

在提交回调调用：

```ts
await authClient.changePassword(
  {
    currentPassword: value.currentPassword,
    newPassword: value.newPassword,
    revokeOtherSessions: true,
  },
  {
    onSuccess: () => { toast.success(t.changePassword.success); form.reset(); },
    onError: (error) => { toast.error(mapAuthError(error, t)); },
  }
);
```

**涉及层及关键设计:**
- 复用 `1.user-auth-core` 的 `mapAuthError`（新增「当前密码错误」映射键 `invalidCurrentPassword`）。
- 成功后 `form.reset()` 清空三字段。

### 模块 3: Dashboard 集成与 mock 清理

在 `apps/web/src/routes/_auth/dashboard.tsx` 的卡片区新增「修改密码」卡片，渲染 `ChangePasswordForm`。

**涉及层及关键设计:**
- Dashboard 由 `_auth` 守卫保护，天然满足「未登录不可访问」（AC-005）。
- 与 `1.F-007` 协同：登录页「忘记密码」占位已移除；本 feature 提供登录态真实改密，不再有 `passwordResetNotConfigured` mock 语义遗留。

### 模块 4: i18n 文案

`i18n.tsx` 新增 `changePassword` 段（中英文）：标题、字段 label/placeholder、submit/submitting、success，以及 `validation` 补充 `passwordMismatch`、`newPasswordSameAsCurrent`。

## 接口契约

- 复用 Better Auth `POST /api/auth/change-password`（由 `authClient.changePassword` 封装）。
- 无新增 tRPC procedure。

## 数据模型

- 无新增字段。改密写入 `Account.password`（Better Auth 内部处理）。

## 安全考虑

- 服务端由 Better Auth 校验 `currentPassword`，前端不做真伪判断。
- 新密码 ≥ 8 位（与注册一致）。
- `revokeOtherSessions=true` 降低改密后旧会话被滥用风险。
- 不在前端日志输出任何密码字段。

## 技术决策

| 决策           | 选项                              | 理由                                   |
| -------------- | --------------------------------- | -------------------------------------- |
| 改密方式       | 登录态 currentPassword+newPassword | 无邮箱绑定，changePassword 最贴合      |
| 入口位置       | Dashboard 内改密卡片              | 改动最小、天然受守卫保护、可直接验证    |
| 其他会话处理   | revokeOtherSessions=true          | 改密后失效旧会话，更安全                |
| 后端是否改动   | 否，复用内置端点                  | Better Auth 已提供，避免重复实现        |
