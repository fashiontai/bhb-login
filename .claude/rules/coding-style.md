---
description: bhb-login 编码风格规范，基于 Ultracite + Biome 2.x 与 TypeScript strict，覆盖前后端全栈
globs: ["**/*.ts", "**/*.tsx"]
---

# 编码风格规范

本项目为 Turborepo + pnpm workspace 全栈 monorepo（React + TanStack Router 前端 / Hono + tRPC 后端 / Prisma + Better-Auth），统一由 **Ultracite**（Biome `2.4.16` 引擎）强制格式化与 lint。所有规则均可由工具自动校验，提交前必须通过。

## 命令

- 检查:`pnpm run check`（等价 `ultracite check`）
- 修复:`pnpm run fix`（等价 `ultracite fix`）
- 类型检查:`pnpm run check-types`
- 提交前务必先运行 `pnpm run fix`,确保无 lint / 格式化残留

## 格式化(Biome 强制)

- 缩进使用 **Tab**,不使用空格(`indentStyle: tab`)
- 字符串使用 **双引号**(`quoteStyle: double`)
- 保留自闭合元素(`<Foo />` 而非 `<Foo></Foo>`)
- 导入自动排序(`organizeImports: on`),不手动调整 import 顺序
- 生成文件不纳入规范:`routeTree.gen.ts`、`prisma/generated`、`dist`、`.turbo` 等已在 `biome.json` 忽略,不要手改

## TypeScript

- 全局 `strict` + `strictNullChecks`,不引入宽松 tsconfig 覆盖
- 用 `unknown` 替代 `any`;类型确需断言时优先类型收窄而非 `as`
- 不写可被推断的冗余类型注解(`noInferrableTypes`)
- 不可变字面量用 `as const`(`useAsConstAssertion`)
- `enum` 成员必须显式初始化(`useEnumInitializers`)
- 用有意义的常量名替代魔法数字

## 现代 JS/TS 写法

- 默认 `const`,需重新赋值才用 `let`,禁止 `var`
- 禁止对函数参数重新赋值(`noParameterAssign`);带默认值的参数放最后(`useDefaultParameterLast`)
- 单条 `var`/`let`/`const` 只声明一个变量(`useSingleVarDeclarator`)
- 用 `for...of` 替代 `.forEach()` 与索引 `for`
- 用可选链 `?.` 与空值合并 `??` 做安全访问
- 用模板字符串替代字符串拼接;不写无插值的模板字符串(`noUnusedTemplateLiteral`)
- 用解构做对象/数组赋值
- 用早返回消除嵌套;`if` 已 return 后不写 `else`(`noUselessElse`)
- 使用 `Number.parseInt` 等 Number 命名空间方法(`useNumberNamespace`)

## 异步

- async 函数内必须 `await` promise,不遗漏返回值
- 用 `async/await` 替代 promise 链
- 异步代码用 try-catch 处理错误;不把 async 函数用作 Promise executor

## React / 前端(TanStack + Tailwind + shadcn/ui)

- 只用函数组件;hooks 只在顶层调用,不条件调用
- hooks 依赖数组需完整正确(`useExhaustiveDependencies` 为 info,仍应修正)
- 列表元素用稳定唯一 `key`,避免用数组索引
- 不在组件内部定义组件;children 用嵌套写法而非 prop 传入
- React 19+ 用 ref 作为 prop,不用 `React.forwardRef`
- 语义化 HTML + ARIA:图片有 alt、表单有 label、交互用 `<button>`/`<nav>` 而非带 role 的 div、鼠标事件配键盘事件
- **Tailwind class 必须保持排序**(`useSortedClasses`),类名拼接只用 `cn` / `clsx` / `cva` 三个函数以便自动排序生效

## 后端(Hono + tRPC + Prisma + Better-Auth)

- 服务端数据获取放在服务端,不用 async 客户端组件绕行
- Prisma 生成产物(`prisma/generated`)不手改,通过 schema + `pnpm run db:generate` 维护
- tRPC procedure 的输入用 zod 校验;校验并清洗一切外部输入

## 错误处理与调试

- 生产代码移除 `console.log`、`debugger`、`alert`
- 抛出 `Error` 对象并带清晰信息,不抛字符串
- try-catch 要有实际处理,不为转抛而 catch
- 错误分支优先早返回,避免深层嵌套

## 安全

- `target="_blank"` 的链接加 `rel="noopener"`
- 非必要不用 `dangerouslySetInnerHTML`
- 禁止 `eval()` 与直接给 `document.cookie` 赋值
- 校验并清洗用户输入

## 性能

- 循环累加器中不用展开语法
- 正则字面量提到循环外/顶层
- 优先具名导入而非命名空间导入;避免 barrel 文件(全量 re-export 的 index)

## 命名与组织

- 函数保持单一职责,控制认知复杂度
- 复杂条件抽取为具名布尔变量
- 相关代码聚合,关注点分离
- 优先自解释代码,复杂逻辑才加注释
