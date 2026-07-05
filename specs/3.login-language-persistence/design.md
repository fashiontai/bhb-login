# login-language-persistence — 技术设计

## 设计版本

| 日期       | 版本 | 说明     |
| ---------- | ---- | -------- |
| 2026-07-05 | v1   | 初始设计 |

## 项目架构

- 架构类型: monorepo（pnpm workspaces + Turborepo）
- 涉及层:
  - 数据库: `packages/db`（Prisma `User.language` 字段 + migration）
  - 鉴权: `packages/auth`（Better Auth `user.additionalFields.language`）
  - 前端: `apps/web`（登录/注册携带 locale、会话加载后恢复语言、切换时同步、`i18n.tsx`）

## 功能模块设计

### 模块 1: 数据模型扩展

在 `packages/db/prisma/schema` 的 `User` 增加：

```prisma
language String @default("zh-CN")
```

**涉及层及关键设计:**
- 运行 `pnpm db:generate` 重新生成 Prisma Client，`pnpm db:push`（或 migrate）落库。
- 历史行由默认值补齐 `zh-CN`，满足回退要求（AC-005）。

### 模块 2: Better Auth 暴露 language

在 `packages/auth/src/index.ts` 增加用户附加字段：

```ts
user: {
  additionalFields: {
    language: { type: "string", required: false, defaultValue: "zh-CN", input: true },
  },
},
```

**涉及层及关键设计:**
- `input: true` 允许注册时随 `signUp.email` 传入 `language`。
- 允许通过 `authClient.updateUser({ language })` 更新（登录后同步 / 切换时同步）。
- 服务端/前端限制取值 `"zh-CN" | "en-US"`，非法值回退默认。

### 模块 3: 登录/注册时记录语言

- 注册：`sign-up-form.tsx` 的 `signUp.email` 调用附带当前 `locale`（来自 `useLanguage()`）。
- 登录：`signIn.email` 不接受自定义档案字段，登录成功回调后调用 `authClient.updateUser({ language: locale })` 记录本次页面语言。

**涉及层及关键设计:**
- 统一取 `useLanguage().locale` 作为「当前页面语言」。
- 更新失败不阻断登录主流程（吞掉错误或轻提示）。

### 模块 4: 会话加载后恢复语言

会话内含 `user.language`。在 `LanguageProvider` 或应用初始化处，当检测到已登录且 `user.language` 与当前 `locale` 不一致时，`setLocale(user.language)` 并写回 localStorage。

**涉及层及关键设计:**
- 在能访问 session 的层（如 `__root` 或 `_auth` 布局，或一个 `useSyncUserLanguage` hook）读取 `authClient.useSession()` 的 `data.user.language`。
- 恢复只在会话首次加载/切换用户时触发一次，避免与用户手动切换来回抖动（用「上次同步的 userId」做门控）。
- 未登录时不介入，沿用现有 localStorage 逻辑。

### 模块 5: 已登录切换语言时同步

`language-toggle.tsx`（或 `i18n.tsx` 的 `toggleLocale`）在已登录状态下切换后，调用 `authClient.updateUser({ language: nextLocale })`。

**涉及层及关键设计:**
- 判定登录态用 `authClient.useSession()`；未登录仅本地切换。
- 去抖/幂等：仅在值变化时发请求。

## 接口契约

- 注册：`authClient.signUp.email({ name, email, password, language })`（经 additionalFields）。
- 更新：`authClient.updateUser({ language })` → Better Auth `POST /api/auth/update-user`。
- 会话：`authClient.useSession()` / `getSession()` 返回的 `user.language`。
- 无新增自定义 tRPC procedure。

## 数据模型

```prisma
model User {
  // ...existing fields
  language String @default("zh-CN") // "zh-CN" | "en-US"
}
```

## 安全考虑

- `language` 值域受控（枚举校验），拒绝任意字符串写入。
- `updateUser` 仅作用于当前会话用户，无越权风险。
- 不因缺失/非法 language 抛未处理异常（回退默认）。

## 技术决策

| 决策             | 选项                            | 理由                                       |
| ---------------- | ------------------------------- | ------------------------------------------ |
| 存储位置         | User.language 字段              | 需跨设备恢复，必须落库而非仅 localStorage   |
| 暴露方式         | Better Auth additionalFields    | 与注册/更新/会话天然打通，避免自建接口      |
| 登录时写入方式   | 登录成功后 updateUser           | signIn 不接受档案字段，回调更新最简         |
| 恢复触发点       | 会话加载后一次性 setLocale      | 避免与用户手动切换抖动，用 userId 门控      |
| 历史数据兼容     | default("zh-CN") + 回退         | 无值用户不报错，平滑升级                    |
