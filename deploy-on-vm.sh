#!/bin/bash
# 在 GCP VM 上运行：先上传并解压 cs_agent_demo 后，在解压目录执行: bash deploy-on-vm.sh
# 会安装 Node 20、依赖、创建 .env 模板、用 pm2 启动后端。
export DEBIAN_FRONTEND=noninteractive

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"

echo "==> 使用项目目录: $SCRIPT_DIR"

# 1) 安装 Node.js 20（若未安装或版本过旧）
if ! command -v node &>/dev/null; then
  echo "==> 安装 Node.js 20..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq curl
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
NODE_VER=$(node -v 2>/dev/null || true)
echo "==> Node: $NODE_VER"

# 2) 安装后端依赖
if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "错误: 未找到 backend 目录: $BACKEND_DIR"
  exit 1
fi
echo "==> 安装 backend 依赖..."
cd "$BACKEND_DIR"
npm install --production

# 3) 创建 .env（若不存在）
ENV_FILE="${BACKEND_DIR}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> 创建 .env 模板（请稍后编辑填入 OPENAI_API_KEY）..."
  cat > "$ENV_FILE" << 'ENVEOF'
PORT=3000
OPENAI_API_KEY=
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_MODEL=google/gemini-2.0-flash-exp
ENVEOF
  echo "    已创建 $ENV_FILE，请用 nano $ENV_FILE 填入 OPENAI_API_KEY 后重新执行: pm2 restart cs-agent-backend"
else
  echo "==> 已存在 .env，跳过"
fi

# 4) 用 PM2 启动（先加载 .env 再启动；pm2 不自动读 .env，用 dotenv 或 export）
if ! command -v pm2 &>/dev/null; then
  echo "==> 安装 pm2..."
  sudo npm install -g pm2
fi

# 从 .env 导出变量到当前 shell，供 pm2 子进程继承
if [[ -f "$ENV_FILE" ]]; then
  set -a
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^#.*$ || ! "$line" =~ = ]] && continue
    export "$line" 2>/dev/null || true
  done < "$ENV_FILE"
  set +a
fi

cd "$BACKEND_DIR"
pm2 delete cs-agent-backend 2>/dev/null || true
pm2 start server.js --name cs-agent-backend --update-env
pm2 save
echo ""
echo "==> 后端已启动。查看状态: pm2 status"
echo "==> 请编辑 $ENV_FILE 填入 OPENAI_API_KEY 后执行: pm2 restart cs-agent-backend"
echo "==> 开机自启: pm2 startup  # 按提示执行它输出的 sudo 命令"
echo "==> 本机测试: curl http://127.0.0.1:3000/health"
exit 0
