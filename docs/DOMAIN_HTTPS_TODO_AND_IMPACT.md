# 域名 + 后端 HTTPS 整体 TODO & 使用后的影响

## 一、整体 TODO（从找域名到侧栏打通）

按顺序做即可。

| 步骤 | 做什么 | 在哪里做 |
|------|--------|----------|
| **1. 确定域名** | 选一个你们已有、能改 DNS 的域名（如 trustecho.com），决定 API 子域名（如 `api.trustecho.com`） | 和运维/网管确认，或登录域名/DNS 控制台 |
| **2. 添加 A 记录** | 在 DNS 里为子域名加一条 **A 记录**：主机名 `api`，指向 VM 公网 IP（如 136.117.167.30） | 域名服务商或 Cloudflare/阿里云等 DNS 控制台 |
| **3. 等解析生效** | 本机执行 `ping api.你的域名.com` 或 `nslookup api.你的域名.com`，能解析到该 IP 即可 | 本机终端，通常几分钟～半小时 |
| **4. 放行 80、443** | 在 GCP 放行防火墙 tcp 80、443 | 本机执行 `bash open-firewall-80-443.sh`，或控制台 VPC → 防火墙 手动添加 |
| **5. 在 VM 上配 HTTPS** | 安装 Nginx + certbot，用子域名申请证书，并配置反代到本机 3000 | SSH 到 VM，执行 `API_DOMAIN=api.你的域名.com bash setup-https-on-vm.sh`，再按提示手动加 location / 反代 |
| **6. 验证后端** | 浏览器访问 `https://api.你的域名.com/health`，应返回 `{"ok":true,"service":"cs-agent-backend"}` | 浏览器 |
| **7. 改 Zendesk Backend URL** | 在 Zendesk App 配置里，把 Backend URL 改为 `https://api.你的域名.com`（不要带 /health，不要用 http） | Zendesk Admin Center → Apps → 你的 App → 配置 |
| **8. 侧栏验证** | 打开一条工单，看优先级、翻译、工单总结是否正常，无「请检查 Backend URL 与网络」 | Zendesk 工单页 |

---

## 二、用了这个域名之后会有什么影响

### 1. 对现有网站 / 主站

- **没有影响**。你用的是**子域名**（如 `api.trustecho.com`），主站继续用根域或 `www`（如 `trustecho.com`、`www.trustecho.com`），解析和服务器各用各的。
- 只有 `api.xxx.com` 会指到这台 VM，其他记录不变。

### 2. DNS 与运维

- **多一条 A 记录**：需要记住「API 子域名 → 当前 VM 公网 IP」。以后若 VM 换 IP（重建、换机），要在 DNS 里**改这条 A 记录**指向新 IP，否则 API 会断。
- **谁管 DNS**：若域名在别人手里，以后改 IP 或加其他子域名都要找对方操作。

### 3. 证书与续期

- Let's Encrypt 证书约 **90 天**有效，certbot 会配自动续期（systemd timer 或 crontab）。只要 VM 不删、Nginx 和 certbot 没被卸，一般不用管。
- 若 VM 重装系统，需要**重新跑一遍** `setup-https-on-vm.sh`（或重新配 Nginx + certbot）。

### 4. 安全与访问

- **谁都能访问**：`https://api.你的域名.com` 对公网开放，只要知道地址就能请求（例如 /health、/evaluate-priority 等）。若后端没做鉴权，建议后续加 token 或 IP 白名单。
- **HTTPS**：流量是加密的，不会像以前用 IP + http 那样被浏览器拦「混合内容」。

### 5. 成本

- 用已有域名、Let's Encrypt 证书：**无额外域名/证书费用**。只有 GCP VM 本身费用（你已在用）。

### 6. 以后若要换域名 / 换 VM

- **换子域名**：在新域名下加 A 记录指到同一台 VM，在 VM 上再跑一次 certbot 加新域名，Nginx 里改 `server_name`，Zendesk 里改 Backend URL。
- **换 VM（新 IP）**：在新 VM 上部署后端 + 再跑一遍 HTTPS 脚本；在 DNS 里把该子域名的 A 记录改为新 VM 的 IP；Zendesk 的 Backend URL 不用改（仍是 `https://api.xxx.com`）。

---

## 三、小结表

| 项目 | 说明 |
|------|------|
| 主站/官网 | 不受影响，继续用现有域名和解析 |
| 多出来的 | 一条 A 记录（api.xxx.com → VM IP）、VM 上 Nginx + 证书 |
| 要记得的 | VM 换 IP 时要去 DNS 改 A 记录；证书自动续期，重装系统要重配 HTTPS |
| 安全 | 接口对公网开放，建议后续加鉴权 |
| 成本 | 无额外域名/证书费 |
