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

# 项目踩坑与教训(AGENTS.md)

> 供后续 task 与人类开发者读，只记对后续开发有复用价值的坑/约定/前置步骤/配置陷阱。

- [T-001] Better Auth 的 `emailAndPassword` 里，「注册后是否自动建立会话」由 `autoSignIn`(默认 `true`)控制，「注册前是否强制邮箱验证」由 `requireEmailVerification`(默认 `false`)控制——两者是独立开关，别混淆。本项目不做邮箱验证：显式写 `requireEmailVerification: false` 以表明意图（默认值也是 false，但显式声明避免后续误改），`autoSignIn` 保持默认即注册成功后直接返回会话、无需再手动登录。
- [T-002] Better Auth 客户端 `onError` 回调的入参多嵌套一层：真正带 `code`/`message`/`statusText` 的对象在 `ctx.error.error` 上，而不是 `ctx.error` 本身（见 sign-in-form.tsx:50 / sign-up-form.tsx:46，design.md 第36行也写明 `error.error.message/code/statusText`）。`mapAuthError(error, t)` 接收的是解开一层后的对象，调用点必须写成 `mapAuthError(error.error, t)`，直接传外层对象会永远匹配不到错误码、只走 fallback。错误码常量来源是 `BASE_ERROR_CODES`（`better-auth/core`），映射表 key 用大写常量名。
- [T-004] 所有 `authClient` 鉴权调用（`signIn`/`signUp`/`signOut` 等）的 `fetchOptions` 必须 `onSuccess` + `onError` 成对出现，别只写 `onSuccess`。项目约定见 sign-in-form.tsx:43-51、sign-up-form.tsx:39-45，退出登录同样要给出网络错误/5xx 的用户反馈，否则会话可能未真正失效但页面看似已退出、用户无感知——这是 review 反复指出的反模式。
- [T-004] 把 better-auth 的 `onSuccess` 回调改成 `async` 并在里面 `await`（如 `await router.invalidate()`）时，务必包一层 try/catch：回调抛错会变成 better-auth 内部的未捕获异常，跳过后续的 `navigate({ to: '/login' })`，导致签出成功却停在原页面。兜底做法是 catch 后照样执行跳转。
- [T-003] Better Auth 对「用户视角同一种错误」会返回**多个不同的错误码**，`AUTH_ERROR_CODE_MAP`（`apps/web/src/lib/auth-error.ts`）必须做**多对一**映射：登录失败一类要同时覆盖 `CREDENTIAL_ACCOUNT_NOT_FOUND`/`INVALID_EMAIL_OR_PASSWORD`/`INVALID_PASSWORD`/`USER_NOT_FOUND` → `invalidCredentials`，邮箱已存在要覆盖 `USER_ALREADY_EXISTS`/`USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` → `emailExists`；只映一个码会漏掉服务端在不同配置/路径下抛的其它同义码、退回 fallback 文案。另外为防「拿到未知码或 code 缺失」，`mapAuthError` 兜底顺序固定为 `error.message → error.statusText → authErrors.unknown`，新增错误场景优先补 map、不要在组件 onError 里写分支判断。
- [T-005] i18n 文案是「单一数据源 + 强类型契约」：`apps/web/src/i18n.tsx` 顶部的 `AppTranslations` interface 定义结构，底部 `translations` 对象用 `satisfies Record<Locale, AppTranslations>` 约束。**增删任何一个文案 key 必须三处同改**——interface 声明、`zh-CN`、`en-US`，漏改任一 locale 或 interface 都会 tsc 报错。删 key（如本 task 移除 `signIn.forgotPassword`）时先在组件里删掉所有引用点，再从这三处同步删除；只删组件不删定义会留下死 key，只删定义不删组件会编译失败。
- [T-006] 受登录保护的页面守卫统一放在 `_auth` 布局路由的 `beforeLoad`（`apps/web/src/routes/_auth/route.tsx`）：`await authClient.getSession()` 后判断 `session.data`（会话真身在 `.data` 上，getSession 返回 `{ data, error }`，不能直接 `if (!session)`），无会话就 `throw redirect({ to: '/login' })`，并 `return { session }` 供子路由复用。**新增需登录的页面一律放进 `apps/web/src/routes/_auth/` 目录、不要每个页面各自写守卫**；根路由 `/`（index.tsx）只做 `throw redirect` 到 `/login`，不承载内容。
- [T-004] Better Auth 会在**不同 endpoint 复用同一个错误码但语义相反**：`POST /api/auth/change-password` 在 `currentPassword` 不匹配时抛的仍是 `INVALID_PASSWORD`，和 sign-in 完全同码，但文案该是「当前密码错误」而非「邮箱或密码错误」。解法不是在全局 `AUTH_ERROR_CODE_MAP` 里改这个码（会污染登录），而是给 `mapAuthError(error, t, context?)` 加一个可选 `context`（如 `"changePassword"`），用独立的 `CHANGE_PASSWORD_ERROR_CODE_MAP` 做**作用域覆盖**：命中 scoped map 优先、否则回落全局 map、再回落 message/statusText/unknown。新增「同码不同义」的流程时照此加 context 分支，别去动全局映射表。这与 T-003 的「多码同义→合并」是对偶关系，别混用。
- [T-006] 环境/前置步骤陷阱：任何触达真实写库的运行时核验（注册/登录/退出，即 `POST /api/auth/*`）之前，必须先启动 PostgreSQL 并执行 `pnpm db:push` 应用 User/Session/Account schema，否则请求直接 500（`localhost:5432 ECONNREFUSED`）。本沙箱默认没有 PG/psql 二进制、Docker 守护也未运行——静态检查与「不写库的运行时核验」能过，但注册→自动进 dashboard→退出→登录这类 E2E 写库链路必须人工先备好数据库才能验证，别把此类 AC 当作可在纯沙箱内自动跑通。
- [T-006] 纯端到端核验类 task（如「当前密码错误报错 / 改密后新密码重登 / 旧密码登录失败」）在沙箱内无法自动跑通时，**不能只在 tasks.md 里打 `[x]` 就算完**——review 会因为「无任何自动化测试文件、也无人工核验记录留痕」而无法核实勾选可信度。落实做法：要么补 Vitest/Playwright 用例（可标独立分组、无 DB 时跳过而不 fail），要么在 tasks.md / PR 描述里写清人工核验步骤与结果（谁、在什么环境、执行了哪几步、观察到什么）。写库 E2E 的 AC 至少要留下可复核的验证轨迹，别让勾选变成无根据的自我声明。参考落地：`apps/server/e2e/change-password.e2e.mjs`（`node:test`，预检碰库请求非 200 即整体 skip，`pnpm -F server test:e2e` 运行）+ `specs/2.change-password/VERIFICATION.md`（人工核验记录）。
- [T-deploy] `apps/server` 用 tsdown 打包，**默认只 bundle workspace 包（`noExternal: [/@bhb-login\/.*/]`），第三方依赖（better-auth/hono/@trpc/zod 等）会被 external**。而 SAM `template.yaml` 的 `ApiFunction.CodeUri` 只上传 `apps/server/dist/`、不含 `node_modules`，因此外部化的依赖在 Lambda 冷启动即报模块解析错误。解法：tsdown 配置改 `noExternal: [/.*/]` 全量打包，使 `dist/` 自包含（Prisma 7 的 `prisma-client` generator + `@prisma/adapter-pg` 是无引擎二进制的，其 WASM 查询编译器会作为 `.mjs` 资产一并产出到 `dist/`，随 CodeUri 上传，无需额外拷贝）。`@opentelemetry/api` 是 better-auth 的可选动态 import，未安装时被其内部兜底、非致命。**验证手法**：把 `dist/*.mjs` 拷到一个只放 `{"type":"module"}`、无 `node_modules` 的临时目录，设 `AWS_LAMBDA_FUNCTION_NAME` 后 `import('./index.mjs')` 并用 APIGW v2 事件调 `handler`——能返回 200 即证明产物自包含（入口的 `if (!process.env.AWS_LAMBDA_FUNCTION_NAME)` 本地 serve 分支在 Lambda 下不会执行）。

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
