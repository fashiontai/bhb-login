---
description: Git 分支、提交、PR 与合并规范（Turborepo + pnpm monorepo）
---

# Git 工作流规范

本项目为 monorepo（Turborepo + pnpm workspace），单一主干分支为 `main`，远程为 `origin`。以下规范适用于 `apps/*`、`packages/*` 下所有模块（frontend / backend / database）。

## 分支策略

- `main` 为受保护主干，禁止直接向 `main` 推送；所有变更通过分支 + PR 合入。
- 从最新 `main` 切分支：`git switch -c <type>/<scope>-<desc>`。
- 分支命名：`<type>/<scope>-<简短描述>`，全小写、用连字符。
  - `type`：`feat` | `fix` | `refactor` | `chore` | `docs` | `test` | `perf`。
  - `scope`：受影响模块，取包名简写，如 `web`、`server`、`db`。
  - 示例：`feat/web-login-form`、`fix/server-trpc-session`、`chore/db-prisma-migrate`。
- 一个分支只做一件事；跨模块的关联改动可同分支，但需在提交里分层表达。

## 提交信息（Conventional Commits）

- 格式：`<type>(<scope>): <subject>`，subject 用祈使句、不超过 72 字符、结尾不加句号。
- `type` 取值同分支；`scope` 用包名简写（`web` / `server` / `db` / `env` / `config`），跨包省略 scope。
- 正文（可选）说明「为什么」，与标题空一行；破坏性变更用 `BREAKING CHANGE:` 脚注。
- 示例：
  - `feat(web): add better-auth sign-in flow`
  - `fix(server): guard tRPC context when session is null`
  - `chore(db): add prisma migration for user table`
- 提交保持原子化：一次提交对应一个可独立回滚的逻辑单元；不要把生成物（`generated/`、`dist/`、`.turbo/`）混入功能提交。

## 提交前检查（本地门禁）

提交前必须在仓库根执行并全部通过（本项目未配置 husky pre-commit，需手动或由 agent 自觉执行）：

- `pnpm check`（等价 `ultracite check`）— Biome lint + format 校验；可用 `pnpm fix` 自动修复。
- `pnpm check-types`（`turbo run check-types`）— 全量 TypeScript 类型检查。
- 涉及 Prisma schema 变更时，先跑 `pnpm db:generate` 再提交，确保 client 与 schema 一致；schema 改动配套 `pnpm db:migrate` 生成的 migration 一并提交。
- 利用 Turborepo 缓存与过滤只验证受影响包，例如 `pnpm check-types -F web` / `-F server` / `-F @bhb-login/db`。

## Pull Request

- 目标分支为 `main`；标题沿用 Conventional Commits 的 `<type>(<scope>): <subject>`。
- PR 描述包含：变更目的、影响的模块（frontend / backend / database）、验证方式（跑过的命令）、关联需求或 issue。
- 数据库相关 PR 必须在描述中标注是否含 migration，以及是否需要执行 `pnpm db:migrate` / `pnpm db:push`。
- 合并策略：优先 Squash merge 保持 `main` 线性历史；合并后删除源分支。
- 用 `gh` CLI 操作 PR（创建、评审、查状态）。

## 约束

- 仅在用户明确要求时才执行 commit / push；若当前在 `main`，先切分支再改动。
- 不提交密钥与环境文件：`.env*` 已被 `.gitignore` 忽略，敏感配置走 `@bhb-login/env`，禁止硬编码。
- 不提交构建产物与缓存（`dist/`、`.turbo/`、`node_modules/`、Prisma `generated/`）。
- 不使用交互式 git 子命令（`git rebase -i`、`git add -i`）。
