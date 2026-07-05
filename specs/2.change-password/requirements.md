# change-password — 需求规格

## 概述

为已登录用户提供真实的「修改密码」能力（当前密码 + 新密码），替换前端目前的 mock 占位，入口放在 `/dashboard` 内的修改密码卡片。

## 项目信息

- 项目名: bhb-login
- 架构类型: monorepo（pnpm workspaces + Turborepo；Better Auth 提供 changePassword）

## 需求版本

| 日期       | 版本 | 说明     |
| ---------- | ---- | -------- |
| 2026-07-05 | v1   | 初始需求 |

## 用户故事

- 作为已登录用户，我想在控制台内用当前密码验证后设置新密码，以便保障账户安全。
- 作为双语用户，我想看到中英文一致的改密表单与校验/结果提示。

## 功能需求

1. [F-001] 在 `/dashboard` 展示「修改密码」卡片，包含当前密码、新密码、确认新密码三个字段。
2. [F-002] 提交调用 Better Auth `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions })`。
3. [F-003] 表单校验：当前密码非空；新密码 ≥ 8 位；确认新密码与新密码一致；新密码不等于当前密码。
4. [F-004] 结果反馈：成功 toast 并清空表单；失败（当前密码错误等）toast 可读的国际化错误。
5. [F-005] 移除/替换前端原改密相关 mock（`passwordResetNotConfigured` 占位改由真实改密入口承担；与 `1.F-007` 协同）。
6. [F-006] 改密成功默认 `revokeOtherSessions=true`，注销其他设备会话。

## 非功能需求

- 性能: 提交态禁用按钮防重复提交。
- 安全: 新密码 ≥ 8 位；不在日志输出密码明文；依赖服务端校验当前密码。
- 兼容性: 中英文文案一致；卡片在移动端可用。

## 验收标准

- [ ] [AC-001] 已登录用户在 dashboard 可见修改密码卡片并成功改密。
- [ ] [AC-002] 当前密码错误时显示可读错误提示，不改动密码。
- [ ] [AC-003] 新密码 < 8 位、两次不一致、与当前密码相同时表单阻止提交并提示。
- [ ] [AC-004] 改密成功后可用新密码重新登录；旧密码登录失败。
- [ ] [AC-005] 未登录时不可访问改密入口（受 `_auth` 守卫保护）。

## 依赖

- `1.user-auth-core`（登录态与 Better Auth 基线，`2.T-* 依赖 1.T-001`）
- Better Auth `changePassword`（emailAndPassword）
- `packages/ui`（Button、AuthField/Input 复用）

## 开放问题

- 无（改密方式与入口已确认，见 `specs/PLAN.md`）。
