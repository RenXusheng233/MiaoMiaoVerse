"""Data access for the RAG knowledge base. Embeddings are computed by the
service/router layer and passed in — this layer stays model-free."""

from sqlmodel import Session, select

from data.knowledge import KnowledgeDoc
from models.knowledge import KnowledgeDocRow

_MAX_DIST = 0.55  # cosine distance floor; 1 - 0.45 similarity (calibrated on the corpus)


def _to_domain(row: KnowledgeDocRow) -> KnowledgeDoc:
    return KnowledgeDoc(id=row.id, category=row.category, title=row.title, content=row.content)


def list_docs(session: Session, category: str | None = None) -> list[KnowledgeDoc]:
    stmt = select(KnowledgeDocRow)
    if category:
        stmt = stmt.where(KnowledgeDocRow.category == category)
    return [_to_domain(r) for r in session.exec(stmt.order_by(KnowledgeDocRow.id)).all()]


def get_doc(session: Session, doc_id: str) -> KnowledgeDoc | None:
    row = session.get(KnowledgeDocRow, doc_id)
    return _to_domain(row) if row else None


def create_doc(session: Session, data, embedding: list[float] | None) -> KnowledgeDoc:
    row = KnowledgeDocRow(
        id=data.id, category=data.category, title=data.title,
        content=data.content, embedding=embedding,
    )
    session.add(row)
    session.commit()
    return _to_domain(row)


def update_doc(session: Session, doc_id: str, data, embedding: list[float] | None) -> KnowledgeDoc | None:
    row = session.get(KnowledgeDocRow, doc_id)
    if not row:
        return None
    row.category = data.category
    row.title = data.title
    row.content = data.content
    row.embedding = embedding  # content changed -> embedding must be recomputed
    session.add(row)
    session.commit()
    return _to_domain(row)


def delete_doc(session: Session, doc_id: str) -> bool:
    row = session.get(KnowledgeDocRow, doc_id)
    if not row:
        return False
    session.delete(row)
    session.commit()
    return True


def search(
    session: Session,
    query_embedding: list[float],
    top_k: int = 3,
    max_dist: float = _MAX_DIST,
) -> list[KnowledgeDoc]:
    """Cosine-distance search; embeddings NULL or beyond max_dist are excluded."""
    from pgvector.sqlalchemy import Vector

    # Bind the raw list: pgvector's Vector bind processor rejects the str
    # '[0.1, 0.2, ...]' form with ValueError ('expected list or ndarray').
    q = query_embedding
    stmt = (
        select(KnowledgeDocRow)
        .where(KnowledgeDocRow.embedding.is_not(None))
        .where(KnowledgeDocRow.embedding.cosine_distance(q) <= max_dist)
        .order_by(KnowledgeDocRow.embedding.cosine_distance(q))
        .limit(top_k)
    )
    return [_to_domain(r) for r in session.exec(stmt).all()]
