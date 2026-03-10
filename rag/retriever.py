#!/usr/bin/env python3
"""
在线 RAG 检索：根据工单摘要从向量库取最相关 FAQ + 历史案例，并整合设备状态。
- get_relevant_context(query) → { faq_chunks, history_cases, device_status }
- 可单独运行为 HTTP 服务，供 Node 后端调用。
"""
import json
import os
import sys

import config_rag as conf

try:
    import chromadb
    from chromadb.config import Settings
except ImportError:
    chromadb = None

_client = None
_embed_client = None


def get_embed_client():
    global _embed_client
    if _embed_client is None and conf.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            _embed_client = OpenAI(
                api_key=conf.OPENAI_API_KEY,
                base_url=conf.OPENAI_BASE_URL if conf.OPENAI_BASE_URL else None
            )
        except Exception:
            pass
    return _embed_client


def get_chroma():
    global _client
    if _client is None and os.path.isdir(conf.CHROMA_PERSIST_DIR):
        try:
            _client = chromadb.PersistentClient(path=conf.CHROMA_PERSIST_DIR, settings=Settings(anonymized_telemetry=False))
        except Exception as e:
            sys.stderr.write(f"ChromaDB init failed: {e}\n")
    return _client


def embed_query(text):
    """单条文本转为向量。"""
    client = get_embed_client()
    if not client:
        return None
    try:
        r = client.embeddings.create(model=conf.EMBEDDING_MODEL, input=[text])
        return r.data[0].embedding
    except Exception as e:
        sys.stderr.write(f"Embedding error: {e}\n")
        return None


def get_device_status(device_sn=None, ticket_context=None):
    """
    整合设备状态：SN、电量、固件、AI 余额。
    若未接入 Comulytic 接口，返回占位或从 ticket_context 中读取（由 Node 传入）。
    """
    # 可从环境变量或外部 API 读取；此处为占位，实际由 Node 后端传入或调 Comulytic API
    out = {
        "device_sn": device_sn or os.environ.get("DEVICE_SN", ""),
        "battery": os.environ.get("DEVICE_BATTERY", ""),
        "firmware_version": os.environ.get("DEVICE_FIRMWARE", ""),
        "ai_minutes_balance": os.environ.get("DEVICE_AI_BALANCE", ""),
    }
    if ticket_context and isinstance(ticket_context, dict):
        out["device_sn"] = ticket_context.get("device_sn") or out["device_sn"]
        out["battery"] = ticket_context.get("battery") or out["battery"]
        out["firmware_version"] = ticket_context.get("firmware_version") or out["firmware_version"]
        out["ai_minutes_balance"] = ticket_context.get("ai_minutes_balance") or out["ai_minutes_balance"]
    return out


def get_relevant_context(query, n_faq=3, n_history=2, device_sn=None, ticket_context=None):
    """
    语义检索：返回最相关的 n_faq 条 FAQ、n_history 条历史案例，以及设备状态。
    """
    result = {
        "faq_chunks": [],
        "history_cases": [],
        "device_status": get_device_status(device_sn=device_sn, ticket_context=ticket_context),
    }
    if not query or not query.strip():
        return result

    db = get_chroma()
    vec = embed_query(query.strip())
    if vec is None:
        return result

    try:
        # FAQ
        coll_faq = db.get_collection(conf.CHROMA_FAQ_COLLECTION)
        n = min(n_faq, coll_faq.count()) or 1
        faq_res = coll_faq.query(query_embeddings=[vec], n_results=n)
        if faq_res and faq_res.get("documents") and faq_res["documents"][0]:
            result["faq_chunks"] = faq_res["documents"][0]
    except Exception as e:
        sys.stderr.write(f"Chroma FAQ query error: {e}\n")
    try:
        # History：多取一些候选，按服务评分优先（good > unknown > bad）再取前 n_history
        coll_hist = db.get_collection(conf.CHROMA_HISTORY_COLLECTION)
        total = coll_hist.count()
        if total == 0:
            pass
        else:
            fetch_n = min(max(n_history * 4, n_history), total)
            hist_res = coll_hist.query(query_embeddings=[vec], n_results=fetch_n, include=["documents", "metadatas"])
            if hist_res and hist_res.get("documents") and hist_res["documents"][0]:
                docs = hist_res["documents"][0]
                metas = (hist_res.get("metadatas") or [[]])[0]
                order = {"good": 0, "unknown": 1, "bad": 2}
                indexed = [(doc, metas[i] if i < len(metas) else {}) for i, doc in enumerate(docs)]
                indexed.sort(key=lambda x: order.get(str((x[1].get("satisfaction_rating") or "unknown")).lower(), 1))
                result["history_cases"] = [x[0] for x in indexed[:n_history]]
    except Exception as e:
        sys.stderr.write(f"Chroma history query error: {e}\n")

    return result


def run_http_server(host="127.0.0.1", port=5001):
    """作为 HTTP 服务运行，供 Node 后端调用。"""
    from flask import Flask, request, jsonify
    app = Flask(__name__)

    @app.route("/context", methods=["GET", "POST"])
    def context():
        if request.method == "POST":
            data = request.get_json() or {}
            query = data.get("query", "")
            n_faq = int(data.get("n_faq", 3))
            n_history = int(data.get("n_history", 2))
            ticket_context = data.get("ticket_context") or data.get("device_status")
            device_sn = data.get("device_sn")
        else:
            query = request.args.get("query", "")
            n_faq = int(request.args.get("n_faq", 3))
            n_history = int(request.args.get("n_history", 2))
            ticket_context = None
            device_sn = request.args.get("device_sn")
        ctx = get_relevant_context(query=query, n_faq=n_faq, n_history=n_history, device_sn=device_sn, ticket_context=ticket_context)
        return jsonify(ctx)

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "chroma": get_chroma() is not None})

    print(f"RAG retriever listening on http://{host}:{port}")
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", "-q", default="", help="Query for context (optional)")
    ap.add_argument("--serve", action="store_true", help="Run HTTP server for Node backend")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=5001)
    args = ap.parse_args()
    if args.serve:
        run_http_server(host=args.host, port=args.port)
    elif args.query:
        out = get_relevant_context(args.query)
        print(json.dumps(out, ensure_ascii=False, indent=2))
    else:
        print("Usage: python retriever.py --query 'order refund' | python retriever.py --serve")
