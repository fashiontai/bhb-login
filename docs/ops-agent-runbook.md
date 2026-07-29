# Observer Agent 运维手册

## 1. 当前范围

第一版 Observer Agent 只读观测，不执行回滚、重启 ECS、重放 DLQ 或其他生产变更。

```text
CloudWatch Alarm State Change
  -> EventBridge default bus
  -> Ops SNS Topic
  -> Ops SQS Queue
  -> Ops DLQ（连续失败 3 次）
  -> Observer Agent Lambda
  -> CloudWatch Logs
```

Observer Agent 收集以下信息：

- CloudWatch 告警当前状态和指标元数据。
- Node/Hono Lambda `live` Alias 当前版本和路由配置。
- Go ECS Cluster/Service 的运行数、期望数、待处理数和部署状态。
- Go ALB Target Group 的健康状态数量。
- Aurora PostgreSQL Cluster 状态、版本和实例成员。
- GitHub profile 主队列和 DLQ 的可见、处理中、延迟消息数量。

结构化日志事件类型为 `ops.observation.completed`。当前记录写入 Observer Lambda 的 CloudWatch Log Group，后续 Triage Agent 再消费该事件或日志。

## 2. 代码位置

- Agent 代码：`apps/ops-agent/src/observer.ts`
- 单元测试：`apps/ops-agent/test/observer.test.mjs`
- 独立 SAM 栈：`infra/ops-agent.yaml`
- 独立部署工作流：`.github/workflows/deploy-ops-agent.yml`
- 主栈输出：`template.yaml`

## 3. 本地验证

```bash
CI=true pnpm install --frozen-lockfile
pnpm --filter ops-agent check-types
pnpm --filter ops-agent test
AWS_DEFAULT_REGION=ap-northeast-1 sam validate --lint --template infra/ops-agent.yaml
```

测试只验证事件解析，不会调用 AWS，也不会修改云端资源。

## 4. 首次部署前置

先重新部署 `infra/github-actions-deploy-role.yaml`，让 GitHub OIDC Role 拥有 EventBridge 规则的创建、更新和删除权限。Observer Lambda 本身使用由 SAM 创建的独立执行角色，只包含 CloudWatch、ECS、ALB、Lambda Alias、RDS Cluster 和 SQS 的读取权限。

主栈必须已经存在以下资源和 Outputs：

- Node/Hono API Lambda。
- Go ECS Cluster、Service 和 ALB Target Group。
- Aurora PostgreSQL Cluster。
- GitHub profile 主队列和 DLQ。

推送包含 Observer Agent 的提交后，`Deploy Observer Agent` 工作流会：

1. 构建并打包 `apps/ops-agent`。
2. 读取主栈资源 Outputs。
3. 校验并部署 `bhb-login-ops` 独立栈。
4. 输出 Ops Topic、Queue、DLQ 和 Observer Lambda 名称。

## 5. 验证事件链路

部署成功后，先确认：

1. EventBridge 规则 `bhb-login-ops-AlarmStateChangeRule-*` 为 `ENABLED`。
2. Ops SNS Topic 存在 SQS 订阅。
3. Ops SQS Queue 存在 Lambda 消费映射。
4. CloudWatch Log Group `/aws/lambda/bhb-login-ops-observer` 有日志。

可通过 CloudWatch Alarm 的真实状态变化触发一次观测。不要为了测试故意破坏生产服务；后续可以增加一个独立的测试 EventBridge 事件注入流程。

## 6. 安全边界

- Observer Agent 没有 `lambda:UpdateFunctionCode`、`lambda:UpdateAlias`、`ecs:UpdateService`、`ecs:StopTask` 或 DLQ 重放权限。由于它由 SQS 触发，执行角色仅使用 `ReceiveMessage`、`DeleteMessage`、`ChangeMessageVisibility` 和 `GetQueueAttributes` 完成消息消费确认。
- Ops Queue 与既有 GitHub profile 业务队列分开，避免运维事件和业务事件互相影响。
- 后续增加 Triage、Release、Queue/Database Agent 时，继续保持每个 Agent 独立 IAM Role 和独立消费链路。
