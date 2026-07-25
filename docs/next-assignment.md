# 下一阶段作业

记录日期：2026-07-25  
计划继续日期：2026-07-26

## 当前基线

- 前端：Cloudflare Pages，生产域名 `https://fashiontai.online`
- Node API：API Gateway + Lambda（Hono）
- Go API：ECS Fargate + ALB，域名 `https://go-api.fashiontai.online`
- 服务发现：Lambda 通过 AWS Cloud Map 调用 Go 服务
- 数据库：Aurora PostgreSQL Serverless v2
- 日志：Lambda、ECS 已接入 Amazon CloudWatch Logs
- 部署：GitHub Actions 通过 OIDC 和 IAM Role 部署 AWS 资源
- 当前 Git 基线：`main`，提交 `af8cc95`

## 作业 1：AWS Synthetics 巡检

目标：使用 CloudWatch Synthetics Canary 定时巡检生产接口，并将结果接入 CloudWatch。

计划巡检地址：

- Node API 健康检查地址
- `https://go-api.fashiontai.online/health`
- 必要时增加前端 `https://fashiontai.online` 可用性检查

完成标准：

- Canary 可按计划运行并保留执行记录
- 成功时返回预期状态码和响应内容
- 失败时在 CloudWatch 中可看到截图、日志和失败原因
- Canary 配置纳入 SAM/CloudFormation，不只在控制台手工创建

## 作业 2：SNS、SQS 与死信队列场景

目标：基于当前 GitHub 个人介绍业务增加一个异步事件处理场景。

建议链路：

```text
生成或更新 GitHub 个人介绍
  -> SNS Topic 发布事件
  -> SQS 主队列订阅
  -> Event Worker Lambda 消费
  -> 处理成功：记录结果
  -> 多次处理失败：消息进入 SQS DLQ
```

完成标准：

- SNS Topic、SQS 主队列、DLQ 和消费 Lambda 由模板管理
- SNS 到 SQS 的订阅与队列策略正确
- 配置重试次数和 RedrivePolicy
- 能人工制造一条失败消息并确认最终进入 DLQ
- CloudWatch Logs 能追踪消息 ID、重试和失败原因

## 作业 3：API Canary 灰度上线

目标：为 API 新版本建立可回滚的灰度发布流程，避免一次性切换全部流量。

计划方案：

- Lambda 使用 Version + Alias
- SAM DeploymentPreference 配置 Canary 流量切换
- CloudWatch Alarm 作为自动回滚条件
- GitHub Actions 继续负责 SAM 部署

建议从 `Canary10Percent5Minutes` 开始：先将 10% 流量导入新版本，观察 5 分钟后再切换剩余流量。

完成标准：

- 部署时生成 Lambda 不可变版本和生产 Alias
- 灰度期间新旧版本按比例接收请求
- 错误率或告警触发时自动回滚
- 正常时自动完成全量切换
- 文档记录验证方式和回滚方式

## 执行顺序

1. 先完成 Synthetics 巡检，建立外部可用性检查。
2. 再实现 SNS、SQS、DLQ 异步链路及失败验证。
3. 最后使用监控告警支撑 API Canary 灰度和自动回滚。

## 明日开始点

从 `template.yaml` 和现有 CloudWatch 配置开始，先确认 Node API 的健康检查路径，再添加第一条 CloudWatch Synthetics Canary。
