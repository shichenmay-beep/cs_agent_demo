# 当前部署的最新逻辑（概要）

适用于本仓库推送到 GitHub 后、Railway 用 **Root Directory = backend** 部署的版本。提示词来源：Railway 上只有 `backend/`，故读 **backend/prompts.json**（与 product_docs/prompts.json 保持同步）。

**lang 与 reasonLang**：都是「客服偏好语言」（用户侧栏选择，默认中文）。前端只传 **lang**（zh/en/ja）；**reasonLang** 是后端根据 lang 算出的展示名（中文/English/日本語），仅用于优先级接口的提示词里，让模型用该语言写 reason。本质同一套设置。

---

## 一、配置与启动

- **环境变量**：优先读 `process.env`（Railway Variables），其次 `backend/.env`、`backend/config.json`。  
  - 需配置：`OPENAI_API_KEY`、`OPENAI_API_BASE`（如 `https://openrouter.ai/api/v1`）、`OPENAI_MODEL`。
- **提示词**：先读 `../product_docs/prompts.json`，不存在则读 **`backend/prompts.json`**（Railway 部署时只有后者）。
- **监听**：`PORT` 由环境注入，默认 3000；`HOST` 默认 `0.0.0.0`。
- **健康检查**：`GET /health` → `{ ok: true, service: 'cs-agent-backend' }`。

---

## 二、四个接口与逻辑

### 1. POST /evaluate-priority

- **入参**：`subject`, `description`, `requesterEmail`, `tags`, **`lang`**（前端传的客服偏好语言，默认中文；zh/en/ja）。
- **逻辑**：后端用 `lang` 算出 **reasonLang**（zh→「中文」, en→「English」, ja→「日本語」），仅用于在提示词里告诉模型「用哪种语言写 reason」；本质和 lang 是同一套偏好。拼 prompt 时强调 reason 必须用该语言书写、不跟随工单内容语言；LLM temperature=0.2；解析 JSON 取 `priority`、`reason`。
- **出参**：`{ priority, reason }`。

### 2. POST /translate

- **入参**：`text`, **`targetLang`**（zh/en/ja）。
- **逻辑**：`target = TARGET_LANG_MAP[targetLang]`；用 prompts.translate 拼 prompt，要求仅输出译文、无语言标签；LLM 返回后做 **去掉 `[xxx]` 前缀**：`translation.replace(/^\[[^\]]+\]\s*/, '')`。
- **出参**：`{ translation }`。

### 3. POST /summarize

- **入参**：`subject`, `description`, `conversationHistory`, **`lang`**（客服偏好语言）。
- **逻辑**：`content = subject + description + conversationHistory`；`lang` 映射为输出语言名；用 prompts.summary 要求输出 JSON，**summary 与 replyPoints 均用该语言**；temperature=0.2。
- **出参**：`{ summary, replyPoints }`。

### 4. POST /suggest-reply

- **入参**：`subject`, `description`, `requesterName`, `tags`, **`conversationHistory`**（完整会话）, `customInstruction`（可选）, **`customerLanguage`**（客户使用语言）。
- **逻辑**：context = faq.json + 可选 RAG（若配置了 RAG_SERVICE_URL）；agentInstruction 含「与客户同语言」；用 prompts.reply，强调 **综合完整会话、不可只针对最后一条**；LLM temperature=0.5。
- **出参**：`{ reply }`。

---

## 三、提示词要点（backend/prompts.json）

| 模块 | 要点 |
|------|------|
| **priority** | P0–P3 四级；reason 用 **reasonLang** 书写；明确「无论工单何种语言，reason 仅用 reasonLang，不跟随工单语言」。 |
| **translate** | 目标语言由 **target** 注入；instruction：仅输出译文，无标签/前缀/解释。 |
| **summary** | 输出语言由 **lang** 注入；summary 与 replyPoints 均为该语言。 |
| **reply** | 综合 **完整会话**；回复语言=客户语言；设备解绑/恢复出厂可引导 SN + support-center@comulytic.ai（非 Amazon）；Amazon 渠道不出现链接/邮箱。 |

---

## 四、前端侧栏（与部署一致）

- 打开工单即自动请求：优先级、翻译（用户最后一条）、工单总结、**建议回复**（默认生成一次）。
- 所有「客服偏好语言」由 **agent-lang** 下拉框决定，传给后端的 `lang` / `targetLang`。
- 建议回复区：无单独「生成回复」按钮；回复修改建议区块内有「生成回复」按钮，可填提示词后重新生成。
- 版本号：侧栏顶部显示 **v1.0.1**（manifest.json version），用于确认是否加载到最新包。

---

## 五、Railway 部署时注意

- **Root Directory** = **`backend`**（仓库根下直接有 `backend` 时）。
- **Variables** 必填：`OPENAI_API_KEY`、`OPENAI_API_BASE`、`OPENAI_MODEL`。
- 部署后无 `product_docs/`，提示词仅来自 **backend/prompts.json**；若在本地改了 product_docs/prompts.json，需同步到 backend/prompts.json 并 push 后重新部署才生效。
