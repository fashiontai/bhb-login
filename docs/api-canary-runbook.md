# API Canary 灰度发布手册

## 发布模型

Node/Hono API 使用 Lambda `live` Alias。SAM 自动发布不可变 Lambda Version，CodeDeploy 通过 `Canary10Percent5Minutes` 将 10% 请求切到新版本，观察 5 分钟后再切换剩余流量。

灰度期间如果 `live` Alias 的 Lambda `Errors` 指标超过阈值，CloudWatch Alarm 会触发 CodeDeploy 回滚。

## 首次启用

首次发布必须先创建 Alias，避免 CodeDeploy 没有旧版本可用于切流：

1. 保持 GitHub Environment 变量 `ENABLE_API_CANARY` 不存在或设为 `false`。
2. 推送后确认工作流成功。
3. 检查 Alias：

```bash
aws lambda get-alias \
  --profile bhb-new \
  --region ap-northeast-1 \
  --function-name bhb-login-api \
  --name live
```

## 执行灰度

在 GitHub 仓库的 `production` Environment 中新增变量：

```text
ENABLE_API_CANARY=true
```

然后推送新的后端代码，或手动运行 `Deploy AWS Backend` 工作流。部署期间在 AWS CodeDeploy 控制台查看 10% 灰度进度，在 CloudWatch 查看 `ApiAliasErrorAlarm`。

## 验证

```bash
curl -i https://6pa1f8xpfd.execute-api.ap-northeast-1.amazonaws.com/
```

预期返回 `200 OK`。同时确认：

- Lambda `live` Alias 指向新 Version。
- CodeDeploy 部署状态先处于进行中，5 分钟后变为成功。
- `ApiAliasErrorAlarm` 没有进入 `ALARM`。
- API Gateway 请求仍然能够完成登录、注册和 GitHub Profile 保存。

## 回滚

如果灰度期间告警进入 `ALARM`，CodeDeploy 会自动停止灰度并恢复旧 Version。也可以在 CodeDeploy 控制台停止当前部署，或将 `ENABLE_API_CANARY` 临时设回 `false` 后重新部署稳定版本。

## 注意事项

- `ENABLE_API_CANARY` 控制的是 Lambda CodeDeploy 灰度，不是 API Gateway REST API 原生 Canary。
- 当前项目使用 API Gateway HTTP API，因此采用 Lambda Alias + CodeDeploy 方案。
- 第一次 Alias 部署和第一次 Canary 灰度必须分成两次部署。
