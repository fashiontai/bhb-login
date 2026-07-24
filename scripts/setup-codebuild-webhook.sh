#!/usr/bin/env bash

set -euo pipefail

aws_profile="${AWS_PROFILE:-bhb-new}"
aws_region="${AWS_REGION:-ap-northeast-1}"
project_name="${CODEBUILD_PROJECT_NAME:-bhb-login-go-pr}"
github_repository="${GITHUB_REPOSITORY:-fashiontai/bhb-login}"

webhook_response="$(aws codebuild create-webhook \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --project-name "$project_name" \
  --manual-creation \
  --filter-groups file://infra/codebuild-pr-webhook-filters.json)"

payload_url="$(jq -r '.webhook.payloadUrl' <<<"$webhook_response")"
webhook_secret="$(jq -r '.webhook.secret' <<<"$webhook_response")"

if [[ -z "$payload_url" || "$payload_url" == "null" || -z "$webhook_secret" || "$webhook_secret" == "null" ]]; then
  printf 'CodeBuild did not return a webhook URL and secret.\n' >&2
  exit 1
fi

if ! jq -n \
  --arg payload_url "$payload_url" \
  --arg webhook_secret "$webhook_secret" \
  '{
    name: "web",
    active: true,
    events: ["pull_request"],
    config: {
      url: $payload_url,
      content_type: "json",
      secret: $webhook_secret,
      insecure_ssl: "0"
    }
  }' | gh api \
    --method POST \
    "repos/${github_repository}/hooks" \
    --input - \
    --jq '{id, active, events}'; then
  aws codebuild delete-webhook \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --project-name "$project_name" >/dev/null
  printf 'GitHub rejected the webhook; the CodeBuild webhook was rolled back.\n' >&2
  exit 1
fi

printf 'CodeBuild PR webhook created for %s.\n' "$github_repository"
