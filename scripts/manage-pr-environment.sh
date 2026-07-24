#!/usr/bin/env bash

set -euo pipefail

require_variable() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required environment variable: %s\n' "$name" >&2
    exit 1
  fi
}

for name in \
  AWS_DEFAULT_REGION \
  CODEBUILD_RESOLVED_SOURCE_VERSION \
  CODEBUILD_WEBHOOK_EVENT \
  CODEBUILD_WEBHOOK_HEAD_REF \
  CODEBUILD_WEBHOOK_TRIGGER \
  ECR_REPOSITORY_URI \
  ECS_CLUSTER_NAME \
  VPC_ID \
  PRIVATE_SUBNET_A \
  PRIVATE_SUBNET_B \
  ALB_SECURITY_GROUP_ID \
  LAMBDA_SECURITY_GROUP_ID \
  DATABASE_SECURITY_GROUP_ID \
  HTTPS_LISTENER_ARN \
  CLOUD_MAP_NAMESPACE_ID \
  TASK_EXECUTION_ROLE_ARN \
  TASK_ROLE_ARN \
  DATABASE_ENDPOINT \
  DATABASE_PORT \
  DATABASE_NAME \
  DATABASE_SECRET_ARN \
  GO_INTERNAL_SECRET_ARN \
  FRONTEND_ORIGIN \
  CLOUDFLARE_PAGES_DOMAIN; do
  require_variable "$name"
done

if [[ ! "$CODEBUILD_WEBHOOK_TRIGGER" =~ ^pr/([0-9]+)$ ]]; then
  printf 'Unsupported CodeBuild trigger: %s\n' "$CODEBUILD_WEBHOOK_TRIGGER" >&2
  exit 1
fi

pull_request_number="${BASH_REMATCH[1]}"
if ((pull_request_number > 49000)); then
  printf 'Pull request number %s exceeds the listener priority range\n' "$pull_request_number" >&2
  exit 1
fi

branch_name="${CODEBUILD_WEBHOOK_HEAD_REF#refs/heads/}"
preview_id="$(node scripts/preview-id.mjs "$branch_name")"
stack_name="bhb-login-pr-${pull_request_number}"
database_schema="pr_${pull_request_number}"
listener_priority="$pull_request_number"

stack_output() {
  local output_key="$1"
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue" \
    --output text
}

run_one_off_task() {
  local command="$1"
  local task_definition_arn="$2"
  local security_group_id="$3"
  local task_arn

  task_arn="$(aws ecs run-task \
    --cluster "$ECS_CLUSTER_NAME" \
    --launch-type FARGATE \
    --platform-version 1.4.0 \
    --task-definition "$task_definition_arn" \
    --network-configuration "awsvpcConfiguration={subnets=[${PRIVATE_SUBNET_A},${PRIVATE_SUBNET_B}],securityGroups=[${security_group_id}],assignPublicIp=DISABLED}" \
    --overrides "{\"containerOverrides\":[{\"name\":\"go-profile\",\"command\":[\"${command}\"]}]}" \
    --query 'tasks[0].taskArn' \
    --output text)"

  if [[ -z "$task_arn" || "$task_arn" == "None" ]]; then
    printf 'ECS failed to start the %s task\n' "$command" >&2
    exit 1
  fi

  aws ecs wait tasks-stopped --cluster "$ECS_CLUSTER_NAME" --tasks "$task_arn"

  local exit_code
  exit_code="$(aws ecs describe-tasks \
    --cluster "$ECS_CLUSTER_NAME" \
    --tasks "$task_arn" \
    --query "tasks[0].containers[?name=='go-profile'].exitCode | [0]" \
    --output text)"
  if [[ "$exit_code" != "0" ]]; then
    aws ecs describe-tasks \
      --cluster "$ECS_CLUSTER_NAME" \
      --tasks "$task_arn" \
      --query 'tasks[0].{stoppedReason:stoppedReason,containers:containers[*].{name:name,reason:reason,exitCode:exitCode}}' \
      --output json >&2
    exit 1
  fi
}

destroy_preview() {
  if ! aws cloudformation describe-stacks --stack-name "$stack_name" >/dev/null 2>&1; then
    printf 'Preview stack %s does not exist; cleanup is already complete.\n' "$stack_name"
    return
  fi

  run_one_off_task \
    "drop-schema" \
    "$(stack_output TaskDefinitionArn)" \
    "$(stack_output SecurityGroupId)"

  aws cloudformation delete-stack --stack-name "$stack_name"
  aws cloudformation wait stack-delete-complete --stack-name "$stack_name"
  printf 'Deleted preview stack %s and database schema %s.\n' "$stack_name" "$database_schema"
}

deploy_preview() {
  node --test scripts/preview-id.test.mjs
  (
    cd apps/go-profile
    go test ./...
    go vet ./...
  )

  local registry image_tag image_uri
  registry="${ECR_REPOSITORY_URI%%/*}"
  image_tag="pr-${pull_request_number}-${CODEBUILD_RESOLVED_SOURCE_VERSION:0:12}"
  image_uri="${ECR_REPOSITORY_URI}:${image_tag}"

  aws ecr get-login-password | docker login --username AWS --password-stdin "$registry"
  docker build \
    --file apps/go-profile/Dockerfile \
    --platform linux/arm64 \
    --tag "$image_uri" \
    apps/go-profile
  docker push "$image_uri"

  aws cloudformation deploy \
    --stack-name "$stack_name" \
    --template-file infra/pr-environment.yaml \
    --no-fail-on-empty-changeset \
    --parameter-overrides \
      "PullRequestNumber=${pull_request_number}" \
      "PreviewId=${preview_id}" \
      "ListenerRulePriority=${listener_priority}" \
      "ImageUri=${image_uri}" \
      "EcsClusterName=${ECS_CLUSTER_NAME}" \
      "VpcId=${VPC_ID}" \
      "PrivateSubnetA=${PRIVATE_SUBNET_A}" \
      "PrivateSubnetB=${PRIVATE_SUBNET_B}" \
      "AlbSecurityGroupId=${ALB_SECURITY_GROUP_ID}" \
      "LambdaSecurityGroupId=${LAMBDA_SECURITY_GROUP_ID}" \
      "DatabaseSecurityGroupId=${DATABASE_SECURITY_GROUP_ID}" \
      "HttpsListenerArn=${HTTPS_LISTENER_ARN}" \
      "CloudMapNamespaceId=${CLOUD_MAP_NAMESPACE_ID}" \
      "TaskExecutionRoleArn=${TASK_EXECUTION_ROLE_ARN}" \
      "TaskRoleArn=${TASK_ROLE_ARN}" \
      "DatabaseEndpoint=${DATABASE_ENDPOINT}" \
      "DatabasePort=${DATABASE_PORT}" \
      "DatabaseName=${DATABASE_NAME}" \
      "DatabaseSecretArn=${DATABASE_SECRET_ARN}" \
      "GoInternalSecretArn=${GO_INTERNAL_SECRET_ARN}" \
      "CorsOrigin=${FRONTEND_ORIGIN}" \
      "CloudflarePagesDomain=${CLOUDFLARE_PAGES_DOMAIN}" \
      "DatabaseSchema=${database_schema}"

  run_one_off_task \
    "migrate" \
    "$(stack_output TaskDefinitionArn)" \
    "$(stack_output SecurityGroupId)"

  printf 'Preview %s is ready for PR %s.\n' "$preview_id" "$pull_request_number"
}

case "$CODEBUILD_WEBHOOK_EVENT" in
  PULL_REQUEST_CLOSED | PULL_REQUEST_MERGED)
    destroy_preview
    ;;
  PULL_REQUEST_CREATED | PULL_REQUEST_UPDATED | PULL_REQUEST_REOPENED)
    deploy_preview
    ;;
  *)
    printf 'Unsupported webhook event: %s\n' "$CODEBUILD_WEBHOOK_EVENT" >&2
    exit 1
    ;;
esac
