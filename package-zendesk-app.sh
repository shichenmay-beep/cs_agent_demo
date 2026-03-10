#!/bin/bash
# 从项目 .env 加载 Zendesk 凭证并执行 zcli apps:package（zcli 要求 ZENDESK_EMAIL，.env 里多为 ZENDESK_USER_EMAIL）
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  export ZENDESK_EMAIL="${ZENDESK_EMAIL:-$ZENDESK_USER_EMAIL}"
fi
if [[ -z "$ZENDESK_SUBDOMAIN" || -z "$ZENDESK_EMAIL" || -z "$ZENDESK_API_TOKEN" ]]; then
  echo "错误: 请设置 ZENDESK_SUBDOMAIN、ZENDESK_EMAIL（或 ZENDESK_USER_EMAIL）、ZENDESK_API_TOKEN"
  echo "  可在 $ENV_FILE 中配置，或执行: export ZENDESK_EMAIL=你的邮箱"
  exit 1
fi
cd "$SCRIPT_DIR"
zcli apps:package
