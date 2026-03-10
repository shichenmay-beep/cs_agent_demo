# 后端与大模型排查

## 一、本机访问不到 VM 后端

### 现象

本机执行 `curl http://136.117.167.30:3000/health` 超时或无响应。

---

## 1. 在 GCP 放行 3000 端口（最常见原因）

GCP 默认不允许外网访问 VM 自定义端口，需要加一条防火墙规则。

**方式 A（推荐）：一键脚本（本机执行）**

```bash
cd /Users/shichen/data_sync/cs_agent_demo
# 若需指定项目：export GCP_PROJECT=gen-lang-client-0896565006
bash open-firewall-3000.sh
```

**方式 B：手动 gcloud 命令**

```bash
# 查看当前项目
gcloud config get-value project

# 创建防火墙规则：允许任意 IP 访问 tcp 3000（仅用于调试；生产建议限制来源 IP）
gcloud compute firewall-rules create allow-cs-agent-backend \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:3000 \
  --source-ranges=0.0.0.0/0 \
  --description="Allow CS Agent backend port 3000"
```

若提示 `network=default` 不存在，先查网络名：

```bash
gcloud compute networks list
```

把上面命令里的 `--network=default` 改成实际网络名（如 `default`）。

**方式 B：在 GCP 控制台**

1. 打开 [VPC 网络 → 防火墙](https://console.cloud.google.com/networking/fireworks/list)
2. 点击「创建防火墙规则」
3. 名称：`allow-cs-agent-backend`
4. 网络：default（或你的 VPC）
5. 目标：网络中的所有实例（或指定标签）
6. 来源 IP 范围：`0.0.0.0/0`（测试用；生产可缩小）
7. 协议和端口：勾选「tcp」，填 `3000`
8. 保存

保存后等几秒，再在本机执行：

```bash
curl http://136.117.167.30:3000/health
```

---

## 2. 确认 VM 上后端在跑

若放行 3000 后仍不通，需登录 VM 看进程是否在监听。

**SSH 到 VM：**

```bash
cd /Users/shichen/data_sync/cs_agent_demo
# 若 gcloud 不在 PATH，先： source ../setup_gcloud_path.sh
gcloud compute ssh instance-20260310-035409 --zone=us-west1-b
```

**在 VM 上执行：**

```bash
# 看 pm2 是否在跑
pm2 status

# 若 cs-agent-backend 未运行或报错
pm2 restart cs-agent-backend
pm2 logs cs-agent-backend --lines 20

# 在 VM 本机测健康接口（应立刻返回）
curl -s http://127.0.0.1:3000/health
```

- 若 `curl http://127.0.0.1:3000/health` 在 VM 上正常，但本机仍不通 → 多半是防火墙未放行 3000 或规则未生效。
- 若 VM 上 `curl 127.0.0.1` 也失败 → 后端未启动或崩溃，看 `pm2 logs` 排查。

---

## 3. 后端已改为监听 0.0.0.0

`server.js` 已使用 `app.listen(PORT, '0.0.0.0', ...)`，会接受外网连入。若你曾改过只监听 127.0.0.1，需改回 0.0.0.0 并重启：

```bash
pm2 restart cs-agent-backend
```

---

## 4. 快速自检清单

| 步骤 | 命令/位置 | 预期 |
|------|------------|------|
| GCP 防火墙 | 控制台或 gcloud 规则 `tcp:3000` | 已放行 |
| VM 内进程 | `pm2 status` | cs-agent-backend 为 online |
| VM 内健康检查 | `curl -s http://127.0.0.1:3000/health` | `{"ok":true,"service":"cs-agent-backend"}` |
| 本机健康检查 | `curl http://VM公网IP:3000/health` | 同上 |

先完成 **1（放行 3000）** 和 **2（VM 内确认进程与 curl）**，再在本机重试。

---

## 接口何时会调用（大模型/后端）

**只有下面几种情况会请求后端，不会在「不打开、不刷新」时调用：**

| 时机 | 会调用的接口 |
|------|--------------|
| **打开工单并加载侧栏** | 优先级、最后一条会话、翻译、工单总结（打开时各请求一次） |
| **工单有更新**（例如新回复）且侧栏已打开 | 会再次拉取最后一条会话、翻译、工单总结、优先级 |
| **切换「偏好语言」下拉** | 重新请求翻译、工单总结、优先级 |
| **点击「生成建议回复」** | 请求建议回复、再请求直译 |

**不会调用的情况：**

- 没有打开该工单页面 → 不会发任何请求
- 打开了工单但侧栏未加载/被折叠 → 不会发请求
- 不刷新、不切换语言、不点生成回复 → 除了「打开时」和「工单更新时」那一次，不会额外请求

结论：**不刷新、不打开（侧栏），就不会调用接口**；没有后台定时或静默请求。

---

## 二、大模型未生效（一直走 Mock / 优先级或回复不像真实模型）

### 原因

后端从 **环境变量** 或 **config.json** 读 `OPENAI_API_KEY`。VM 上若只上传了 `.env` 而用 `pm2 restart`，PM2 不会重新读 `.env`，进程里还是旧的（空）环境，所以 key 没生效。

### 处理（已改为启动时读 .env）

当前后端已在启动时用 `dotenv` 从 `backend/.env` 加载变量，**只要 VM 上的代码是最新**，重启后就会读到 .env 里的 key。

1. **确保 VM 上有最新后端代码**（含 `require('dotenv').config(...)` 的 server.js 和含 dotenv 的 package.json）。
2. 在 VM 上执行：
   ```bash
   cd ~/cs_agent_demo/backend
   npm install
   pm2 restart cs-agent-backend
   ```
3. 看日志确认用了 key：`pm2 logs cs-agent-backend --lines 5`，应看到 “Using OpenAI (key from env or config).” 而不是 “No API key set; using mock responses.”。

若 VM 上代码未更新，需重新上传整个 `cs_agent_demo` 或至少上传 `backend/server.js`、`backend/package.json` 和 `backend/package-lock.json`，再在 VM 上执行上述 `npm install` 与 `pm2 restart`。
