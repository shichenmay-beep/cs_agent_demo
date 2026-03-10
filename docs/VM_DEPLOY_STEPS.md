# GCP VM 部署步骤（创建好实例后）

VM 创建好后，按下面顺序操作。假设系统为 **Ubuntu**。

---

## 一键脚本部署（推荐）

**1. 本机打包并上传**

在本机（项目所在目录）执行（把 `实例名`、`你的区域` 换成实际值，例如 `my-vm`、`us-central1-a`）：

```bash
cd /Users/shichen/data_sync
zip -r cs_agent_demo.zip cs_agent_demo -x "cs_agent_demo/rag/chroma_db/*" "*.git*"
gcloud compute scp cs_agent_demo.zip 实例名:~/ --zone=你的区域
```

**2. 登录 VM 并执行部署脚本**

在 GCP 控制台点击实例的「SSH」打开浏览器终端，或本机执行：

```bash
gcloud compute ssh 实例名 --zone=你的区域
```

登录到 VM 后执行：

```bash
cd ~
unzip -o cs_agent_demo.zip
cd cs_agent_demo
bash deploy-on-vm.sh
```

脚本会自动：安装 Node 20、安装后端依赖、创建 `.env` 模板、用 pm2 启动服务。

**3. 填入 API Key 并重启**

```bash
nano ~/cs_agent_demo/backend/.env
# 填入 OPENAI_API_KEY=你的key，保存退出
pm2 restart cs-agent-backend
pm2 startup   # 按提示执行它输出的 sudo 命令，实现开机自启
```

本机浏览器访问 `http://VM公网IP:3000/health` 应返回 `{"ok":true,...}`。若需外网访问，在 GCP 防火墙放行 **3000**；正式用 Zendesk 时再配 HTTPS（见下文第 7 步）。

---

## 手动分步（可选）

### 1. 登录 VM

在 GCP 控制台点击实例右侧「SSH」打开浏览器终端，或本机执行：

```bash
gcloud compute ssh 你的实例名 --zone=你的区域 --project=你的项目ID
```

### 2. 安装 Node.js（LTS）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # 应显示 v20.x
```

### 3. 上传并部署后端代码

**方式 A：本机打包上传**

在本机执行（替换实例名和 zone）：

```bash
cd /Users/shichen/data_sync
zip -r cs_agent_demo.zip cs_agent_demo -x "cs_agent_demo/rag/chroma_db/*" "*.git*"
gcloud compute scp cs_agent_demo.zip 实例名:~/ --zone=你的区域
```

在 VM 上：

```bash
cd ~
unzip -o cs_agent_demo.zip
cd cs_agent_demo
bash deploy-on-vm.sh
```

**方式 B：在 VM 上 git clone（若代码在 Git 仓库）**

```bash
cd ~
git clone 你的仓库地址
cd cs_agent_demo
bash deploy-on-vm.sh
```

---

## 4. 配置环境变量

在 VM 上编辑环境变量（用你真实的 key，不要提交到仓库）：

```bash
cd ~/cs_agent_demo/backend
nano .env
```

写入（按需修改）：

```bash
PORT=3000
OPENAI_API_KEY=你的OpenRouter或OpenAI的key
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_MODEL=google/gemini-2.0-flash-exp
```

保存后，让 Node 能读到（后面用 pm2 时会自动读同目录 `.env`，或你用 `export` 也可）。

---

## 5. 先直接跑一次看是否正常

```bash
cd ~/cs_agent_demo/backend
node server.js
```

看到 `CS Agent backend running on http://localhost:3000` 后，在**本机**浏览器访问：`http://你的VM公网IP:3000/health`，应返回 `{"ok":true,"service":"cs-agent-backend"}`。  
若 VM 防火墙/安全组未放行 3000，先放行或下一步用 Nginx 只开 80/443。

Ctrl+C 停掉，进行下一步。

---

## 6. 用 PM2 常驻运行

```bash
sudo npm install -g pm2
cd ~/cs_agent_demo/backend
pm2 start server.js --name cs-agent-backend
pm2 save
pm2 startup   # 按提示执行它输出的那条命令，实现开机自启
```

---

## 7. 配置 HTTPS（Zendesk 要求后端是 HTTPS）

**需要先有一个域名**指向这台 VM 的公网 IP（在域名服务商处加 A 记录）。假设域名为 `api.yourdomain.com`。

**用 Nginx + Let's Encrypt：**

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

按提示选邮箱、同意条款。certbot 会自动改 Nginx 配置并配好证书。

然后配置 Nginx 反代到本机 3000：

```bash
sudo nano /etc/nginx/sites-available/default
```

在 `server { ... }` 里增加（或已有 `location /` 则改成）：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

保存后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**在 GCP 控制台**：防火墙/安全组放行 **80、443**。

---

## 8. 验证

- 浏览器访问：`https://api.yourdomain.com/health`，应返回 `{"ok":true,"service":"cs-agent-backend"}`
- 在 Zendesk App 里把 **backend_url** 填成：`https://api.yourdomain.com`

---

## 9. 后续（Zendesk 侧）

1. 本机执行 `zcli apps:pack` 打 zip，在 Zendesk Admin → Apps 上传安装。
2. 安装/编辑 App 时，**backend_url** 填：`https://api.yourdomain.com`。
3. 打开一条工单，侧栏能加载并正常调优先级、翻译、总结、建议回复即可。

---

## 无域名时临时用 HTTP（仅测试）

若暂时没有域名、只做内网或临时测试：

- 在 GCP 防火墙放行 **3000**，backend_url 填 `http://VM公网IP:3000`。  
- 注意：Zendesk 生产环境要求 **HTTPS**，很多浏览器也会限制 iframe 请求非 HTTPS，所以正式用一定要完成第 7 步并配域名。
