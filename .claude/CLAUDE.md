# 项目简介

`bhb-login` 是一个基于 Better Auth 的登录系统，提供登录、注册、会话守卫、退出登录与中英文切换能力。前端采用 monorepo 结构，业务页面位于 `apps/web`，可复用 UI 组件位于 `packages/ui`。

## 技术栈与基础设施

本项目以 **AWS 云端资源** 为主承载。主要技术栈说明见架构图：https://www.processon.com/view/link/62e77f4f7d9c08072e6eea09

### 使用的 AWS 架构资源

| 分类 | 服务 | 用途 |
| --- | --- | --- |
| 身份与权限 | IAM、IAM Identity Center、Key Management Service (KMS) | 身份认证、访问控制、密钥管理 |
| 计算 | EC2、Lambda | 服务器实例与无服务器函数 |
| 接入与网络 | API Gateway、VPC | API 网关与私有网络隔离 |
| 存储 | S3 | 对象存储 |
| 数据库 | Aurora and RDS | 关系型数据库 |
| 事件与集成 | Amazon EventBridge | 事件总线与集成 |
| AI 服务 | Amazon Bedrock、Amazon Q、Amazon Q Business、Amazon Q Developer | 大模型与 AI 助手能力 |
| 运维与成本 | Billing and Cost Management | 账单与成本管理 |

### 环境变量配置

开发过程中新增或依赖的运行参数必须写入项目根目录 `.env`。暂时无法确定真实值时，先写占位值，便于本地启动、类型校验和后续部署对齐；不要把真实密钥、Token、密码等敏感信息写入文档或代码。

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm dlx ultracite fix` before committing to ensure compliance.

---

# 常用命令

| 场景 | 命令 |
| --- | --- |
| 安装依赖 | `pnpm install` |
| 启动全部开发服务 | `pnpm run dev` |
| 仅启动前端 / 后端 | `pnpm run dev:web` / `pnpm run dev:server` |
| 构建 | `pnpm run build` |
| 类型检查 | `pnpm run check-types` |
| 代码检查 / 自动修复 | `pnpm run check` / `pnpm run fix` |
| Prisma 生成 / 推送 / 迁移 / Studio | `pnpm run db:generate` / `db:push` / `db:migrate` / `db:studio` |

> 包管理器固定为 `pnpm@11.10.0`；任务编排由 Turborepo 驱动，跨包过滤用 `-F <package>`。

# 目录结构

```
bhb-login/
├── apps/
│   ├── web/          # 前端 (React + TanStack Router + Vite + TailwindCSS + shadcn/ui)
│   └── server/       # 后端 (Hono + tRPC, Node.js 运行时)
├── packages/
│   ├── api/          # tRPC 路由与 procedure 定义
│   ├── auth/         # Better-Auth 认证配置
│   ├── db/           # Prisma ORM (schema / client / migration)
│   ├── env/          # 环境变量校验 (zod)
│   ├── config/       # 共享 TS / 构建配置
│   └── ui/           # 可复用 UI 组件库 (shadcn/ui)
├── docs/             # 需求与设计文档 (PRD)
├── specs/            # 结构化开发规格 (requirements / design / tasks)
└── .claude/          # Claude 项目配置 (本文件 / rules)
```

# 开发规范（按需引入）

> 按当前 task 触达的模块/文件类型，动手前阅读对应规则；不必一次性全读。

- @rules/coding-style.md — 编码风格（Ultracite + Biome 2.x + TS strict，全栈通用）
- @rules/frontend.md — 前端规范（React + TanStack Router + TailwindCSS + shadcn/ui，`apps/web`）
- @rules/backend-api.md — 后端 API 规范（Hono + tRPC + Better-Auth + Prisma 的 procedure/认证/context/错误处理）
- @rules/database.md — 数据库与数据模型规范（Prisma + PostgreSQL，`packages/db`）
- @rules/security.md — 安全规范（认证、授权、密钥、输入校验、CORS/Cookie）
- @rules/testing.md — 测试规范（前后端测试组织、命名与运行约定）
- @rules/git-workflow.md — Git 分支、提交、PR 与合并规范

# 引用

> 以下文件记录项目开发中的踩坑与教训，会随开发持续追加，动手前请先阅读。

@AGENTS.md
