# login-language-persistence — 任务清单

## 任务版本

| 日期       | 版本 | 说明     |
| ---------- | ---- | -------- |
| 2026-07-05 | v1   | 初始任务 |

## 项目信息

- 项目名: bhb-login
- 架构类型: monorepo（pnpm workspaces + Turborepo）
- specs 路径: specs/3.login-language-persistence/

## 任务列表

### 功能 1: 数据模型扩展

- [ ] T-001: [db] Prisma `User` 增加 `language String @default("zh-CN")`，`db:generate` + `db:push` 落库 ~15min

### 功能 2: 鉴权字段暴露

- [ ] T-002: [backend] `packages/auth` 配置 `user.additionalFields.language`（input:true、default zh-CN），核对注册/更新可写 ~30min

### 功能 3: 登录/注册记录语言

- [ ] T-003: [frontend] 注册 `signUp.email` 携带当前 `locale`；登录成功回调调用 `updateUser({language})` 记录本次语言 ~30min

### 功能 4: 会话加载后恢复语言

- [ ] T-004: [frontend] 新增 `useSyncUserLanguage`：会话加载后按 `user.language` `setLocale` 并写回 localStorage，用 userId 门控防抖 ~30min

### 功能 5: 切换时同步

- [ ] T-005: [frontend] 已登录状态切换语言时调用 `updateUser({language})` 同步档案（仅值变化时请求）~15min

### 集成与测试

- [ ] T-006: [test] 端到端核验：英文登录→user.language=en-US→退出→重登自动恢复英文；切换后重登保留 ~30min

## 依赖关系

- T-002 依赖 T-001
- T-003 依赖 T-002
- T-004 依赖 T-002
- T-005 依赖 T-002
- T-006 依赖 T-003、T-004、T-005
- 跨 feature：本 feature 全部任务依赖 `1.T-001`（鉴权基线）；`i18n.tsx` 的 locale 逻辑复用现有实现

## 风险点

- Better Auth additionalFields 是否随 `useSession()` 返回 `user.language` 需实测；若未透出需在 session/context 显式 select。
- 恢复语言与用户手动切换的时序冲突 → 用「上次同步 userId」门控，仅切换用户/首次加载时恢复。
- Prisma 生成产物路径为 `packages/db/prisma/generated`，改 schema 后务必重新 `db:generate` 避免类型不同步。
