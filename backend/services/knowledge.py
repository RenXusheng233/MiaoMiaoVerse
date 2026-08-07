# backend/services/knowledge.py
"""Knowledge base: document loading, local embedding, and retrieval abstraction.

The vector store is in-memory for now; a future vector database (pgvector /
Milvus) replaces only the store construction in _get_store().
"""

import threading

from data.knowledge import KNOWLEDGE_DOCS, KnowledgeDoc

_EMBEDDING_MODEL = "BAAI/bge-small-zh-v1.5"
_DEFAULT_TOP_K = 3
# Similarity floor; hits below this count as "no knowledge". Set to 0.45 after
# measuring bge-small-zh-v1.5 on this corpus: every doc's top-1 title query
# scores >= 0.56 (worst: heatstroke 0.5566), while an unrelated query peaked at
# 0.3798. 0.35 (brief draft) let unrelated noise (0.38) through.
_MIN_SCORE = 0.45

_lock = threading.Lock()
_embedder = None
_store = None
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


def _get_store():
    """Lazy-build the in-memory vector store from KNOWLEDGE_DOCS."""
    global _store
    if _store is not None:
        return _store
    # NOTE: _get_embedder() must run OUTSIDE _lock — it acquires the same
    # non-reentrant lock, and acquiring it again on this thread would deadlock.
    embedder = _get_embedder()
    if embedder is None:
        return None
    with _lock:
        if _store is not None:
            return _store
        from langchain_core.documents import Document
        from langchain_community.vectorstores import InMemoryVectorStore

        docs = [
            Document(
                page_content=d.content,
                metadata={"id": d.id, "title": d.title, "category": d.category},
            )
            for d in KNOWLEDGE_DOCS
        ]
        _store = InMemoryVectorStore.from_documents(docs, embedding=embedder)
    return _store


def search(query: str, top_k: int = _DEFAULT_TOP_K) -> list[KnowledgeDoc]:
    """Vector similarity search; keyword fallback when the embedding model
    or store is unavailable. Hits below _MIN_SCORE are dropped."""
    store = _get_store()
    if store is not None:
        try:
            results = store.similarity_search_with_score(query, k=top_k)
            return [
                _doc_from_metadata(result.metadata)
                for result, score in results
                if score >= _MIN_SCORE
            ]
        except Exception:
            pass
    return _keyword_search(query, top_k)


def _doc_from_metadata(metadata: dict) -> KnowledgeDoc:
    return next(d for d in KNOWLEDGE_DOCS if d.id == metadata["id"])


def _keyword_search(query: str, top_k: int) -> list[KnowledgeDoc]:
    """Fallback: score docs by character hits in title (x2) and content (x1)."""
    scored: list[tuple[int, KnowledgeDoc]] = []
    for doc in KNOWLEDGE_DOCS:
        score = sum(2 if ch in doc.title else 1 if ch in doc.content else 0 for ch in query)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda x: -x[0])
    return [doc for _, doc in scored[:top_k]]
