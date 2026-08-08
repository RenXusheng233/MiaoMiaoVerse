"""Knowledge base retrieval: pgvector search with keyword fallback.

Query embeddings are computed live by the local model (document embeddings
are precomputed and stored in PostgreSQL). search() is the stable seam —
chat routes depend only on this signature.
"""

import logging
import threading

from sqlmodel import Session

from data.knowledge import KNOWLEDGE_DOCS, KnowledgeDoc
from db import engine
from repositories import knowledge as repo

logger = logging.getLogger(__name__)

_EMBEDDING_MODEL = "BAAI/bge-small-zh-v1.5"
_DEFAULT_TOP_K = 3
_MAX_DIST = 0.55  # cosine distance; 1 - 0.45 similarity floor

_lock = threading.Lock()
_embedder = None
_embedding_failed = False


def _get_embedder():
    """Lazy-load the local embedding model once (process singleton)."""
    global _embedder, _embedding_failed
    if _embedder is not None or _embedding_failed:
        return _embedder
    with _lock:
        if _embedder is not None or _embedding_failed:
            return _embedder
        try:
            from langchain_community.embeddings import SentenceTransformerEmbeddings
            _embedder = SentenceTransformerEmbeddings(model_name=_EMBEDDING_MODEL)
        except Exception:
            _embedding_failed = True
            _embedder = None
    return _embedder


def search(query: str, top_k: int = _DEFAULT_TOP_K) -> list[KnowledgeDoc]:
    """pgvector cosine search; keyword fallback ONLY when the embedder or the
    vector path fails. An empty vector result is a valid answer (nothing in
    the knowledge base passes the distance floor)."""
    embedder = _get_embedder()
    if embedder is not None:
        try:
            query_vec = embedder.embed_query(query)
            with Session(engine) as session:
                return repo.search(session, query_vec, top_k=top_k, max_dist=_MAX_DIST)
        except Exception:
            logger.warning("pgvector search failed, falling back to keyword search", exc_info=True)
            pass  # fall through to keyword search
    return _keyword_search(query, top_k)


def _keyword_search(query: str, top_k: int) -> list[KnowledgeDoc]:
    """Fallback: score docs by character hits in title (x2) and content (x1)."""
    scored: list[tuple[int, KnowledgeDoc]] = []
    for doc in KNOWLEDGE_DOCS:
        score = sum(2 if ch in doc.title else 1 if ch in doc.content else 0 for ch in query)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda x: -x[0])
    return [doc for _, doc in scored[:top_k]]
