# 大模型输出：提示词与逻辑（最新）

当前四处调用大模型的提示词来源、占位符、以及后端逻辑概要。提示词以 `product_docs/prompts.json` 为准（仅部署 backend 时用 `backend/prompts.json` 副本）。

---

## 1. 优先级评估 `POST /evaluate-priority`

**前端传入**：`subject`, `description`, `requesterEmail`, `tags`, `lang`（客服偏好语言，用于 reason 文案语言）

**占位符**：`subject`, `description`, `requesterEmail`, `tags`, `reasonLang`, `instruction`

**提示词**（`prompts.json` → `priority`）：

- **template**  
  ```
  你是 Comulytic 资深调度专家。请根据 subject、description、tags 以及下方 instruction 判定优先级。

  Ticket subject: {{subject}}
  Ticket description: {{description}}
  Requester email: {{requesterEmail}}
  Tags: {{tags}}

  {{instruction}}

  输出要求：仅输出 JSON。priority 为 P0/P1/P2/P3 之一；reason 字段的值请用「{{reasonLang}}」写一句判断关键点（基于事实与情绪）。
  ```

- **instruction**  
  ```
  逻辑核心：业务事实 + 情绪负面加权 = P0-P3 四级判定。
  P0 (Critical): 涉及硬件安全（发热/电池问题）、法律/起诉威胁、亚马逊 A-to-Z 申诉、或带有极端辱骂的情绪。
  P1 (High): 核心功能完全失效（无法连接、录音丢失）、AI 分钟数充值未到账、或用户表现出高度焦虑/严重不满。
  P2 (Medium): 一般性排障（App UI 报错、转写质量）、正常时间内的物流查询、或中性情绪的抱怨。
  P3 (Low): 功能建议、感谢信、或已解决问题的礼貌性确认。
  判定规则：负面情绪是权重的放大器。即便问题较小，但只要情绪为「极度愤怒」，必须提升至 P0/P1。
  ```

**后端逻辑**：  
- `reasonLang` = `REASON_LANG_MAP[body.lang]`（zh→中文, en→English, ja→日本語）。  
- 用 template + instruction 拼好 prompt，调用 LLM，temperature=0.2。  
- 从返回中解析 JSON，取 `priority`（校验为 P0/P1/P2/P3，否则默认 P2）、`reason`。  
- 返回 `{ priority, reason }`。

---

## 2. 翻译 `POST /translate`

**前端传入**：`text`（待译内容）, `targetLang`（目标语言：zh / en / ja）

**占位符**：`target`, `instruction`, `text`

**提示词**（`prompts.json` → `translate`）：

- **template**  
  ```
  Translate the following text into the target language: {{target}}.

  {{instruction}}

  Text to translate:
  {{text}}
  ```

- **instruction**  
  ```
  Output ONLY the translated text in the target language. Do not add any language label (e.g. no "[English]", "[中文]"), no prefix, no explanation. The entire response must be purely the translation.
  ```

**后端逻辑**：  
- `target` = `TARGET_LANG_MAP[body.targetLang]`（zh→Simplified Chinese (中文), en→English, ja→Japanese (日本語)）。  
- 用 template + instruction 拼好 prompt，调用 LLM，temperature=0.2。  
- 对返回的 `translation` 做一次去掉 `[xxx]` 前缀的正则：`translation.replace(/^\[[^\]]+\]\s*/, '')`，再返回 `{ translation }`。

---

## 3. 工单总结 + 回复要点 `POST /summarize`

**前端传入**：`subject`, `description`, `conversationHistory`（完整会话，按条拼接）, `lang`（客服偏好语言）

**占位符**：`lang`, `content`, `instruction`

**提示词**（`prompts.json` → `summary`）：

- **template**  
  ```
  请使用语言 {{lang}} 对 content 进行深度分析。

  {{instruction}}

  输出格式：结构化分条显示。仅输出一个 JSON：{"summary": "...", "replyPoints": "..."}

  Ticket content:
  {{content}}
  ```

- **instruction**  
  ```
  summary (客户诉求总结): 简洁总结客户当前的核心痛点和历史关键交互；提取关键实体：亚马逊订单号、录音卡 SN 码、报错代码；情绪识别：标记用户目前的具体情绪状态（如：焦虑、愤怒、平静）。
  replyPoints (回复核心要点): 列出回复时必须覆盖的 2-3 个关键点（如：核实地址、解释 30 天退换政策、引导固件升级）。特别动作：若设备不在线，建议客服引导用户检查物理开关；若为 Amazon 订单，注明「严禁发送链接」。
  脱敏：自动剔除姓名、电话、地址等个人隐私信息。
  ```

**后端逻辑**：  
- `content` = `subject + "\n\n" + description`，若有 `conversationHistory` 则再拼 `"\n\nConversation:\n" + conversationHistory`。  
- `lang` = `TARGET_LANG_MAP[body.lang]`（与 translate 同一映射），保证 summary、replyPoints 均为该语言。  
- 用 template + instruction 拼好 prompt，调用 LLM，temperature=0.2。  
- 从返回中解析 JSON，取 `summary`、`replyPoints`，trim 后返回 `{ summary, replyPoints }`。

---

## 4. 建议回复 `POST /suggest-reply`

**前端传入**：  
`subject`, `description`, `requesterName`, `tags`, `conversationHistory`（完整会话，全篇）, `customInstruction`（可选，回复修改建议里的提示词）, `customerLanguage`（客户使用语言，用于回复语言，如 en/zh/ja）

**占位符**：`agentInstruction`, `context`, `deviceStatus`, `subject`, `description`, `requesterName`, `tags`, `conversationHistory`, `instruction`

**提示词**（`prompts.json` → `reply`）：

- **template**  
  ```
  你是 Comulytic 专业客服支持。请根据下方「完整会话」（从首条到最新一条）综合理解客户诉求与历史回复，再撰写本次回复。

  结合 context（FAQ 与设备状态）与完整 conversationHistory 编写回复。

  {{agentInstruction}}

  {{instruction}}

  Product/FAQ & 检索上下文:
  {{context}}

  设备状态（如有）:
  {{deviceStatus}}

  Ticket subject: {{subject}}
  Ticket description: {{description}}
  Requester: {{requesterName}}
  Tags（渠道等）: {{tags}}

  完整会话（按时间顺序，必须综合全篇理解后写回复，不可只针对最后一条）:
  {{conversationHistory}}
  ```

- **instruction**  
  ```
  会话理解：必须参考上述完整会话全篇（从第一条客户消息到最新一条），综合客户多轮诉求与客服历史回复后再写本次回复；不可仅根据最后一条消息回复。回复内容仅为给客户看的正文，不要包含或引用会话原文。
  语言：回复必须使用客户使用的语言（客户用英文则用英文，用中文则用中文，用日文则用日文）。
  FAQ 优先：必须严格遵守 FAQ 中的技术规格和政策。
  设备解绑/恢复出厂：若客户询问解绑、factory reset、unbind、给他人使用等，请根据 FAQ 或政策说明步骤；若需后台解绑或无法自行操作，可引导提供设备 SN 并联系 support-center@comulytic.ai（非 Amazon 渠道可提供邮箱）。
  硬件驱动：参考上下文中的 DEVICE_STATUS（如 SN、电量、AI 余额）。如果用户 AI 余额为 0，必须明确提及并引导充值。
  渠道合规：[重要] 若 tags 中包含 'amazon'，严禁出现任何 URL 链接、外部邮箱、或诱导评论的词汇；可写「请联系客服」或「请提供 SN 后我们协助解绑」等。
  人设规范：严禁表明 AI 身份；语气专业且有同理心；回复限制在 2-4 段，保持简洁。
  信息对齐：确认已收到用户提到的订单号或 SN 码，不要重复询问。
  输出要求：仅输出回复文本内容。
  ```

**后端逻辑**：  
- **context**：先来自 `product_docs/faq.json` 的 FAQs；若配置了 `RAG_SERVICE_URL`，再用 `(subject + description + conversationHistory)` 前 1500 字做 RAG 检索，把 FAQ chunks、历史案例、设备状态拼进 context；设备状态未命中时用 body 里的 `device_sn`、`ai_minutes_balance` 等拼成 `deviceStatus` 文案。  
- **agentInstruction**：若有 `customInstruction` 则 `"Reply in the customer's language. " + customInstruction`，否则 `getReplyLanguageInstruction(customerLanguage) + " Tone: " + getToneInstruction(tone). You must reply in the same language as the customer's messages."`。  
- 用 template + instruction 拼好 prompt，调用 LLM，temperature=0.5。  
- 返回 `{ reply: text.trim() }`，无后处理。

---

## 提示词文件位置与后备

| 环境           | 提示词文件 |
|----------------|------------|
| 默认           | `product_docs/prompts.json` |
| 仅部署 backend（如 Railway） | 不存在时用 `backend/prompts.json` |

修改提示词后：若部署了整仓，改 `product_docs/prompts.json` 即可；若只部署 backend，需同步更新 `backend/prompts.json`。

---

## 汇总表

| 接口 | 前端关键入参 | 输出语言/依据 | temperature |
|------|--------------|----------------|-------------|
| /evaluate-priority | subject, description, requesterEmail, tags, **lang** | reason 用 **lang**（中文/English/日本語） | 0.2 |
| /translate | text, **targetLang** | 译文为 **targetLang** 指定语言，且无标签/前缀 | 0.2 |
| /summarize | subject, description, conversationHistory, **lang** | summary、replyPoints 均为 **lang** 对应语言 | 0.2 |
| /suggest-reply | 全量工单 + **conversationHistory**（全篇）, **customerLanguage**, customInstruction | 回复使用 **customerLanguage**（与客户同语言），综合全篇会话 | 0.5 |
