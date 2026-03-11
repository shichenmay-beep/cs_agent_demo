# 从 Railway 切换到 GCP VM 当后端

后端改用你已采购的 GCP 虚拟机，Zendesk 不再请求 Railway，避免按量计费。需完成：**域名 A 记录 → 防火墙 80/443 → VM 上配 HTTPS → 改 Zendesk Backend URL**。

---

## 前提

- GCP VM 已存在、已部署后端（你已做过 `deploy-full-to-vm.sh` 和 `.env` 上传）。
- VM 公网 IP：**136.117.167.30**（实例：instance-20260310-035409，zone: us-west1-b）。
- 有一个你能做 DNS 解析的域名（如 trustecho.com、comulytic.ai 等），用其**子域名**指到 VM（例如 `api.trustecho.com`）。

---

## 步骤一：域名 A 记录指到 VM

在你域名的 DNS 里（域名服务商或 Cloudflare 等）新增一条 **A 记录**：

| 类型 | 主机/名称 | 值/指向 | TTL |
|------|-----------|--------|-----|
| A    | api（或你想要的子域名） | 136.117.167.30 | 300 或默认 |

- 若主机填 `api`，则域名为 **api.你的主域名.com**（如 api.trustecho.com）。
- 保存后等几分钟到几十分钟生效，可用 `ping api.你的域名.com` 看是否解析到 136.117.167.30。

---

## 步骤二：GCP 防火墙放行 80、443

在**你本机**（已装 gcloud 并登录）执行：

```bash
cd /Users/shichen/data_sync/cs_agent_demo
bash open-firewall-80-443.sh
```

若提示规则已存在可忽略。确保 VM 所在 VPC 允许入站 **tcp:80**、**tcp:443**。

---

## 步骤三：在 VM 上配置 HTTPS（Nginx + Let's Encrypt）

1. SSH 登录 VM（本机执行）：

```bash
gcloud compute ssh instance-20260310-035409 --zone=us-west1-b
```

2. 在 VM 上拉取最新脚本（若脚本已随代码部署在 VM 上可跳过拉取，直接执行）：

```bash
cd ~/cs_agent_demo
# 若本地已更新脚本，可先在本机用 deploy-full-to-vm.sh 再传一次；或把下面命令里的 API_DOMAIN 换成你的域名直接运行
```

3. 在 VM 上执行 HTTPS 配置（**把 `api.你的域名.com` 和邮箱换成你的**）：

```bash
cd ~/cs_agent_demo
sudo API_DOMAIN=api.你的域名.com CERTBOT_EMAIL=你的邮箱@example.com bash setup-https-on-vm.sh
```

- 若没有可用邮箱可省略邮箱：`sudo API_DOMAIN=api.你的域名.com bash setup-https-on-vm.sh`（会使用无邮箱注册）。
- 脚本会：安装 nginx/certbot、写 Nginx 反代到 3000、申请证书并自动配好 HTTPS。

4. 在 VM 上自测：

```bash
curl -s https://api.你的域名.com/health
```

应返回 `{"ok":true,"service":"cs-agent-backend"}`。在浏览器打开 `https://api.你的域名.com/health` 也应正常。

---

## 步骤四：Zendesk 改用 VM 的 HTTPS 地址

1. 打开 Zendesk Admin Center → **Apps and integrations** → **Apps**。
2. 找到 **comulytic_ai_assistant**（或你的 CS Agent 应用），点进配置。
3. 在 **backend_url** 中把原来的 Railway 地址改为：
   - **https://api.你的域名.com**
   - 不要带末尾斜杠，不要带 `/health`。
4. 保存。

---

## 步骤五：验证

- 打开任意工单，看侧栏是否正常（优先级、翻译、总结、建议回复能出来）。
- 若报错，在浏览器开发者工具 Network 里看请求是否发往 `https://api.你的域名.com` 且返回 200。

---

## 小结

| 步骤 | 操作 |
|------|------|
| 1 | 域名 A 记录：api.你的域名.com → 136.117.167.30 |
| 2 | 本机执行 `bash open-firewall-80-443.sh` |
| 3 | SSH 上 VM，执行 `sudo API_DOMAIN=api.你的域名.com CERTBOT_EMAIL=你@邮箱 bash setup-https-on-vm.sh` |
| 4 | 本机或浏览器测 `https://api.你的域名.com/health` |
| 5 | Zendesk App 配置里 Backend URL 改为 `https://api.你的域名.com` |

之后流量走 VM，不再走 Railway；VM 已部署的代码和 .env 会直接生效。
