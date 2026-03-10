#!/bin/bash
# 在 GCP 放行 3000 端口，使本机/Zendesk 能访问 VM 上的后端。在本机执行（需已 gcloud auth login）。
# 可选环境变量：GCP_PROJECT（不设则用 gcloud 默认项目）

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${GCP_PROJECT:-}"

if ! command -v gcloud &>/dev/null; then
  GCLOUD_BIN="${SCRIPT_DIR}/../google-cloud-sdk/bin"
  if [[ -x "${GCLOUD_BIN}/gcloud" ]]; then
    export PATH="${GCLOUD_BIN}:$PATH"
  fi
fi
if ! command -v gcloud &>/dev/null; then
  echo "错误: 未找到 gcloud。请先执行: source $(dirname "$SCRIPT_DIR")/setup_gcloud_path.sh"
  exit 1
fi

echo "==> 当前项目: $(gcloud config get-value project 2>/dev/null)"
echo "==> 创建防火墙规则：允许 tcp 3000 入站..."
if [[ -n "$PROJECT" ]]; then
  gcloud compute firewall-rules create allow-cs-agent-backend \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:3000 \
    --source-ranges=0.0.0.0/0 \
    --description="Allow CS Agent backend port 3000" \
    --project="$PROJECT" 2>&1 || true
else
  gcloud compute firewall-rules create allow-cs-agent-backend \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:3000 \
    --source-ranges=0.0.0.0/0 \
    --description="Allow CS Agent backend port 3000" 2>&1 || true
fi

# 若规则已存在会报错，忽略
echo "==> 若规则已存在可忽略上方的 already exists 错误。"
echo "==> 请在本机测试: curl http://你的VM公网IP:3000/health"
