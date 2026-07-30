# Synthetics 巡检 Agent 运维手册

## 巡检范围

生产栈中的 `HealthCanary` 每 5 分钟检查三个 HTTPS 入口：

- `https://fashiontai.online`：Cloudflare Pages 前端
- API Gateway 的 `/api/hello`：Node/Hono Lambda
- `https://go-api.fashiontai.online/health`：Go ECS Fargate 服务

Canary 代码、执行角色、S3 产物桶和 CloudWatch Alarm 都由 `template.yaml` 管理。巡检截图和日志保留在 S3/CloudWatch 中，不直接暴露给公网。

## 事件链路

```text
CloudWatch Synthetics
  -> CloudWatchSynthetics/Failed 指标
  -> HealthCanaryFailureAlarm
  -> EventBridge Alarm State Change
  -> Observer Agent
  -> Triage Agent
  -> Release/Approval Agent
  -> SNS 邮件通知
```

巡检失败只触发观测、分析和通知，不会自动重启 ECS、回滚 Lambda 或修改数据库。

## 开启方式

在 GitHub `production` Environment Variables 中设置：

```text
ENABLE_HEALTH_CANARY=true
```

然后运行 `Deploy AWS Backend` 工作流。首次部署会创建：

- `bhb-login-health` Synthetics Canary
- Synthetics 产物 S3 Bucket
- Canary 执行 IAM Role
- `HealthCanaryFailureAlarm` CloudWatch Alarm

## 验证

查看 Canary：

```bash
aws synthetics get-canary \
  --profile bhb-new \
  --region ap-northeast-1 \
  --name bhb-login-health
```

查看 Alarm：

```bash
aws cloudwatch describe-alarms \
  --profile bhb-new \
  --region ap-northeast-1 \
  --alarm-names bhb-login-HealthCanaryFailureAlarm \
  --query 'MetricAlarms[0].{State:StateValue,Metric:MetricName,Namespace:Namespace}' \
  --output table
```

预期结果：

- Canary 状态为 `RUNNING`
- 三个检查步骤均成功
- Alarm 状态为 `OK`
- CloudWatch Logs 中可看到 Canary 执行日志
- Synthetics 控制台中可查看成功执行记录

## 故障验证

不要为了测试故意破坏生产域名。先使用 CloudWatch Synthetics 控制台的单次运行和 AWS 日志确认执行链路；真正的失败场景应在独立 PR 环境验证。

当 Alarm 进入 `ALARM` 时，到以下位置查看：

1. CloudWatch Alarm 的 State reason。
2. Synthetics Canary 的失败步骤、日志和截图。
3. `/aws/lambda/bhb-login-ops-observer`。
4. `/aws/lambda/bhb-login-ops-triage`。
5. `/aws/lambda/bhb-login-ops-release`。
6. SNS 邮箱通知。

恢复后 Canary 连续成功，Alarm 会回到 `OK`。恢复事件目前只记录在 CloudWatch，不发送邮件。
