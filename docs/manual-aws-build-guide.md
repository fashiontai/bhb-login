# bhb-login 部署与运维手册

> 适用仓库：`fashiontai/bhb-login`
>
> 生产区域：`ap-northeast-1`
>
> 更新日期：2026-07-25

本手册说明如何从当前仓库验证、部署、观察和清理 `bhb-login`。不要同时在 AWS Console 手工创建一套同名资源；生产资源统一由 SAM/CloudFormation 管理。

## 1. 资源清单

### 1.1 Cloudflare

| 资源 | 值 |
| --- | --- |
| Pages Project | `bhb-login` |
| 自定义域名 | `fashiontai.online` |
| Pages 域名 | `bhb-login.pages.dev` |
| 构建命令 | `pnpm --filter web build` |
| 输出目录 | `apps/web/dist` |
| Root directory | `/` |

### 1.2 AWS

生产 Stack `bhb-login` 管理：

- VPC、Internet Gateway、两个公有子网、两个私有子网。
- NAT Gateway、路由表和安全组。
- API Gateway HTTP API。
- Hono API Lambda 和 Migration Lambda。
- Aurora PostgreSQL Serverless v2、DB Subnet Group、Secrets Manager。
- SSM Bastion。
- ECR Repository。
- ECS Cluster、Fargate Service、Task Definition、CloudWatch Log Group。
- Cloud Map Private DNS Namespace 和 Service。
- 公网 ALB、HTTP/HTTPS Listener、Target Group 和路由规则。

IAM Stack `bhb-login-github-actions-role` 管理 GitHub OIDC Provider 和部署角色 `github-actions-bhb-login`。

PR Stack 使用 `bhb-login-pr-<number>` 命名，并在 PR 关闭或合并时自动删除。

## 2. 本地前置条件

```bash
node --version
pnpm --version
go version
aws --version
sam --version
docker --version
session-manager-plugin --version
```

当前流水线基线：

- Node.js 24
- pnpm 11.10.0
- Go 版本读取 `apps/go-profile/go.mod`
- Python 3.12（安装 SAM CLI）
- Docker Buildx，目标平台 `linux/arm64`

确认 AWS 身份：

```bash
aws sts get-caller-identity \
  --profile bhb-new \
  --region ap-northeast-1
```

不要在仓库中保存 Access Key、数据库密码、Better Auth Secret、GitHub Token 或 Cloudflare API Token。

## 3. 本地环境变量

开发参数写入根目录 `.env`，未知值可先使用占位符：

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bhblogin
BETTER_AUTH_SECRET=replace-with-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
GO_INTERNAL_SERVICE_TOKEN=replace-with-random-64-hex-characters
GO_PROFILE_SERVICE_URL=http://localhost:8080
GO_PROFILE_SERVICE_NAMESPACE=bhb-login.local
VITE_SERVER_URL=http://localhost:3000
VITE_GO_PROFILE_URL=http://localhost:8080
```

生成随机内部 Token 不会修改任何系统配置：

```bash
openssl rand -hex 32
```

## 4. 本地验证

安装依赖时 Prisma 配置具有本地占位 URL，不要求连接真实生产数据库：

```bash
pnpm install --frozen-lockfile
pnpm run check
```

验证 Node 服务：

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/bhblogin' \
pnpm --filter server check-types

DATABASE_URL='postgresql://postgres:postgres@localhost:5432/bhblogin' \
pnpm --filter server build
```

验证前端：

```bash
VITE_SERVER_URL='http://localhost:3000' \
VITE_GO_PROFILE_URL='http://localhost:8080' \
pnpm --filter web check-types
```

验证 Go：

```bash
cd apps/go-profile
go test ./...
go vet ./...
cd ../..
```

验证 SAM：

```bash
sam validate --lint \
  --profile bhb-new \
  --region ap-northeast-1 \
  --template template.yaml

sam build \
  --template-file template.yaml \
  --parallel
```

## 5. Cloudflare Pages 配置

Cloudflare Dashboard 路径：`Workers & Pages -> bhb-login -> Settings -> Builds & deployments`。

生产和 Preview 都需要：

```text
NODE_VERSION=24
VITE_SERVER_URL=https://sh590qarl2.execute-api.ap-northeast-1.amazonaws.com
VITE_GO_PROFILE_URL=https://go-api.fashiontai.online
```

`apps/web/vite.config.ts` 会在 Cloudflare Preview 构建中读取 `CF_PAGES_BRANCH` 并生成 `VITE_PREVIEW_ID`，不需要为每个 PR 手工添加该变量。

生产域名：

- `fashiontai.online`
- `bhb-login.pages.dev`

`go-api.fashiontai.online` 的 DNS 指向 AWS ALB。ACM 验证记录必须保持有效。

## 6. GitHub Environment 配置

GitHub 路径：`Settings -> Environments -> production`。

### 6.1 Secrets

| 名称 | 用途 |
| --- | --- |
| `AWS_ROLE_TO_ASSUME` | GitHub OIDC 要 Assume 的 Role ARN |
| `BETTER_AUTH_SECRET` | Better Auth 服务端密钥，至少 32 字符 |
| `GO_INTERNAL_SERVICE_TOKEN` | Lambda 调 Go 内部接口的 Token |

### 6.2 Variables

| 名称 | 示例/默认值 |
| --- | --- |
| `AWS_REGION` | `ap-northeast-1` |
| `SAM_STACK_NAME` | `bhb-login` |
| `DATABASE_NAME` | `bhblogin` |
| `DATABASE_USERNAME` | `bhbadmin` |
| `DATABASE_MIN_CAPACITY` | `0.5` |
| `DATABASE_MAX_CAPACITY` | `1` |
| `FRONTEND_ORIGIN` | `https://fashiontai.online` |
| `GO_PROFILE_PUBLIC_DOMAIN` | `go-api.fashiontai.online` |
| `GO_PROFILE_CERTIFICATE_ARN` | ACM 证书 ARN |
| `CLOUDFLARE_PAGES_DOMAIN` | `bhb-login.pages.dev` |

数据库密码由 CloudFormation 创建的 Secrets Manager Secret 生成，不作为 GitHub Secret 传递。

## 7. 创建或更新 GitHub OIDC Role

先验证模板：

```bash
aws cloudformation validate-template \
  --profile bhb-new \
  --region ap-northeast-1 \
  --template-body file://infra/github-actions-deploy-role.yaml
```

部署 IAM Stack：

```bash
aws cloudformation deploy \
  --profile bhb-new \
  --region ap-northeast-1 \
  --stack-name bhb-login-github-actions-role \
  --template-file infra/github-actions-deploy-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOrg=fashiontai \
    GitHubRepo=bhb-login \
    GitHubBranch=main \
    GitHubEnvironment=production \
    RoleName=github-actions-bhb-login
```

读取 Role ARN：

```bash
aws cloudformation describe-stacks \
  --profile bhb-new \
  --region ap-northeast-1 \
  --stack-name bhb-login-github-actions-role \
  --query "Stacks[0].Outputs[?OutputKey=='GitHubDeployRoleArn'].OutputValue" \
  --output text
```

把输出写入 GitHub Secret `AWS_ROLE_TO_ASSUME`。

## 8. 生产部署流程

`.github/workflows/deploy-aws-sam.yml` 在 `main` 的后端相关文件变化时触发，也支持手动 `workflow_dispatch`。

执行顺序：

1. 安装 pnpm、Node、Go、Python、SAM 和 Buildx。
2. 校验必需的 GitHub Secret/Variable。
3. 通过 OIDC Assume `github-actions-bhb-login`。
4. 执行 Ultracite、TypeScript 检查、Go test/vet。
5. 构建 Node Lambda 并校验 SAM。
6. 读取当前 Go 镜像，先部署基础 Stack。
7. 调用 `${STACK_NAME}-migrate` Lambda 执行数据库迁移。
8. Buildx 构建 ARM64 Go 镜像并推送 ECR，Tag 为 Git SHA 和 `latest`。
9. 第二次 SAM 部署，把 ECS Task Definition 切换到新 SHA 镜像。
10. 等待 ECS 滚动部署和 ALB 健康检查完成。

查看运行：

```bash
gh run list --repo fashiontai/bhb-login --workflow deploy-aws-sam.yml
gh run watch <run-id> --repo fashiontai/bhb-login --exit-status
```

手动触发：

```bash
gh workflow run deploy-aws-sam.yml \
  --repo fashiontai/bhb-login \
  --ref main
```

## 9. 读取生产 Stack 输出

```bash
aws cloudformation describe-stacks \
  --profile bhb-new \
  --region ap-northeast-1 \
  --stack-name bhb-login \
  --query 'Stacks[0].Outputs' \
  --output table
```

常用 Output：

- `ApiUrl`
- `GoProfilePublicUrl`
- `GoProfileInternalUrl`
- `GoProfileRepositoryUri`
- `GoProfileClusterName`
- `DatabaseEndpoint`
- `DatabaseCredentialsSecretArn`
- `BastionInstanceId`
- `DatabaseTunnelCommand`

Stack 正常状态应为 `CREATE_COMPLETE` 或 `UPDATE_COMPLETE`。

## 10. 生产验收

验证 Node：

```bash
curl -fsS https://sh590qarl2.execute-api.ap-northeast-1.amazonaws.com/
curl -fsS https://sh590qarl2.execute-api.ap-northeast-1.amazonaws.com/api/hello
```

验证 Go：

```bash
curl -fsS https://go-api.fashiontai.online/health
curl -fsS https://go-api.fashiontai.online/ready
curl -fsS \
  'https://go-api.fashiontai.online/public/v1/introductions/fashiontai?locale=zh-CN'
```

验证前端：

```bash
curl -fsSI https://fashiontai.online
curl -fsSI https://bhb-login.pages.dev
```

验证 ECS：

```bash
aws ecs describe-services \
  --profile bhb-new \
  --region ap-northeast-1 \
  --cluster bhb-login-go-profile \
  --services bhb-login-go-profile \
  --query 'services[0].[desiredCount,runningCount,pendingCount,deployments[0].rolloutState]' \
  --output json
```

期望结果是 `1, 1, 0, COMPLETED`。

## 11. 本地连接 Aurora

先从 Stack Output 复制最新命令，不要把 Endpoint 或 Bastion ID 写死：

```bash
aws cloudformation describe-stacks \
  --profile bhb-new \
  --region ap-northeast-1 \
  --stack-name bhb-login \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseTunnelCommand'].OutputValue" \
  --output text
```

在终端 A 执行返回的 `aws ssm start-session` 命令，保持会话不关闭。该命令将本地 `15432` 转发到 Aurora `5432`。

在终端 B 使用 `psql`：

```bash
psql 'postgresql://<username>:<password>@127.0.0.1:15432/bhblogin?sslmode=require'
```

从 Secrets Manager 读取凭据需要相应 IAM 权限。不要把读取结果粘贴到 Issue、Actions Log 或文档。

关闭隧道：回到终端 A 按 `Ctrl+C`。

## 12. PR 独立环境

### 12.1 创建和更新

同仓库 PR 的 `opened`、`synchronize`、`reopened` 事件触发 `deploy-pr-preview.yml`：

1. 校验 PR 来自当前仓库且创建者是 `fashiontai`。
2. 通过生产 GitHub Environment 的 OIDC Role 登录 AWS。
3. 读取生产 Stack 的共享 VPC、ALB、ECS、Cloud Map、Aurora 和 IAM Output。
4. 测试 Go 并构建 `pr-<number>-<sha>` 镜像。
5. 部署 `bhb-login-pr-<number>`。
6. 运行 Go `migrate` 一次性 Task，创建 `pr_<number>` schema。

Cloudflare Pages 同时构建前端 Preview。Vite 自动生成 Preview ID，前端请求携带 `X-BHB-Preview`。

### 12.2 隔离范围

每个 PR 独立创建：

- ECS Service 和 Task Definition
- Cloud Map Service
- Security Group
- ALB Target Group 和 Header Listener Rule
- CloudWatch Log Group（保留 7 天）
- PostgreSQL Schema

生产 VPC、ECS Cluster、ALB、ECR、Aurora 和 Task Role 为共享资源。

### 12.3 验证

```bash
gh run list \
  --repo fashiontai/bhb-login \
  --workflow deploy-pr-preview.yml

aws cloudformation describe-stacks \
  --profile bhb-new \
  --region ap-northeast-1 \
  --stack-name bhb-login-pr-<number>
```

读取 Preview ID 后验证路由：

```bash
curl -fsS \
  -H 'X-BHB-Preview: <preview-id>' \
  https://go-api.fashiontai.online/health
```

### 12.4 自动清理

PR `closed` 或 `merged` 时：

1. Checkout 最新 `main`，避免删除后的 PR Ref 不可用。
2. 运行 Go `drop-schema` 一次性 Task。
3. 删除 `bhb-login-pr-<number>` Stack。
4. CloudFormation 删除 ECS、Cloud Map、ALB、SG 和日志资源。

检查 Stack 已删除：

```bash
aws cloudformation list-stacks \
  --profile bhb-new \
  --region ap-northeast-1 \
  --stack-status-filter DELETE_COMPLETE \
  --query "StackSummaries[?StackName=='bhb-login-pr-<number>'].[StackName,StackStatus,DeletionTime]" \
  --output table
```

## 13. 日志与排障

### 13.1 GitHub Actions 找不到 AWS 凭据

检查：

- Workflow 是否有 `permissions.id-token: write`。
- `AWS_ROLE_TO_ASSUME` 是否写在 `production` Environment。
- IAM Trust Policy 是否允许 `fashiontai/bhb-login` 和 `production` Environment。
- Workflow Job 是否声明 `environment: production`。

### 13.2 Cloudflare 构建时 Prisma 缺少 DATABASE_URL

`packages/db/prisma.config.ts` 已提供仅供生成 Client 的本地占位 URL。不要为了前端构建把生产 `DATABASE_URL` 放进 Cloudflare。

### 13.3 浏览器 CORS 报错

检查：

- GitHub Variable `FRONTEND_ORIGIN=https://fashiontai.online`。
- Cloudflare `VITE_SERVER_URL` 是否是当前 API Gateway URL。
- 请求是否错误调用旧 AWS 账号的 API URL。
- Better Auth 请求是否设置 `credentials: include`。
- API Gateway/Lambda 是否已经完成新配置部署。

### 13.4 Mixed Content 或 TLS 错误

前端只能调用 `https://go-api.fashiontai.online`，不能调用 ALB 的 HTTP DNS 名称。检查：

- ACM 证书状态为 `ISSUED`。
- Cloudflare DNS CNAME 指向当前 ALB。
- ALB HTTPS Listener 使用正确证书。
- ALB Security Group 允许 443。

### 13.5 ECS 长时间更新

先看 Service Events：

```bash
aws ecs describe-services \
  --profile bhb-new \
  --region ap-northeast-1 \
  --cluster bhb-login-go-profile \
  --services bhb-login-go-profile \
  --query 'services[0].events[0:10]' \
  --output table
```

然后检查 Target Group `/ready`、CloudWatch `/ecs/bhb-login/go-profile` 日志、Task 停止原因和 Secrets Manager 权限。滚动部署期间短暂出现两个运行 Task 是正常行为。

### 13.6 CloudFormation 失败

```bash
aws cloudformation describe-stack-events \
  --profile bhb-new \
  --region ap-northeast-1 \
  --stack-name bhb-login \
  --query 'StackEvents[0:20].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
  --output table
```

如果状态为 `UPDATE_ROLLBACK_FAILED`，先修复最早的权限或资源错误，再执行：

```bash
aws cloudformation continue-update-rollback \
  --profile bhb-new \
  --region ap-northeast-1 \
  --stack-name bhb-login
```

不要在回滚未完成时连续创建新 ChangeSet。

## 14. 成本控制

当前主要持续费用：

1. NAT Gateway 固定小时费和流量费。
2. Aurora Serverless v2 最低 `0.5 ACU`。
3. 公网 ALB 固定小时费和 LCU。
4. ECS Fargate 生产 Task。
5. SSM Bastion EC2（停止后可减少计算费）。

建议立即配置：

- AWS Budget 月度预算和邮件告警。
- Aurora、NAT、ALB 和 Fargate 成本标签。
- ECR Lifecycle Policy 清理旧 PR 镜像。
- CloudWatch 日志保留周期。
- PR 自动清理失败告警。

NAT 目前仍有真实用途：Lambda/Go 调用 GitHub API，Fargate 启动时访问 ECR/Logs/Secrets Manager。若以后改成 VPC Endpoint，仍要单独解决 GitHub 公网访问。

## 15. 资源清理

生产删除是高风险操作，只能在明确确认不再使用后执行。建议顺序：

1. 关闭所有 PR，确认 `bhb-login-pr-*` 已删除。
2. 备份 Aurora 或创建 Snapshot。
3. 删除生产 Stack `bhb-login`。
4. 确认 NAT Gateway、EIP、ALB、ECS、Aurora 和 Secrets Manager 的删除结果。
5. 最后删除 IAM Stack `bhb-login-github-actions-role`。
6. 删除 Cloudflare Pages Project 或自定义域名绑定。

不要先删除 GitHub Actions Role，否则 CloudFormation 可能失去删除旧资源所需的权限。

## 16. 当前验收清单

- [x] Cloudflare 生产域名可访问
- [x] Cloudflare Pages PR Preview 可构建
- [x] Node API `/` 和 `/api/hello` 可访问
- [x] Better Auth 注册登录可用
- [x] Go `/health` 和 `/ready` 可访问
- [x] Go 公开介绍接口可访问
- [x] Lambda 通过 Cloud Map 调用 Go
- [x] Lambda 和 ECS 位于私有子网且无公网 IP
- [x] Aurora 不公开，仅允许指定安全组
- [x] GitHub Actions 使用 OIDC 部署
- [x] 数据库迁移在生产部署中执行
- [x] PR Stack、ECS、Cloud Map、ALB Rule 和 Schema 自动创建
- [x] PR 合并后自动删除独立环境
- [x] CodeBuild 资源已移除
- [ ] AWS Budget 已配置
- [ ] CloudWatch 指标告警和通知已配置
- [ ] ECR PR 镜像自动清理策略已配置

## 17. 明确未使用的服务

当前没有部署以下服务：

- CodeBuild
- Bedrock
- CloudFront 前端托管
- SNS、SQS、DLQ
- X-Ray、Synthetics Canary
- EKS/Kubernetes
- AIOps Agent

新增这些服务前必须先有明确业务需求、成本估算和删除方案。
