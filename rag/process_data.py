#!/usr/bin/env python3
"""
离线数据预处理：历史工单脱水 + FAQ 结构化 → 写入 ChromaDB。
- 从 output/json/ticket_*.json 读取工单，用大模型提取「用户问题核心」+「客服解决策略」，并脱敏。
- 从 faq.json（或 FAQ_DIR）读取 FAQ，拆成「场景 + 步骤 + 注意事项」片段。
- 结果写入 ChromaDB，供 retriever 在线检索。
"""
import json
import os
import re
import sys
from pathlib import Path

try:
    import chromadb
    from chromadb.config import Settings
except ImportError:
    print("Run: pip install chromadb", file=sys.stderr)
    sys.exit(1)

# 配置
import config_rag as conf


def get_openai_client():
    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=conf.OPENAI_API_KEY,
            base_url=conf.OPENAI_BASE_URL if conf.OPENAI_BASE_URL else None
        )
        return client
    except Exception as e:
        print(f"OpenAI client init failed: {e}", file=sys.stderr)
        return None


def load_faq_docs():
    """加载 FAQ：优先 FAQ_JSON，若有 FAQ_DIR 则合并该目录下 json。"""
    docs = []
    if conf.FAQ_JSON and os.path.isfile(conf.FAQ_JSON):
        with open(conf.FAQ_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
        for item in data.get("faqs", []):
            topic = item.get("topic", "")
            content = item.get("content", "")
            if topic or content:
                docs.append({"topic": topic, "content": content, "source": "faq.json"})
    if conf.FAQ_DIR and os.path.isdir(conf.FAQ_DIR):
        for p in Path(conf.FAQ_DIR).rglob("*.json"):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data.get("faqs", data) if isinstance(data.get("faqs", data), list) else [data]:
                    if isinstance(item, dict):
                        topic = item.get("topic", "")
                        content = item.get("content", item.get("content", ""))
                        if topic or content:
                            docs.append({"topic": topic, "content": str(content), "source": str(p.name)})
            except Exception as e:
                print(f"Skip {p}: {e}", file=sys.stderr)
    return docs


def load_ticket_files():
    """加载所有 ticket_{id}.json。"""
    if not os.path.isdir(conf.TICKETS_JSON_DIR):
        return []
    files = []
    for f in Path(conf.TICKETS_JSON_DIR).glob("ticket_*.json"):
        try:
            with open(f, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            if isinstance(data, dict) and "comments" in data:
                files.append(data)
        except Exception as e:
            print(f"Skip {f}: {e}", file=sys.stderr)
    return files


# 工单评分缓存（从 ticket_ratings.json 或工单 JSON 内字段读取）
_ratings_cache = None


def get_ticket_rating(ticket):
    """返回工单服务评分：good / bad / unknown。优先从工单 JSON 的 satisfaction_rating/rating 取，否则从 RATINGS_FILE 映射表取。"""
    global _ratings_cache
    tid = ticket.get("ticket_id")
    # 1) 工单自身字段（导出时若带评分）
    for key in ("satisfaction_rating", "rating", "satisfaction"):
        v = ticket.get(key)
        if v is None:
            continue
        if isinstance(v, bool):
            return "good" if v else "bad"
        s = str(v).lower()
        if s in ("good", "positive", "yes", "1"):
            return "good"
        if s in ("bad", "negative", "no", "0"):
            return "bad"
    # 2) 独立评分文件
    if _ratings_cache is None and getattr(conf, "RATINGS_FILE", None) and os.path.isfile(conf.RATINGS_FILE):
        try:
            with open(conf.RATINGS_FILE, "r", encoding="utf-8") as f:
                _ratings_cache = json.load(f)
        except Exception:
            _ratings_cache = {}
    if _ratings_cache and tid is not None:
        v = _ratings_cache.get(str(tid))
        if v in ("good", "bad"):
            return v
    return "unknown"


def is_invalid_conversation(ticket):
    """过滤无效对话：无实质内容或仅打招呼。"""
    comments = ticket.get("comments", [])
    if len(comments) < 2:
        return True
    bodies = [c.get("body", "") for c in comments if c.get("body")]
    text = " ".join(bodies).lower().strip()
    if len(text) < 20:
        return True
    if re.match(r"^(hi|hello|hey|thanks|thank you)[\s\.\!]*$", text[:50]):
        return True
    return False


def dehydrate_ticket_with_llm(client, ticket):
    """用大模型从单条工单提取：用户问题核心 + 客服解决策略，并脱敏。"""
    subject = ticket.get("subject", "")
    comments = ticket.get("comments", [])
    conv = []
    for c in comments:
        role = c.get("role", "customer")
        body = (c.get("body") or "").strip()
        if body:
            conv.append(f"{role}: {body}")
    conversation = "\n".join(conv)
    if not conversation.strip():
        return None

    prompt = """你是一个客服知识提取专家。请对下面这条工单对话做「脱水」处理：
1. 用户问题核心：用 1～2 句话概括客户的主要诉求或问题。
2. 客服解决策略：用 1～3 句话概括客服的回复要点或解决方案。
3. 脱敏：自动剔除姓名、电话、邮箱、具体地址等个人隐私信息，用 [已脱敏] 或通用表述代替。

要求：只输出一个 JSON，格式如下，不要其他解释。
{"problem": "用户问题核心", "solution": "客服解决策略"}

工单主题：%s

对话内容：
%s
""" % (subject[:200], conversation[:4000])

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        text = (resp.choices[0].message.content or "").strip()
        # 去掉 markdown 代码块
        if "```" in text:
            text = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
        # 取 JSON：先找第一个 { 再匹配到最后一个 }
        start = text.find("{")
        if start >= 0:
            end = text.rfind("}")
            if end > start:
                obj = json.loads(text[start : end + 1])
                if obj.get("problem") or obj.get("solution"):
                    return {
                        "ticket_id": ticket.get("ticket_id"),
                        "problem": obj.get("problem", ""),
                        "solution": obj.get("solution", ""),
                        "subject": subject[:200]
                    }
    except Exception as e:
        print(f"LLM dehydrate ticket {ticket.get('ticket_id')}: {e}", file=sys.stderr)
    return None


def faq_to_chunks(faq_docs):
    """将 FAQ 转为「场景 + 步骤 + 注意事项」文本片段，便于检索。"""
    chunks = []
    for d in faq_docs:
        topic = d.get("topic", "")
        content = d.get("content", "")
        text = f"[{topic}]\n{content}" if topic else content
        if text.strip():
            chunks.append({"text": text, "topic": topic})
    return chunks


def run():
    client = get_openai_client()
    if not client or not conf.OPENAI_API_KEY:
        print("Set OPENAI_API_KEY to run LLM dehydration.", file=sys.stderr)
        # 仍可只做 FAQ 入库
        client = None

    # 1) FAQ 结构化并写入 Chroma
    faq_docs = load_faq_docs()
    faq_chunks = faq_to_chunks(faq_docs)
    print(f"FAQ chunks: {len(faq_chunks)}")

    # 2) 历史工单脱水（可选）
    tickets = load_ticket_files()
    history_qa = []
    if client:
        for i, t in enumerate(tickets):
            if is_invalid_conversation(t):
                continue
            qa = dehydrate_ticket_with_llm(client, t)
            if qa:
                qa["satisfaction_rating"] = get_ticket_rating(t)
                history_qa.append(qa)
            if (i + 1) % 50 == 0:
                print(f"Processed {i + 1}/{len(tickets)} tickets")
        print(f"History Q&A pairs: {len(history_qa)}")
    else:
        print("Skipping ticket dehydration (no API key).")

    # 3) 嵌入并写入 ChromaDB（需要 embedding API）
    if not conf.OPENAI_API_KEY:
        print("No OPENAI_API_KEY; skipping ChromaDB write.", file=sys.stderr)
        return

    try:
        emb_client = get_openai_client()
        def embed(texts):
            r = emb_client.embeddings.create(model=conf.EMBEDDING_MODEL, input=texts)
            return [e.embedding for e in r.data]
    except Exception as e:
        print(f"Embedding init failed: {e}", file=sys.stderr)
        return

    persist_path = conf.CHROMA_PERSIST_DIR
    os.makedirs(persist_path, exist_ok=True)
    db = chromadb.PersistentClient(path=persist_path, settings=Settings(anonymized_telemetry=False))

    # FAQ 集合
    if faq_chunks:
        texts = [c["text"] for c in faq_chunks]
        ids = [f"faq_{i}" for i in range(len(texts))]
        embeddings = embed(texts)
        coll_faq = db.get_or_create_collection(conf.CHROMA_FAQ_COLLECTION, metadata={"description": "FAQ chunks"})
        existing = coll_faq.get()
        if existing["ids"]:
            coll_faq.delete(ids=existing["ids"])
        coll_faq.add(ids=ids, embeddings=embeddings, documents=texts, metadatas=[{"topic": c["topic"]} for c in faq_chunks])
        print(f"ChromaDB: {len(texts)} FAQ documents added.")

    # 历史案例集合
    if history_qa:
        texts = [f"问题: {q['problem']}\n解决: {q['solution']}" for q in history_qa]
        ids = [f"hist_{q['ticket_id']}" for q in history_qa]
        embeddings = embed(texts)
        coll_hist = db.get_or_create_collection(conf.CHROMA_HISTORY_COLLECTION, metadata={"description": "Historical Q&A"})
        existing = coll_hist.get()
        if existing["ids"]:
            coll_hist.delete(ids=existing["ids"])
        coll_hist.add(ids=ids, embeddings=embeddings, documents=texts, metadatas=[{"ticket_id": q["ticket_id"], "subject": q["subject"][:100], "satisfaction_rating": q.get("satisfaction_rating", "unknown")} for q in history_qa])
        print(f"ChromaDB: {len(texts)} history Q&A documents added.")

    print("Done.")


if __name__ == "__main__":
    run()
