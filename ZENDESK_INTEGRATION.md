# Zendesk 右侧集成与知识库、大模型接入指南

对应你截图中的工单页面：左侧是工单详情，中间是会话，**右侧图标栏**就是 Zendesk Apps 的位置。本应用以 **ticket_sidebar** 形式集成在工单右侧，打开工单时自动关联当前工单，并支持导入工单历史与 FAQ 作为知识库、接入大模型。

---

## 一、如何集成在工单右侧并关联当前工单

### 1. 右侧位置从哪来

- Zendesk 右侧那一列图标（用户、附件、日历等）是 **Apps 托盘**。
- 我们的应用在 `manifest.json` 里配置了 `location.support.ticket_sidebar`，安装后会在**工单页**右侧多出一个 App 图标；点击后侧栏展开，显示的就是 `assets/iframe.html` 的界面。
- 只要在**某条工单**页面打开，侧栏里的 App 运行环境就**已经和该工单绑定**，无需再传工单 ID。

### 2. 如何“关联到对应工单”

- 关联是**自动的**：侧栏 iframe 里通过 Zendesk 的 **ZAF Client** 拿到的就是**当前打开的这一条工单**的数据。
- 我们代码里已经用到了：
  - `ticket.id`、`ticket.subject`、`ticket.description`、`ticket.requester.*`、`ticket.tags`
  - 以及通过 Zendesk API 拉取的该工单的 **comments**（当前工单的历史对话）
- 所以：**在哪个工单页打开，就关联哪张工单**；切换工单或刷新后，侧栏会重新拿新工单数据（可配合 `ticket.updated` 事件刷新）。

### 3. 安装步骤（让应用出现在工单右侧）

1. **打包应用**
   - 在项目根目录执行（需安装 [Zendesk ZCLI](https://developer.zendesk.com/documentation/apps/app-developer-guide/zcli/)）：
     ```bash
     cd cs_agent_demo
     zcli apps:pack
     ```
   - 会生成一个 zip（例如 `app.zip`）。

2. **上传到 Zendesk**
   - 登录你的 Zendesk（例如 `rymindinc.zendesk.com`）。
   - 进入 **Admin（管理）** → **Apps and integrations** → **Zendesk Support API**（或 **Apps** 管理页）。
   - 上传刚才的 zip，安装应用。

3. **配置后端地址（必须）**
   - 安装/编辑该 App 时，会有一个参数 **backend_url**（我们在 manifest 里已声明）。
   - 填你**实际可访问的后端地址**，例如：
     - 本地调试：用 ngrok 暴露本机 3000 端口，填 `https://xxxx.ngrok.io`
     - 正式：填 `https://your-backend.example.com`
   - 侧栏里的请求（优先级、翻译、总结、建议回复）都会发到这个 backend_url，后端再调大模型。

4. **在工单页启用**
   - 进入任意一条工单（如你截图的 Battery Issues #1519）。
   - 右侧 App 托盘里找到并点击本应用图标，侧栏展开即是我们界面；此时已自动关联当前工单。

---

## 二、导入工单历史、产品 FAQ 作为知识库

### 1. 当前工单的“历史”已经在使用

- 侧栏会拉取**当前工单**的 comments（客户与客服的一来一往），在「工单总结和回复要点」、建议回复等接口里，已经把这些对话作为上下文传给后端；大模型会基于**当前工单的对话历史**做总结和生成回复。

### 2. 产品 FAQ 知识库（已支持，可扩展）

- 项目里已有 **`product_docs/faq.json`**，后端在生成建议回复、总结时会读取并作为上下文传给大模型。
- **直接扩展**：编辑 `product_docs/faq.json`，按你们真实产品与话术增加/修改条目；或新增多个 JSON/文档，在后端 `server.js` 里 `loadProductDocs()` 时一起加载、拼成一大段“产品与 FAQ 知识库”再给模型。

### 3. 导入“历史工单数据”做知识库（可选进阶）

若希望大模型不仅能看**当前工单**，还能参考**历史类似工单**的回复或处理方式，可以：

- **方案 A：静态知识库**
  - 定期从 Zendesk 导出历史工单（或已整理的问答对），整理成文档/JSON，放到 `product_docs/` 或单独目录；后端在请求大模型前读取这些文件，拼进 prompt。适合“精选案例、标准话术”类知识库。

- **方案 B：向量检索（RAG）**
  - 把历史工单的主题、描述、解决方案等写入向量库（如 OpenAI Embeddings + 自建索引，或 Supabase/ Pinecone 等）。
  - 后端在“建议回复”或“回复要点”时：先用当前工单内容查向量库，取最相关的几条历史，再和 FAQ、当前对话一起喂给大模型。这样既用到了“工单历史数据”，又不会把全部历史都塞进一次请求。

无论 A 还是 B，**知识库的“入口”都在你们自己的后端**：在 `server.js` 的 suggest-reply、summarize 等接口里，在调用大模型前加上“查 FAQ + 查历史工单”的逻辑即可；前端侧栏无需改，照样只请求同一个 backend_url。

---

## 三、接入大模型

### 1. 当前已支持的用法

- 后端 `backend/server.js` 已接 **OpenAI**：配置环境变量 `OPENAI_API_KEY`（以及可选 `OPENAI_MODEL`，默认 `gpt-4o-mini`）后，以下能力会走大模型：
  - 工单优先级评估（evaluate-priority）
  - 最后一条会话翻译（translate）
  - 工单总结和回复要点（summarize）
  - 建议回复（suggest-reply）
- 未配置 `OPENAI_API_KEY` 时，这些接口会退回 Mock 逻辑，方便先跑通集成。

### 2. 部署后端并配置密钥

- 将 `backend/` 部署到一台有公网 HTTPS 的服务器（或云函数），确保 Zendesk 里配置的 **backend_url** 指向它。
- 在运行后端的环境中设置：
  - `OPENAI_API_KEY=sk-...`
  - 可选：`OPENAI_MODEL=gpt-4o-mini` 或 `gpt-4o` 等。

### 3. 接入其他大模型（如 Claude、国产模型）

- 在 `server.js` 里找到 `evaluatePriorityWithLLM`、`translateWithLLM`、`summarizeWithLLM`、`suggestReplyWithLLM` 等函数，把其中调用 OpenAI 的部分改成你们要用的 API（同一套入参/出参，只换 HTTP 请求和解析即可）。
- 侧栏和 manifest 不用改，仍然只认一个 backend_url。

---

## 四、整体数据流（对应你问的几点）

| 你的需求           | 实现方式 |
|--------------------|----------|
| 集成在工单右侧     | 以 Zendesk App 形式安装，`ticket_sidebar` 位置，出现在右侧 App 托盘，点击展开侧栏。 |
| 关联到对应工单     | 由 Zendesk 环境自动绑定：侧栏 iframe 内 ZAF 取到的即是当前工单 ID、主题、描述、requester、以及该工单的 comments。 |
| 导入工单历史数据   | 当前工单的 comments 已在使用；更多历史工单可通过静态文档或向量 RAG 写入后端，在总结/建议回复时注入给大模型。 |
| 产品 FAQ 知识库    | 使用 `product_docs/faq.json`，并在后端加载后作为上下文传给大模型；可扩展为多文件或从 Confluence/飞书等拉取。 |
| 接入大模型         | 后端配置 `OPENAI_API_KEY` 即用 OpenAI；或在同一后端里替换为其他 LLM API。 |

按上述步骤打包上传 App、配置 backend_url 和密钥后，在任意工单页（如你截图的 #1519）右侧即可看到本应用，并自动关联该工单、使用当前对话与知识库、通过大模型做总结与建议回复。
