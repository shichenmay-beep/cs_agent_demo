# CS Agent Demo - 设计说明

## 场景与目标

- **场景**：Shopify、App、亚马逊售后等工单统一在 Zendesk；中国客服处理美国用户工单。
- **目标**：提效——优先处理高优先级工单、减少重复写英文回复的时间。

## 产品形态

- **形态**：Zendesk Support 的 **工单侧边栏 App**（ticket_sidebar）。
- **原因**：不离开工单页即可看优先级、生成话术、一键填入或发送，与现有流程贴合。

## 能力设计

### 1. 工单优先级评估

- **输入**：工单 subject、description、requester 信息、tags（若可从 Zendesk 取到）。
- **输出**：优先级（High / Medium / Low）+ 一句理由（英文，便于客服理解或同步给团队）。
- **规则/Mock**：关键词与简单规则（如 refund、defective、urgent → High；return、shipping → Medium）。
- **LLM 扩展**：用大模型综合语义、情绪、渠道（亚马逊/Shopify 等）给出优先级与理由。

### 2. 自动生成回复话术

- **输入**：
  - 当前工单 subject、description、requester name；
  - 工单历史对话（通过 Zendesk API 拉取 comments，可选）；
  - 产品/FAQ 文档（本 Demo 用 `product_docs/faq.json`，可替换为真实文档或 API）。
- **输出**：一段可直接使用的英文回复草稿，语气专业、友好、简洁。
- **约束**：面向美国客户、英文回复；不暴露「AI 生成」等表述；可配置 tone（如更正式/更口语）。

### 3. 客服操作

- **接受话术，一键发送**：将生成的话术填入工单回复框并触发发送（Zendesk 侧通过 `comment.appendText` 等能力实现，具体以产品行为为准）。
- **编辑话术**：仅将话术填入回复框，客服可修改后再点 Zendesk 的「Submit」发送。

## 技术架构（Demo）

```
┌─────────────────────────────────────────────────────────────┐
│  Zendesk Support (Browser)                                  │
│  ┌───────────────────────────┬─────────────────────────────┐ │
│  │  Ticket (subject, desc,  │  Sidebar App (iframe)       │ │
│  │  requester, comments)     │  - Priority block           │ │
│  │                           │  - Suggested reply block    │ │
│  │                           │  - Buttons: Evaluate,       │ │
│  │                           │    Generate, Use & Send,    │ │
│  │                           │    Edit in reply box        │ │
│  └───────────────────────────┴─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │ ZAFClient.get/invoke         │ fetch(backend_url + /evaluate-priority
         │ (ticket, comment.appendText) │  or /suggest-reply)
         ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│  CS Agent Backend (Node)                                     │
│  - POST /evaluate-priority  → { priority, reason }           │
│  - POST /suggest-reply      → { reply }                      │
│  - product_docs/faq.json 作为上下文                          │
│  - 可选：OPENAI_API_KEY → 真实 LLM；否则 Mock                │
└─────────────────────────────────────────────────────────────┘
```

## 数据流

1. **优先级**：侧栏用 ZAFClient 取 ticket 字段 → 请求后端 `/evaluate-priority` → 展示 badge + reason。
2. **话术**：侧栏取 ticket + 可选 comments → 请求后端 `/suggest-reply` → 展示文本框 + 「Use & send」/「Edit in reply box」。
3. **发送**：侧栏通过 `client.invoke('comment.appendText', text)` 把话术写入工单回复框；是否自动提交由 Zendesk 行为决定，Demo 以「填入回复框」为基准。

## 安全与隐私

- 工单内容仅发往你自建的后端（backend_url）；若接 OpenAI，需遵守其数据与合规政策。
- 建议后端部署在可控环境（如公司内网或 VPC），并配置 HTTPS、访问控制与日志。

## 后续可扩展

- 在 Zendesk 中按渠道（Shopify / Amazon / App）展示不同话术模板或策略。
- 产品文档改为从 Confluence / Notion / 飞书文档 API 实时拉取。
- 增加「翻译」：客服用中文写要点，由 Agent 生成英文回复。
- 记录采纳率与编辑率，用于迭代提示词与文档。
