# 当前 RAG 逻辑说明

购置服务器后，若启用 RAG，按以下逻辑部署即可。

---

## 一、整体流程

```
[离线，一次性或定期]
  历史工单 JSON + FAQ + 可选工单评分（ticket_ratings.json 或 JSON 内 satisfaction_rating）
       ↓
  process_data.py（大模型脱水 + 嵌入，写入 satisfaction_rating 元数据）
       ↓
  ChromaDB 持久化（faq 集合 + history_qa 集合，history 带 satisfaction_rating）

[在线，与 Node 后端同时运行]
  客服打开工单 → 点击「生成回复」
       ↓
  Node 后端收到 /suggest-reply
       ↓
  若配置了 RAG_SERVICE_URL → 请求 RAG 服务 POST /context（query = 工单摘要）
       ↓
  retriever.py：用 query 做向量检索，历史案例按**服务评分优先**（good > unknown > bad）排序后取 top 2 + top 3 FAQ + device_status
       ↓
  Node 把检索结果拼入 prompt，再调 OpenRouter/OpenAI 生成建议回复
```

---

## 二、离线：process_data.py

| 步骤 | 说明 |
|------|------|
| 输入 | `TICKETS_JSON_DIR` 下所有 `ticket_{id}.json`；`FAQ_JSON`（及可选 `FAQ_DIR`）；可选 `RATINGS_FILE` 或工单内 `satisfaction_rating`/`rating` |
| 处理 | 过滤无效对话 → 每条工单用大模型「脱水」：提取用户问题核心 + 客服解决策略，脱敏；读取工单评分（good/bad/unknown）→ FAQ 拆成片段 |
| 输出 | ChromaDB 两个集合：`faq`（FAQ 片段）、`history_qa`（脱水后的历史 Q&A，含 `satisfaction_rating` 元数据） |
| 何时跑 | 本机或服务器上定期跑（如每周），或历史数据更新后跑一次。需 `OPENAI_API_KEY`（嵌入 + 脱水）。 |

---

## 三、在线：retriever.py

| 步骤 | 说明 |
|------|------|
| 启动 | `python retriever.py --serve`，默认监听 5001 |
| 接口 | `POST /context`，body：`{ "query": "工单摘要", "n_faq": 3, "n_history": 2, "ticket_context": { ... } }` |
| 逻辑 | 用 query 做向量检索 ChromaDB → 返回最相关 3 条 FAQ + 2 条历史案例；`ticket_context` 原样作为 `device_status` 带回 |
| 依赖 | 同机或可访问的 ChromaDB 持久化目录（即 process_data.py 写出的 `chroma_db/`） |

---

## 四、Node 后端如何使用 RAG

| 条件 | 行为 |
|------|------|
| 未设置 `RAG_SERVICE_URL` | 不请求 RAG；建议回复仅用 `product_docs/faq.json` + 当前工单内容。 |
| 已设置 `RAG_SERVICE_URL`（如 `http://127.0.0.1:5001`） | 在 **生成建议回复** 时，先 `fetchRagContext(工单摘要)`，把返回的 `faq_chunks`、`history_cases` 拼入 prompt 的「Product/FAQ & 检索上下文」，`device_status` 拼入「设备状态」；再调 LLM。 |

**注意**：优先级、翻译、总结**不**走 RAG，只有「建议回复」会用到 RAG 检索结果。

---

## 五、服务器上部署顺序（启用 RAG 时）

1. 在同一台 VM 上部署 **Node 后端**（如 3000 端口）+ **Nginx 反代 HTTPS**。
2. 安装 Python 与依赖，把 `rag/` 和 ChromaDB 持久化目录放到该 VM。
3. **离线**：在本机或服务器跑通一次 `process_data.py`，生成 `chroma_db/`。
4. **在线**：启动 `retriever.py --serve`（如 5001），用 systemd/pm2 保活。
5. 设置 Node 的环境变量 `RAG_SERVICE_URL=http://127.0.0.1:5001`（同机时用 localhost）。
6. 重启 Node，侧栏点击「生成回复」即会带出 RAG 检索到的 FAQ + 历史案例。

---

更细的路径与接口见 `rag/README_RAG.md`。
