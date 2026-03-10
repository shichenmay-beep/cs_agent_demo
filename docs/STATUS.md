# CS Agent Demo - 当前状态（最新）

## 一、侧栏界面结构（从上到下）

| 区块 | 说明 | 数据来源 |
|------|------|----------|
| **紧急程度条** | P0～P3 + 判断关键点（与客服偏好语言一致，默认中文） | `/evaluate-priority`，传入 `lang`，切换偏好语言时重新请求 |
| **用户最后一条会话（原文）** | 客户最后一条消息原文（客户发什么语言就显示什么语言，不一定是中文） | Zendesk comments，取最后一条 customer |
| **翻译** | 上述原文按「客服偏好语言」的直译 | `/translate`，偏好语言变更时刷新 |
| **建议回复** | 点击「生成回复」→ 文本框显示回复（**用户原始语言**） | `/suggest-reply`，带 `customerLanguage` |
| **建议回复直译（客服偏好语言）** | 生成回复后，将回复正文译成客服偏好语言 | 生成回复后调 `/translate`，显示在「回复要点」上方 |
| **工单总结** | 客户诉求、关键实体、情绪等 | `/summarize`，按客服偏好语言 |
| **回复要点** | 回复须覆盖的 2～3 点 + 特别动作 | `/summarize` 的 `replyPoints` |
| **回复修改建议** | 提示词输入框，可改语气/政策 | 拼入 suggest-reply 的 customInstruction |
| **客服偏好语言** | 中文 / English / 日本語 | 控制：最后一条翻译、总结与要点语言、建议回复直译语言 |

## 二、核心规则（当前实现）

- **建议回复语言**：必须与用户原始语言一致（根据最后一条消息检测 ja/zh/en，传 `customerLanguage`）。
- **优先级**：P0～P3 四级，Comulytic 规则（业务事实 + 情绪加权），见 `prompts.json` priority。
- **渠道合规**：请求体带 `tags`，若含 `amazon`，回复中严禁 URL/诱导评论。
- **RAG**：若配置 `RAG_SERVICE_URL`，生成建议回复前会请求 RAG 取 FAQ + 历史案例 + 设备状态，拼入上下文。

## 三、项目文件一览

```
cs_agent_demo/
├── manifest.json              # Zendesk App，ticket_sidebar，参数 backend_url
├── assets/iframe.html         # 侧栏 UI（优先级、最后一条+翻译、建议回复、总结+直译+要点、提示词、偏好语言）
├── preview.html               # 本地预览界面（无 Zendesk 环境时用）
├── product_docs/
│   ├── faq.json               # 产品 FAQ，可替换为真实内容
│   └── prompts.json           # 四块提示词：priority / reply / summary / translate，可配置
├── backend/
│   ├── server.js              # 接口：evaluate-priority, suggest-reply, summarize, translate；支持 RAG、P0-P3、customerLanguage
│   ├── config.default.json    # 默认 API/模型配置（OpenRouter + Gemini 等）
│   └── config.json            # 本地 key（gitignore）
├── rag/
│   ├── process_data.py        # 离线：工单脱水 + FAQ 入库 ChromaDB
│   ├── retriever.py           # 在线：get_relevant_context + HTTP /context
│   ├── config_rag.py          # RAG 路径与 API 配置
│   ├── requirements_rag.txt   # Python 依赖
│   └── README_RAG.md         # RAG 使用说明
├── docs/
│   ├── TICKET_1698_EXAMPLE.md # 工单 #1698 各块输出示例
│   └── STATUS.md             # 本文件：当前状态
├── LAUNCH_CHECKLIST.md        # 上线前清单
├── ZENDESK_INTEGRATION.md     # 集成与安装说明
└── README.md                  # 项目说明与快速开始
```

## 四、如何看「最新结果」

### 1. 只看界面布局与文案

在项目根目录起一个静态服务，打开预览页：

```bash
cd cs_agent_demo
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/preview.html
```

可看到：优先级条（示例 P2 中）、最后一条会话与翻译、建议回复按钮、**建议回复直译**占位、「工单总结」「回复要点」示例、提示词框、客服偏好语言下拉。

### 2. 真实接口（优先级 / 翻译 / 总结 / 建议回复）

```bash
cd cs_agent_demo/backend
npm install
npm start
```

后端默认 `http://localhost:3000`。在 Zendesk 安装 App 时把 **backend_url** 配成该地址（或 ngrok 暴露的 HTTPS）。在真实工单页打开侧栏，即可看到：

- 当前工单的 P0～P3 与 reason
- 最后一条客户消息 + 按偏好语言的翻译
- 工单总结与回复要点（偏好语言）
- 点击「生成回复」→ 建议回复（用户语言）+ 建议回复直译（客服偏好语言）

### 3. 启用 RAG（可选）

```bash
cd cs_agent_demo/rag
pip install -r requirements_rag.txt
export OPENAI_API_KEY=sk-...
python process_data.py    # 离线预处理
python retriever.py --serve  # 起 RAG 服务 5001
```

后端环境设置 `RAG_SERVICE_URL=http://127.0.0.1:5001` 后重启，建议回复会带 RAG 检索上下文。

---

以上为当前最新结果与使用方式；具体示例见 `docs/TICKET_1698_EXAMPLE.md`。
