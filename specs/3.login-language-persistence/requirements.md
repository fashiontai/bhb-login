# login-language-persistence — 需求规格

## 概述

记录用户登录时的页面语言并落库到用户档案，下次登录后自动把界面语言恢复为用户上次的选择；已登录时切换语言同步更新档案。

## 项目信息

- 项目名: bhb-login
- 架构类型: monorepo（pnpm workspaces + Turborepo；Better Auth additionalFields + Prisma）

## 需求版本

| 日期       | 版本 | 说明     |
| ---------- | ---- | -------- |
| 2026-07-05 | v1   | 初始需求 |

## 用户故事

- 作为用户，我希望系统记住我登录时使用的语言，下次登录自动用同样的语言展示。
- 作为已登录用户，切换语言后我的偏好被保存，换设备登录也能恢复。

## 功能需求

1. [F-001] `User` 模型新增 `language` 字段（`"zh-CN" | "en-US"`），默认 `zh-CN`。
2. [F-002] Better Auth 通过 `user.additionalFields` 暴露 `language`，注册时可写入当前页面语言。
3. [F-003] 登录 / 注册时记录当前页面语言到用户档案。
4. [F-004] 会话加载后，用用户档案中的 `language` 恢复界面语言（并同步 localStorage）。
5. [F-005] 已登录状态切换语言时，调用更新接口同步 `language` 到用户档案。

## 非功能需求

- 性能: 语言恢复在会话加载后一次性完成，避免界面语言闪烁多次。
- 安全: `language` 仅允许受控枚举值，服务端/校验层拒绝非法值。
- 兼容性: 未登录用户仍沿用 localStorage 逻辑；无 `language` 的历史用户回退默认 `zh-CN`。

## 验收标准

- [ ] [AC-001] 数据库 `user` 表存在 `language` 列，默认 `zh-CN`，migration 可执行。
- [ ] [AC-002] 用户以英文界面登录后，`user.language` 记录为 `en-US`。
- [ ] [AC-003] 该用户退出后重新登录，界面自动恢复为 `en-US`（无需手动切换）。
- [ ] [AC-004] 已登录时切换语言，刷新/重登后偏好仍为最后一次选择。
- [ ] [AC-005] 非法 language 值被拒绝，历史无值用户回退 `zh-CN` 不报错。

## 依赖

- `1.user-auth-core`（登录态与鉴权基线，`3.T-* 依赖 1.T-001`）
- Prisma + PostgreSQL（`@bhb-login/db`，`db:generate` / `db:push`）
- Better Auth `additionalFields` 与 `updateUser`
- 现有 i18n（`apps/web/src/i18n.tsx` 的 `LanguageProvider`、`Locale`）

## 开放问题

- 无（已确认：落库并下次自动恢复，见 `specs/PLAN.md`）。
