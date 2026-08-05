# 性能采集与可视化

## 目标

本功能把浏览器性能指标送入 AWS，再由私有 ECS Fargate Worker 清洗后写入 Aurora PostgreSQL，最后由登录后的 `/performance` 页面查询统计结果。

```text
浏览器 SDK
  -> Hono Lambda /api/telemetry/events
  -> SQS performance-events
  -> ECS Fargate performance-processor
  -> Aurora performance_event
  -> Hono Lambda /api/performance/summary
  -> /performance 页面
```

失败消息在 SQS 重试 3 次后进入 `performance-events-dlq`。

## 已实现内容

- `packages/performance-sdk`：采集 page view、Navigation Timing、FCP、LCP、CLS、INP 和 API 请求耗时。
- `POST /api/telemetry/events`：校验批量性能事件，并投递到 SQS。
- `PerformanceEventsQueue` 与 `PerformanceEventsDlq`：原始事件缓冲和失败消息隔离。
- Go `processor` 命令：ECS 私有任务长轮询 SQS，批量写入 Aurora。
- `performance_event` 表：由现有 Migration Lambda 自动执行迁移。
- `GET /api/performance/summary?days=7`：登录后读取汇总数据。
- `/performance`：登录后查看总事件数、平均耗时、FCP、LCP、CLS、事件类型和热门路由。

采集接口会向 CloudWatch 写入 `performance.events.received` 结构化日志；完整事件正文保留在 SQS，避免把匿名标识和请求指标重复写入日志导致额外成本。

## 本地检查

先确保本地 PostgreSQL 已启动，并准备 `DATABASE_URL`：

```bash
DATABASE_URL='postgresql://bhbadmin:localpassword123456@localhost:5432/bhblogin' \
pnpm install --frozen-lockfile

DATABASE_URL='postgresql://bhbadmin:localpassword123456@localhost:5432/bhblogin' \
pnpm --filter @bhb-login/db db:generate

DATABASE_URL='postgresql://bhbadmin:localpassword123456@localhost:5432/bhblogin' \
pnpm run db:push

pnpm --filter @bhb-login/performance-sdk check-types
DATABASE_URL='postgresql://bhbadmin:localpassword123456@localhost:5432/bhblogin' \
pnpm --filter server check-types
VITE_SERVER_URL='http://localhost:3000' \
VITE_GO_PROFILE_URL='http://localhost:8080' \
VITE_PERFORMANCE_SAMPLE_RATE=1 \
pnpm --filter web check-types
```

启动前后端后访问登录页和受保护页面，浏览器会自动采集事件。没有配置 `PERFORMANCE_EVENTS_QUEUE_URL` 时，开发环境只会返回 `queued: false`，不会写入 AWS 队列；这是为了避免本地误投递生产数据。

## 部署前检查

```bash
sam validate --profile bhb-new --region ap-northeast-1 --template template.yaml
sam build --template-file template.yaml --parallel

cd apps/go-profile
go test ./...
go vet ./...
cd ../..
```

GitHub Actions 会构建 ARM64 Go 镜像、推送 ECR，再通过 SAM 更新 ECS 服务和 Lambda。性能 Worker 复用同一个 Go 镜像，但启动命令是 `processor`，没有 ALB、没有 Cloud Map 注册，也没有公网 IP。

## 启动 ECS 清洗 Worker

默认值是 `0`，因此只部署采集链路不会启动 Fargate Worker。需要启动时，在 GitHub 仓库设置：

`Settings` -> `Secrets and variables` -> `Actions` -> `Variables` -> `New repository variable`

```text
Name: PERFORMANCE_PROCESSOR_DESIRED_COUNT
Value: 1
```

然后推送后端改动或在 Actions 中重新运行部署 Workflow。Workflow 会把这个变量传给：

```text
PerformanceProcessorDesiredCount=1
```

启动后在 AWS 控制台检查：

1. ECS -> Cluster -> `bhb-login-go-profile` -> Service `bhb-login-performance-processor`。
2. `Desired count` 和 `Running count` 都应为 `1`。
3. CloudWatch Logs -> `/ecs/bhb-login/performance-processor`，确认有 Worker 日志。
4. SQS -> `bhb-login-performance-events`，确认消息可见数量最终回到 0。
5. SQS -> `bhb-login-performance-events-dlq`，正常情况下消息数应为 0。

## 验证页面

1. 访问 `https://fashiontai.online` 并登录。
2. 进入 Dashboard，打开“性能监控”。
3. 访问几个页面，触发 API 请求，等待 ECS Worker 消费队列。
4. 打开 `/performance`，选择 7 天或 30 天并点击刷新。
5. 页面应显示事件总数、平均请求耗时、FCP、LCP、CLS、事件类型和热门路由。

也可以直接检查接口：

```bash
curl 'https://<api-gateway-domain>/api/telemetry/events' \
  -H 'content-type: application/json' \
  --data '{"events":[{"anonymousId":"manual-test","eventType":"api_request","metrics":{"apiName":"manual","apiStatus":200,"durationMs":42},"occurredAt":"2026-08-05T00:00:00.000Z","route":"/manual-test","sdkVersion":"1.0.0"}]}'
```

统计接口需要登录会话 Cookie，因此建议通过页面验证；不要把真实 Cookie 或数据库密码写进命令历史和文档。

## 成本控制

- `PerformanceProcessorDesiredCount=0`：不运行 Fargate Worker。
- `PerformanceProcessorDesiredCount=1`：运行一个私有 Fargate Worker。
- SQS 和 CloudWatch Log Group 都设置了 14 天保留，避免无期限积累。
- 生产部署前先用少量流量验证，确认 DLQ 没有增长后再提高采样率或任务数。
