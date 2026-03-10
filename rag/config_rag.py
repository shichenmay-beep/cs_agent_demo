# RAG 配置：路径与 API 可从环境变量覆盖
import os

# 历史工单 JSON 目录（每个文件 ticket_{id}.json）
_DEFAULT_TICKETS = os.path.join(os.path.dirname(__file__), "..", "..", "output", "json")
if not os.path.isdir(_DEFAULT_TICKETS):
    _DEFAULT_TICKETS = "/Users/shichen/data_sync/output/json"
TICKETS_JSON_DIR = os.environ.get("TICKETS_JSON_DIR", _DEFAULT_TICKETS)
# FAQ：优先用桌面 faq 文件夹或项目内 product_docs
FAQ_DIR = os.environ.get("FAQ_DIR", "")
FAQ_JSON = os.environ.get("FAQ_JSON", os.path.join(os.path.dirname(__file__), "..", "product_docs", "faq.json"))
# ChromaDB 持久化目录
CHROMA_PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", os.path.join(os.path.dirname(__file__), "chroma_db"))
# 集合名
CHROMA_FAQ_COLLECTION = "faq"
CHROMA_HISTORY_COLLECTION = "history_qa"
# 工单服务评分：可选 JSON 文件，key 为 ticket_id（字符串），value 为 "good"|"bad"，供 RAG 优先参考高评分工单
RATINGS_FILE = os.environ.get("RATINGS_FILE", os.path.join(os.path.dirname(__file__), "ticket_ratings.json"))
# OpenAI API（用于嵌入与脱水 LLM）
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_API_BASE", None)  # OpenRouter 等
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
