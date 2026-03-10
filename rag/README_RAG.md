# RAG 知识增强引擎

离线预处理历史工单 + FAQ，在线检索增强生成（建议回复 / 总结）。

## 一、离线数据预处理

### 1. 环境

```bash
cd cs_agent_demo/rag
pip install -r requirements_rag.txt
```

需配置 `OPENAI_API_KEY`（用于嵌入与工单脱水）。可选 `OPENAI_API_BASE`（如 OpenRouter）。

### 2. 配置路径（环境变量）

| 变量 | 说明 | 默认 |
|------|------|------|
| `TICKETS_JSON_DIR` | 历史工单 JSON 目录（`ticket_{id}.json`） | `/Users/shichen/data_sync/output/json` |
| `FAQ_JSON` | 单文件 FAQ（如 `product_docs/faq.json`） | 项目内 `../product_docs/faq.json` |
| `FAQ_DIR` | 可选：桌面 FAQ 文件夹，多文件合并 | 空 |
| `CHROMA_PERSIST_DIR` | ChromaDB 持久化目录 | `rag/chroma_db` |
| `RATINGS_FILE` | 工单评分 JSON：`ticket_id` → `"good"`/`"bad"`，检索时优先参考 good | 可选，`rag/ticket_ratings.json` |

### 3. 执行预处理

```bash
export OPENAI_API_KEY=sk-...
python process_data.py
```

- 从 `FAQ_JSON`（及可选 `FAQ_DIR`）加载 FAQ，转为检索片段写入 ChromaDB。
- 从 `TICKETS_JSON_DIR` 读取所有 `ticket_*.json`，过滤无效对话后调用大模型「脱水」：提取**用户问题核心** + **客服解决策略**，并脱敏。工单评分来自：JSON 内字段 `satisfaction_rating`/`rating`（若导出时有），或 `RATINGS_FILE` 映射表；写入 ChromaDB 时带上 `satisfaction_rating`（good/bad/unknown），**检索时优先参考评分高的工单**。

## 二、在线 RAG 检索服务

### 启动 HTTP 服务（供 Node 后端调用）

```bash
export OPENAI_API_KEY=sk-...
python retriever.py --serve
# 默认 http://127.0.0.1:5001
```

- `POST /context`：body `{ "query": "工单摘要或用户问题", "n_faq": 3, "n_history": 2, "ticket_context": { "device_sn", "battery", "ai_minutes_balance" } }`，返回 `{ faq_chunks, history_cases, device_status }`。
- `GET /health`：检查 Chroma 是否就绪。

### Node 后端集成

在运行 `server.js` 的环境里设置：

```bash
export RAG_SERVICE_URL=http://127.0.0.1:5001
```

后端在生成「建议回复」时会先请求 RAG 的 `/context`，将检索到的 FAQ + 历史案例拼入上下文，并带入设备状态（SN、电量、AI 余额等）；亚马逊渠道会遵守 prompts 中的「严禁 URL」等规则。

## 三、业务规则（prompts.json）

- **Priority**：P0–P3 四级（业务事实 + 情绪加权），输出 `{"priority":"P0"|"P1"|"P2"|"P3","reason":"..."}`。
- **Reply**：FAQ 优先、硬件驱动（AI 余额为 0 引导充值）、渠道合规（amazon 禁 URL）、人设与信息对齐。
- **Summary**：客户诉求总结、关键实体与情绪；回复要点含特别动作（设备离线建议检查物理开关、Amazon 注明严禁链接）；脱敏。

设备状态可由 Zendesk 侧栏或其它系统传入 `ticket_context` / 请求体 `device_sn`、`ai_minutes_balance` 等，RAG 服务会原样带回，供生成时使用。
