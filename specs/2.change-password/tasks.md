# change-password — 任务清单

## 任务版本

| 日期       | 版本 | 说明     |
| ---------- | ---- | -------- |
| 2026-07-05 | v1   | 初始任务 |

## 项目信息

- 项目名: bhb-login
- 架构类型: monorepo（pnpm workspaces + Turborepo）
- specs 路径: specs/2.change-password/

## 任务列表

### 功能 1: 改密表单与校验

- [x] T-001: [frontend] 新增 `change-password-form.tsx`（当前/新/确认密码字段 + 提交按钮，复用 AuthField/Button）~30min
- [x] T-002: [frontend] 表单 zod 校验：当前密码非空、新密码≥8、两次一致、新≠当前 ~30min

### 功能 2: 接入 Better Auth 改密

- [ ] T-003: [frontend] 提交接入 `authClient.changePassword({currentPassword,newPassword,revokeOtherSessions:true})`，成功清空表单/失败映射错误 ~30min

### 功能 3: i18n 文案

- [x] T-004: [shared] `i18n.tsx` 新增 `changePassword` 中英文文案及 `validation` 的 mismatch/sameAsCurrent，`mapAuthError` 增补 `invalidCurrentPassword` ~15min

### 功能 4: Dashboard 集成

- [x] T-005: [frontend] `dashboard.tsx` 新增「修改密码」卡片渲染 `ChangePasswordForm`，与退出登录并列 ~15min

### 集成与测试

- [ ] T-006: [test] 端到端核验：当前密码错误报错、成功改密后用新密码重登、旧密码登录失败 ~30min

## 依赖关系

- T-003 依赖 T-001、T-004
- T-005 依赖 T-001
- T-006 依赖 T-002、T-003、T-005
- 跨 feature：本 feature 全部任务依赖 `1.T-001`（鉴权基线）；错误映射复用 `1.T-002` 的 `mapAuthError`

## 风险点

- Better Auth `changePassword` 入参/回调结构随版本差异 → 以实际 SDK 类型为准。
- `mapAuthError` 为 feature 1 产出，若并行开发需先落地 `1.T-002` 或临时内联映射。
- `revokeOtherSessions=true` 会使当前测试的其他标签页会话失效，测试时注意。
