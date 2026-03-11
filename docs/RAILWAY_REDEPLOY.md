# Railway 重新部署步骤（从零接好一次）

你本地 `cs_agent_demo` 下有独立 git（`.git`），推上去的**仓库根目录**就是 `cs_agent_demo` 这一层，根目录下直接有 `backend` 文件夹。按下面做一次即可。

---

## 一、确认 GitHub 仓库

1. 打开你连到 Railway 的那个 GitHub 仓库页面。
2. 看根目录结构，应是：
   - `backend/`（里面有 server.js、package.json、prompts.json）
   - `product_docs/`、`assets/`、`manifest.json` 等

若根目录**直接**有 `backend` 文件夹 → Railway 的 **Root Directory** 填 **`backend`**。  
若根目录先有一层 **`cs_agent_demo`**，再里面才是 `backend` → Root Directory 填 **`cs_agent_demo/backend`**。

---

## 二、在 Railway 里新建/接好服务

1. 打开 [Railway Dashboard](https://railway.app) → 选你的项目（如 renewed-transformation）。
2. **若你把之前的服务移除了**：点 **"+ New"** → **"GitHub Repo"** → 选你的 **cs_agent_demo 仓库**（或你实际用的那个）。
3. 选中刚连上的仓库后，Railway 会创建一个 Service。点进这个 Service。

---

## 三、设置 Root Directory 和变量

1. 点 **Settings**（或齿轮）。
2. 找到 **Source** / **Root Directory**：
   - 若仓库根目录直接是 `cs_agent_demo` 的内容（根目录就有 `backend`）→ 填 **`backend`**。
   - 若仓库根目录是整仓、下面才有 `cs_agent_demo` → 填 **`cs_agent_demo/backend`**。
3. 在 **Variables** 里加（和之前一样）：
   - `OPENAI_API_KEY` = 你的 OpenRouter Key
   - `OPENAI_API_BASE` = `https://openrouter.ai/api/v1`
   - `OPENAI_MODEL` = `google/gemini-2.0-flash-exp`（或你用的模型）
   - `PORT` 一般不用填，Railway 会注入。

保存。

---

## 四、生成域名并部署

1. **Settings** → **Networking** → **Generate Domain**，得到 `xxx.up.railway.app`。
2. 点 **Deploy** / **Redeploy**，或等自动触发一次部署。
3. 等状态从 Queued → Building → Deploying → **Success**。

---

## 五、验证

- 浏览器打开：`https://你的服务名.up.railway.app/health`，应返回 `{"ok":true,"service":"cs-agent-backend"}`。
- 在 Zendesk App 配置里，**Backend URL** 填：`https://你的服务名.up.railway.app`（无末尾斜杠）。

---

## 若仍然报 “Could not find root directory: backend”

说明在 Railway 看到的仓库根目录下**没有** `backend` 文件夹。请检查：

1. GitHub 上该仓库根目录下是否真有 **`backend`** 文件夹（点进仓库第一页就能看到）。
2. 若没有，说明你推的是**上一层**（例如只推了 `data_sync`，根目录是 `lingxing_return_sync`、`cs_agent_demo` 等），那时 Root Directory 要填 **`cs_agent_demo/backend`**。
3. 若你希望仓库根就是 backend，可以新建一个**只含 backend 的仓库**：本地复制一份 `cs_agent_demo/backend` 到新文件夹，`git init` 后推送到新仓库，Railway 连这个新仓库，Root Directory 留空或填 `/`。

---

## 本地确保 backend 可单独跑

backend 依赖的提示词在 **`backend/prompts.json`**（与 `product_docs/prompts.json` 同步）。部署时 Railway 只会上传 Root Directory 下的内容，不会带 `product_docs`，所以跑的是 `backend/prompts.json`。你本地若改了 `product_docs/prompts.json`，记得同步到 `backend/prompts.json` 再 push。
