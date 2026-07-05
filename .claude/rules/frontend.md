---
description: 前端开发规范（React + TanStack Router + TailwindCSS + shadcn/ui），适用于 apps/web
globs: apps/web/**/*.{ts,tsx,css}
---

# 前端规范（apps/web）

## 技术栈

- 构建：Vite 8 + `@vitejs/plugin-react`；语言 TypeScript（`type: module`）。
- 路由：TanStack Router（文件路由，`@tanstack/router-plugin`），路由树自动生成到 `src/routeTree.gen.ts`，禁止手改。
- 数据层：TanStack Query + tRPC（`@trpc/tanstack-react-query`），类型从 `@bhb-login/api` 导入。
- 表单：TanStack Form（`@tanstack/react-form`）+ `zod` 校验。
- 样式：TailwindCSS v4（`@tailwindcss/vite`）+ shadcn/ui（style `base-lyra`，baseColor `neutral`，图标库 `lucide-react`）。
- 认证：Better-Auth React 客户端（`src/lib/auth-client.ts`）。
- Toast：`sonner`。

## 目录与文件路由

- 页面路由放在 `src/routes/`，用 `createFileRoute` 定义；受保护页面放在 `src/routes/_auth/` 布局下。
- 根路由 `src/routes/__root.tsx`；新增路由后由插件生成 `routeTree.gen.ts`，不要手动编辑该文件。
- 可复用组件放 `src/components/`，工具放 `src/utils/`、`src/lib/`。

## 导入别名（保持一致，勿写相对路径穿越）

- `@/*` → `apps/web/src`（本应用内部：components、lib、utils、i18n）。
- `@bhb-login/ui/components/*` → 共享 shadcn/ui 组件（如 `Button`、`AuthShell`）。
- `@bhb-login/ui/lib/utils` → `cn` 等工具；`@bhb-login/api` → tRPC 路由类型；`@bhb-login/env/web` → 环境变量。
- UI 组件优先复用 `packages/ui`，不要在 `apps/web` 内重复实现基础组件。

## 数据获取（tRPC + Query）

- 统一用 `src/utils/trpc.ts` 导出的 `trpc`（options proxy）、`trpcClient`、`queryClient`，不要另建客户端实例。
- 组件内通过 `useQuery(trpc.xxx.queryOptions(...))` / `useMutation(trpc.xxx.mutationOptions(...))` 调用，避免手写 fetch。
- 全局错误已在 `QueryCache.onError` 用 `toast.error` + 重试处理；请求默认 `credentials: "include"`。
- 后端 URL 一律取自 `env.VITE_SERVER_URL`，不要硬编码地址。

## 认证

- 客户端用 `authClient`（`src/lib/auth-client.ts`）；登录/注册表单参考 `sign-in-form.tsx` / `sign-up-form.tsx`。
- 受保护路由在 `_auth/route.tsx` 布局中做会话校验与重定向，页面组件不重复实现鉴权。

## 国际化（i18n）

- 文案统一走 `@/i18n`：组件内用 `useLanguage()` 的 `t`，非组件上下文用 `getRuntimeTranslations()`。
- 禁止在 JSX/逻辑中硬编码可见文案字符串，一律接入翻译字典。

## React / 组件规范

- 只用函数组件；Hooks 只在顶层调用，依赖数组写全；列表项用稳定唯一 `key`（勿用数组下标）。
- 不在组件内部定义子组件；children 通过标签嵌套传递而非 prop。
- 用语义化 HTML 与 ARIA：图片 alt、表单 label、标题层级、键盘事件与鼠标事件并存。
- React 19：用 ref 作为 prop，勿用 `forwardRef`。

## 样式

- 用 Tailwind 原子类；条件类名用 `cn`（`@bhb-login/ui/lib/utils`）合并，勿手工拼接 className 字符串。
- 全局样式与 CSS 变量在 `packages/ui/src/styles/globals.css`；主题走 CSS variables，勿写内联颜色魔法值。
- 新增 shadcn 组件用 CLI 添加到 `packages/ui`，遵循既有 `components.json` 配置。

## 质量约束

- 提交前运行 `pnpm run check`（Ultracite/Biome）；类型检查 `pnpm run check-types`（`vite build && tsc --noEmit`）。
- 生产代码不留 `console.log`、`debugger`、`alert`；`target="_blank"` 链接加 `rel="noopener"`。
- 优先 `unknown` 而非 `any`；用可选链 `?.` 与空值合并 `??`；`const` 优先，禁 `var`。
