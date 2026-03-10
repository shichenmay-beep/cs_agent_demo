#!/bin/bash
# 在 GCP 放行 80、443 端口，供 Nginx/HTTPS 使用。在本机执行（需已 gcloud auth login）。
# 可选环境变量：GCP_PROJECT

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
echo "==> 列出已有防火墙规则（含 80/443/3000）..."
if [[ -n "$PROJECT" ]]; then
  gcloud compute firewall-rules list --filter="direction=INGRESS" --format="table(name,allowed[].map().firewall_rule().list():label=ALLOW,sourceRanges.list():label=SRC_RANGES)" --project="$PROJECT" 2>/dev/null | head -30
else
  gcloud compute firewall-rules list --filter="direction=INGRESS" --format="table(name,allowed[].map().firewall_rule().list():label=ALLOW,sourceRanges.list():label=SRC_RANGES)" 2>/dev/null | head -30
fi

echo ""
echo "==> 创建规则：允许 tcp 80、443 入站（HTTPS 用）..."
if [[ -n "$PROJECT" ]]; then
  gcloud compute firewall-rules create allow-http-https \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:80,tcp:443 \
    --source-ranges=0.0.0.0/0 \
    --description="Allow HTTP/HTTPS for Nginx" \
    --project="$PROJECT" 2>&1 || true
else
  gcloud compute firewall-rules create allow-http-https \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:80,tcp:443 \
    --source-ranges=0.0.0.0/0 \
    --description="Allow HTTP/HTTPS for Nginx" 2>&1 || true
fi

echo "==> 若规则已存在可忽略 already exists。放行后 VM 的 80、443 可被外网访问。"
