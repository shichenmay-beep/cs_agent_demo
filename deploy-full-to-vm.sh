#!/bin/bash
# 方式 A：整包部署到 VM。在本机执行（需已 gcloud auth login）。
# 会：打包 cs_agent_demo → 上传到 VM → 解压 → backend npm install → pm2 restart → 上传 .env
# 可选环境变量：VM_INSTANCE、VM_ZONE、GCP_PROJECT（同 upload-env-to-vm.sh）

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
INSTANCE="${VM_INSTANCE:-instance-20260310-035409}"
ZONE="${VM_ZONE:-us-west1-b}"
PROJECT="${GCP_PROJECT:-}"

# 确保 gcloud 可用
if ! command -v gcloud &>/dev/null; then
  GCLOUD_BIN="${SCRIPT_DIR}/../google-cloud-sdk/bin"
  if [[ -x "${GCLOUD_BIN}/gcloud" ]]; then
    export PATH="${GCLOUD_BIN}:$PATH"
  fi
fi
if ! command -v gcloud &>/dev/null; then
  echo "错误: 未找到 gcloud。请先执行: source $PARENT_DIR/setup_gcloud_path.sh"
  exit 1
fi

run_ssh() {
  if [[ -n "$PROJECT" ]]; then
    gcloud compute ssh "$INSTANCE" --zone="$ZONE" --project="$PROJECT" --command="$1"
  else
    gcloud compute ssh "$INSTANCE" --zone="$ZONE" --command="$1"
  fi
}

echo "==> 1/4 打包 cs_agent_demo.zip（排除 chroma_db、.git）"
cd "$PARENT_DIR"
zip -r cs_agent_demo.zip cs_agent_demo \
  -x "cs_agent_demo/rag/chroma_db/*" \
  -x "*.git*" \
  -x "cs_agent_demo/.git/*"

echo "==> 2/4 上传到 VM: $INSTANCE (zone=$ZONE)"
if [[ -n "$PROJECT" ]]; then
  gcloud compute scp cs_agent_demo.zip "$INSTANCE:~/" --zone="$ZONE" --project="$PROJECT"
else
  gcloud compute scp cs_agent_demo.zip "$INSTANCE:~/" --zone="$ZONE"
fi

echo "==> 3/4 在 VM 上解压、安装 Node/依赖、启动后端（需数分钟）"
run_ssh "command -v unzip >/dev/null 2>&1 || (sudo apt-get update -qq && sudo apt-get install -y -qq unzip); cd ~ && unzip -o -q cs_agent_demo.zip && cd ~/cs_agent_demo && bash deploy-on-vm.sh"

echo "==> 4/4 上传 .env（保证 key 与模型生效）"
ENV_FILE="${SCRIPT_DIR}/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  run_ssh "mkdir -p ~/cs_agent_demo/backend"
  if [[ -n "$PROJECT" ]]; then
    gcloud compute scp "$ENV_FILE" "$INSTANCE:~/cs_agent_demo/backend/.env" --zone="$ZONE" --project="$PROJECT"
  else
    gcloud compute scp "$ENV_FILE" "$INSTANCE:~/cs_agent_demo/backend/.env" --zone="$ZONE"
  fi
  run_ssh "cd ~/cs_agent_demo/backend && pm2 restart cs-agent-backend || true"
  echo "    已上传 .env 并重启"
else
  echo "    未找到 backend/.env，跳过上传；请稍后手动上传或编辑 VM 上 ~/cs_agent_demo/backend/.env"
fi

echo ""
echo "==> 部署完成。验证: curl http://$(gcloud compute instances describe $INSTANCE --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null || echo 'VM_IP'):3000/health"
echo "    查看日志: gcloud compute ssh $INSTANCE --zone=$ZONE --command='pm2 logs cs-agent-backend --lines 5'"
