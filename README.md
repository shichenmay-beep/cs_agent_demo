# CS Agent Demo - Zendesk 侧边栏客服助手

面向 **Shopify / App / 亚马逊售后** 工单统一在 Zendesk 处理的场景，中国客服处理美国任务时用于提效的 Demo。

## 功能概览

| 功能 | 说明 |
|------|------|
| **工单优先级评估** | 根据主题、描述、标签等，用规则或大模型给出优先级（High/Medium/Low）及简短理由 |
| **自动生成回复话术** | 结合产品文档、工单内容、历史对话，生成英文回复草稿（面向美国客户） |
| **一键采纳发送** | 客服可「使用并发送」：将话术填入工单回复框并发送 |
| **编辑后使用** | 可「在回复框中编辑」：仅把话术填入回复框，由客服修改后再发 |

## 项目结构

```
cs_agent_demo/
├── manifest.json          # Zendesk App 配置（侧边栏位置、参数）
├── assets/
│   └── iframe.html        # 侧边栏 UI：优先级区块 + 话术区块 + 按钮
├── product_docs/
│   └── faq.json           # 产品/FAQ 文档（供大模型上下文，可替换为真实文档）
├── backend/
│   ├── package.json
│   └── server.js          # 优先级 + 话术接口（支持 Mock / OpenAI）
└── README.md
```

## 快速跑通 Demo

### 1. 安装并运行后端

```bash
cd cs_agent_demo/backend
npm install
npm start
```

后端默认在 `http://localhost:3000`，提供：

- `POST /evaluate-priority`：评估优先级（请求体含 subject、description、requesterEmail、tags）
- `POST /suggest-reply`：生成回复话术（请求体含 subject、description、conversationHistory 等）

未配置 `OPENAI_API_KEY` 时使用内置 Mock 逻辑；配置后自动走 OpenAI（可用 `OPENAI_MODEL` 指定模型，默认 `gpt-4o-mini`）。

### 2. 本地暴露后端给 Zendesk（用于本地调试）

Zendesk 侧边栏在浏览器里访问你的 iframe，iframe 内 JS 会请求「后端地址」。本地开发时需把 `localhost` 暴露到公网，例如用 ngrok：

```bash
ngrok http 3000
```

记下生成的 `https://xxxx.ngrok.io`，下一步会用到。

### 3. 安装 Zendesk App

1. 在 Zendesk Support 进入 **Admin** → **Apps and integrations** → **Zendesk Support API**，确认可创建/管理私有 App。
2. 使用 [Zendesk ZCLI](https://developer.zendesk.com/documentation/apps/app-developer-guide/zcli/) 打包并上传：

   ```bash
   cd cs_agent_demo
   zcli apps:pack
   zcli apps:upload
   ```

   或按 Zendesk 文档手动打包：将 `manifest.json` 与 `assets/` 打成 zip 后上传。

3. 在 App 的**参数/设置**里，把 **backend_url** 设为你的后端地址：
   - 本地调试：填 ngrok 地址，如 `https://xxxx.ngrok.io`
   - 正式环境：填已部署的后端地址，如 `https://your-api.example.com`

4. 在工单视图里启用该 App，即可在工单侧边栏看到「Priority」和「Suggested reply」区块。

### 4. 使用方式

- **评估优先级**：打开工单后，在侧边栏点击「Evaluate priority」，会显示优先级标签和理由。
- **生成话术**：点击「Generate reply」，等待生成后：
  - **Use & send**：将话术填入当前工单回复框（`comment.appendText`）；在 Zendesk 内再点「Submit」即完成发送。
- **Edit in reply box**：仅将话术填入回复框，由客服修改后再点 Zendesk 的发送。

## 产品文档与扩展

- 当前 Demo 使用的产品上下文在 `product_docs/faq.json`，可按你们实际产品与话术规范修改或替换。
- 若你们有 Confluence / Notion / 飞书文档等，可在 `backend/server.js` 中增加拉取逻辑，把内容拼进「产品文档」再传给大模型。

## 大模型配置（可选）

**读取顺序**：优先从环境变量读取（生产/RMS 部署时设置），未设置时使用默认配置文件中的 key。

- **环境变量**（生产推荐）：`OPENAI_API_KEY`、`OPENAI_MODEL`（可选，默认 `gpt-4o-mini`）。
- **默认 key 配置**（本地或 fallback）：
  - 在 `backend/config.default.json` 中填写 `OPENAI_API_KEY`、`OPENAI_MODEL`，或
  - 复制为 `backend/config.json` 后填写（该文件已加入 .gitignore，不会提交真实密钥）。

不设 key 时走 Mock，不调用大模型。

如需接入其他模型（如 Claude、国产大模型），可在 `server.js` 的 `evaluatePriorityWithLLM` 和 `suggestReplyWithLLM` 中替换为对应 API 调用。

## 注意事项

- 侧栏内通过 ZAF Client 的 `comment.appendText` 填入话术；是否直接发送取决于 Zendesk 版本与配置，Demo 按「填入回复框」设计，一键发送为可选增强。
- 工单历史（comments）通过 Zendesk API 拉取；若 App 无权限访问工单评论，历史会为空，仅用当前工单内容生成话术。
- 后端需支持 CORS，Demo 中已启用；若部署到自有域名，请确保 Zendesk 侧配置的 `backend_url` 与前端请求一致（HTTPS）。

## 集成到工单右侧、知识库与大模型

如何把应用装到 Zendesk 工单**右侧**、自动**关联当前工单**，以及**导入工单历史与 FAQ 作为知识库**并**接入大模型**，见 **[ZENDESK_INTEGRATION.md](./ZENDESK_INTEGRATION.md)**。

## 设计说明

更详细的交互与接口设计见 [DESIGN.md](./DESIGN.md)。
