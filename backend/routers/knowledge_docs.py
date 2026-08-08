from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from db import get_session
from repositories import knowledge as repo
from schemas.knowledge_manage import KnowledgeDocCreate, KnowledgeDocUpdate
from services import knowledge as knowledge_service

router = APIRouter(prefix="/api/knowledge-docs", tags=["knowledge-docs"])


def _compute_embedding(content: str) -> list[float]:
    """Embedding is mandatory for managed docs; failure is a 502, doc NOT stored."""
    embedder = knowledge_service._get_embedder()
    if embedder is None:
        raise HTTPException(status_code=502, detail="Embedding 模型不可用,请稍后重试")
    try:
        return embedder.embed_query(content)
    except Exception:
        raise HTTPException(status_code=502, detail="Embedding 计算失败,请稍后重试")


@router.get("")
async def list_docs(category: str | None = Query(None), session: Session = Depends(get_session)):
    return repo.list_docs(session, category=category)


@router.get("/{doc_id}")
async def get_doc(doc_id: str, session: Session = Depends(get_session)):
    doc = repo.get_doc(session, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Knowledge doc '{doc_id}' not found")
    return doc


@router.post("", status_code=201)
def create_doc(data: KnowledgeDocCreate, session: Session = Depends(get_session)):
    """Create a doc; embedding computed and stored atomically with the row."""
    if repo.get_doc(session, data.id) is not None:
        raise HTTPException(status_code=409, detail=f"Knowledge doc '{data.id}' already exists")
    embedding = _compute_embedding(data.content)
    return repo.create_doc(session, data, embedding)


@router.put("/{doc_id}")
def update_doc(doc_id: str, data: KnowledgeDocUpdate, session: Session = Depends(get_session)):
    """Full update; content changes recompute the embedding."""
    if repo.get_doc(session, doc_id) is None:
        raise HTTPException(status_code=404, detail=f"Knowledge doc '{doc_id}' not found")
    embedding = _compute_embedding(data.content)
    return repo.update_doc(session, doc_id, data, embedding)


@router.delete("/{doc_id}", status_code=204)
def delete_doc(doc_id: str, session: Session = Depends(get_session)):
    if not repo.delete_doc(session, doc_id):
        raise HTTPException(status_code=404, detail=f"Knowledge doc '{doc_id}' not found")
