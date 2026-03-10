# 用 Railway 当后端（免费 HTTPS 子域名）

不想自己配域名和 Nginx 时，可以把 Node 后端部署到 **Railway**，用平台自带的 **xxx.railway.app** 子域名 + **HTTPS**，直接填到 Zendesk 的 Backend URL，解决「混合内容」和证书问题。

---

## Railway 能用吗？

**能。** 适合你这个场景：

| 项目 | 说明 |
|------|------|
| **免费子域名** | 部署后在 Settings → Networking → Generate Domain，得到 `你的服务名.railway.app`，自带 **HTTPS** |
| **Node 后端** | 支持 Node.js，识别 `package.json`，可直接部署 `backend/` 目录 |
| **环境变量** | 在 Railway 控制台填 `OPENAI_API_KEY`、`OPENAI_API_BASE`、`OPENAI_MODEL` 等，无需本机 .env 上传 |
| **免费额度** | 新用户有约 $5 试用额度；之后有每月约 $1 免费额度，用量小（如一天几十次请求）可能够用，超了按量计费 |

---

## 部署步骤概要

1. **注册**：[railway.app](https://railway.app) 用 GitHub 登录。
2. **新建项目**：New Project → 选 **Deploy from GitHub repo**，连到你 fork 的仓库；或选 **Empty Project** 后本地用 Railway CLI 部署。
3. **指定根目录**：若仓库是整仓，在 Railway 里把 **Root Directory** 设为 `cs_agent_demo/backend`（或只把 `backend` 目录单独建一个 repo 再连）。
4. **环境变量**：在 Service → Variables 里加 `OPENAI_API_KEY`、`OPENAI_API_BASE`（如 `https://openrouter.ai/api/v1`）、`OPENAI_MODEL`（如 `google/gemini-3.1-pro-preview`）、`PORT`（Railway 会注入，可不设）。
5. **生成域名**：Settings → Networking → **Generate Domain**，得到 `xxx.railway.app`。
6. **Zendesk**：Backend URL 填 `https://xxx.railway.app`（不要带尾部斜杠或 /health）。

---

## 其他免费子域名（仅作参考）

若不想用 Railway，还可以考虑：

- **Trapdoor**（trapdoor.sh）：免费自定义子域名 + HTTPS，如 `myapp.trapdoor.sh`，适合做隧道转发到你现在 GCP 上的后端。
- **Cloudflare TryCloudflare**：一键生成 `xxx.trycloudflare.com`，HTTPS，适合临时测试；有并发等限制。
- **DNSBox**（dnsbox.io）：给公网 IP 分配一个 HTTPS 子域名，零配置；适合「VM 不动、只多一个域名」的场景。

对你当前需求（长期、稳定、带 HTTPS 的 API 地址），**Railway 部署后端** 或 **GCP VM + 自有域名/子域名** 二选一即可；Railway 不用自己管域名和证书，上手更快。
