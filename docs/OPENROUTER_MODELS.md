# OpenRouter 模型推荐（客服侧栏：以文本为主）

后端通过 OpenRouter 调用大模型，在 VM 或本机设置 `OPENAI_MODEL`（或写入 `backend/config.json`）即可切换。Base 保持 `https://openrouter.ai/api/v1`。

## 长上下文模型（会话/工单很长时优先）

工单或会话条数多、内容长时，若模型上下文不够可能被截断，导致总结/建议回复不完整。可改用**长上下文**模型再试：

| 模型 ID | 上下文约 | 说明 |
|--------|----------|------|
| **google/gemini-2.0-flash-001** | **约 100 万 token** | 推荐：上下文长、价格适中，适合长会话 |
| **google/gemini-2.5-pro** | 约 100 万 token | 能力更强，长会话 + 高回复质量 |
| **google/gemini-2.5-flash** | 较短 | 默认之一，会话不长时够用 |

在环境变量或 `config.json` 里把 `OPENAI_MODEL` 设为 `google/gemini-2.0-flash-001` 即可切换到长上下文模型。

---

## 推荐模型（文本 / 图文均支持）

| 模型 ID | 说明 | 适用场景 |
|--------|------|----------|
| **google/gemini-2.5-flash** | 速度快、价格低，文本与简单图文都不错 | 工单总结/回复/优先级，会话不长时 |
| **google/gemini-2.0-flash-001** | 1M 上下文，适合长会话 | **会话或工单很长时优先** |
| **google/gemini-2.5-pro** | 能力更强、推理更好，长上下文 | 需要更高回复质量或长会话 |
| **google/gemini-2.0-flash-exp** | 实验版 Flash，迭代快 | 想用最新能力时可试 |
| **anthropic/claude-sonnet-4.5** | 文本质量好，支持图文 | 重视英文/多语言回复质量 |
| **openai/gpt-4o** | 文本+图像均衡 | 需要稳定多模态时 |

## Gemini 3 / 3.1（预览，能力新、价格有优势）

| 模型 ID | 说明 |
|--------|------|
| **google/gemini-3.1-flash-lite-preview** | 最便宜，适合纯文本/轻量图文 |
| **google/gemini-3-flash-preview** | Flash 预览，文本+多模态 |
| **google/gemini-3.1-pro-preview** / **google/gemini-3-pro-preview** | Pro 预览，能力更强 |

## 仅文本、要更便宜

| 模型 ID | 说明 |
|--------|------|
| **openai/gpt-4o-mini** | 便宜、延迟低，纯文本足够 |
| **google/gemini-2.5-flash-lite** | 比 2.5-flash 更轻量 |

## 配置方式

- **环境变量**（推荐，VM 上）：  
  `OPENAI_MODEL=google/gemini-2.5-flash`
- **本地覆盖**：在 `backend/config.json` 里写  
  `"OPENAI_MODEL": "google/gemini-2.5-flash"`

完整模型列表与价格：<https://openrouter.ai/models>

---

## 一天约 40 条工单的 LLM 费用估算

按「40 条工单/天」、每工单打开侧栏（优先级+翻译+总结）+ 部分点击生成回复（建议回复+直译），约 **160 次** 后端请求，对应约 **16 万 input tokens + 4.5 万 output tokens/天** 的粗算：

| 模型 | 约 USD/天 | 约 USD/月（按 22 天） |
|------|-----------|------------------------|
| **google/gemini-2.5-flash**（默认） | **≈ $0.15–0.20** | **≈ $3–5** |
| **google/gemini-3.1-flash-lite-preview** | **≈ $0.10–0.12** | **≈ $2–3** |
| google/gemini-3-flash-preview | ≈ $0.20–0.25 | ≈ $4–6 |
| google/gemini-2.5-pro | ≈ $0.60–0.80 | ≈ $13–18 |
| google/gemini-3.1-pro-preview / 3-pro-preview | ≈ $0.85–1.00 | ≈ $19–22 |
| anthropic/claude-sonnet-4.5 | ≈ $1.20–1.50 | ≈ $26–33 |
| openai/gpt-4o | ≈ $0.90–1.10 | ≈ $20–24 |

实际费用以 OpenRouter 账单为准；工单量或每工单调用次数增加时，按比例放大即可。
