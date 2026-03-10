#!/bin/bash
# 把本机 backend/.env（含 key 与模型）上传到 GCP VM 并重启后端。
# 使用前：确保 backend/.env 已存在且含 OPENAI_API_KEY、OPENAI_MODEL。
# 可选环境变量：VM_INSTANCE（默认 instance-20260310-035409）、VM_ZONE（默认 us-west1-b）、GCP_PROJECT

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 若当前 shell 没有 gcloud，尝试用项目下的 google-cloud-sdk
if ! command -v gcloud &>/dev/null; then
  GCLOUD_BIN="${SCRIPT_DIR}/../google-cloud-sdk/bin"
  if [[ -x "${GCLOUD_BIN}/gcloud" ]]; then
    export PATH="${GCLOUD_BIN}:$PATH"
  fi
fi
if ! command -v gcloud &>/dev/null; then
  echo "错误: 未找到 gcloud。请先安装 Google Cloud SDK 或执行: source $(dirname "$SCRIPT_DIR")/setup_gcloud_path.sh"
  exit 1
fi

ENV_FILE="${SCRIPT_DIR}/backend/.env"
INSTANCE="${VM_INSTANCE:-instance-20260310-035409}"
ZONE="${VM_ZONE:-us-west1-b}"
PROJECT="${GCP_PROJECT:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "错误: 未找到 $ENV_FILE，请先创建并填入 OPENAI_API_KEY 与 OPENAI_MODEL"
  exit 1
fi

echo "==> 上传 .env 到 VM: $INSTANCE (zone=$ZONE)"
# 确保 VM 上目标目录存在，再 scp（否则 scp 会报 No such file or directory）
run_ssh() {
  if [[ -n "$PROJECT" ]]; then
    gcloud compute ssh "$INSTANCE" --zone="$ZONE" --project="$PROJECT" --command="$1"
  else
    gcloud compute ssh "$INSTANCE" --zone="$ZONE" --command="$1"
  fi
}
run_ssh "mkdir -p ~/cs_agent_demo/backend"

if [[ -n "$PROJECT" ]]; then
  gcloud compute scp "$ENV_FILE" "$INSTANCE:~/cs_agent_demo/backend/.env" --zone="$ZONE" --project="$PROJECT"
  run_ssh "cd ~/cs_agent_demo/backend && pm2 restart cs-agent-backend || true"
else
  gcloud compute scp "$ENV_FILE" "$INSTANCE:~/cs_agent_demo/backend/.env" --zone="$ZONE"
  run_ssh "cd ~/cs_agent_demo/backend && pm2 restart cs-agent-backend || true"
fi
echo "==> 已上传并已执行 pm2 restart cs-agent-backend"
