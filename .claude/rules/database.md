---
description: 数据库与数据模型规范（Prisma + PostgreSQL，位于 packages/db）
globs: packages/db/**
---

# 数据库规范

## 技术栈与位置

- 数据库:PostgreSQL,ORM:Prisma 7(`@prisma/client` + `prisma`)。
- 所有数据库代码集中在 `packages/db`,包名 `@bhb-login/db`,其它包通过 workspace 依赖引用,禁止在 `apps/*` 里直连数据库或散落 Prisma 实例。
- 采用 Prisma Driver Adapter:通过 `@prisma/adapter-pg`(`PrismaPg`)+ `pg` 连接,而非默认引擎连接串。新建/改连接必须走 `src/index.ts` 的 `createPrismaClient()`。

## Prisma Client 使用

- 只从 `@bhb-login/db` 导入默认导出的 `prisma` 单例;不要在业务代码中 `new PrismaClient()`。
- 生成的 Client 输出到 `packages/db/prisma/generated`(generator `provider = "prisma-client"`,ESM,`runtime = "nodejs"`),该目录为产物,不手改、不提交无关变更。
- 连接串来自 `@bhb-login/env` 的 `env.DATABASE_URL`,禁止硬编码或用 `process.env` 直接读取,保持环境变量校验一致。

## Schema 组织

- 使用多文件 schema:所有模型放在 `packages/db/prisma/schema/` 目录下(如 `schema.prisma` 存 datasource/generator,`auth.prisma` 存认证模型)。按领域拆分文件,不要把所有模型堆进单个文件。
- `datasource db` 只声明 `provider = "postgresql"`;认证相关模型(User/Session/Account/Verification)由 Better-Auth 约定,改动需与 Better-Auth 配置保持同步,不要随意重命名字段或去掉 `@@map`。

## 建模约定

- 每个模型用 `@@map("snake_case")` 映射到 snake_case 表名;模型名用 PascalCase 单数,字段用 camelCase。
- 主键统一 `id String @id`(应用层/Better-Auth 生成 id);时间戳统一 `createdAt DateTime @default(now())` 与 `updatedAt DateTime @updatedAt`。
- 唯一约束用 `@@unique([...])`,并为常用外键/查询字段加 `@@index([...])`(如 `userId`、`identifier`、`token`)。
- 关系外键显式声明 `onDelete`(如子表随主表删除用 `onDelete: Cascade`),避免遗留孤儿数据。

## 迁移与命令(在 packages/db 内执行)

- 开发迁移:`pnpm --filter @bhb-login/db db:migrate`(`prisma migrate dev`),每次 schema 变更都要生成 migration,禁止只 `db push` 到共享/生产环境。
- 快速原型/本地:`db:push`(`prisma db push`)仅限本地临时验证,不作为正式变更手段。
- 重新生成 Client:`db:generate`(`prisma generate`);改完 schema 后必须重新生成,保证类型同步。
- 可视化查看:`db:studio`(`prisma studio`)。
- migration 文件一经提交视为不可变,修正走新的 migration,不要编辑历史迁移。

## 安全与性能

- 一律使用 Prisma Client 参数化查询;如需 `$queryRaw`/`$executeRaw`,必须用模板标签形式传参,禁止字符串拼接 SQL。
- 列表查询默认分页(`take`/`skip` 或 cursor),避免全表扫描;只 `select` 需要的字段。
- 多步写操作用 `prisma.$transaction` 保证原子性。
- 严禁把真实连接串、密码写入代码或提交到仓库,统一走环境变量。
