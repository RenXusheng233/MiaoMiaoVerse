"""SQLModel table model for the RAG knowledge base. Embedding is a pgvector
column; NULL means the embedding failed and retrieval degrades to keywords."""

from pgvector.sqlalchemy import Vector
from sqlmodel import Column, Field, SQLModel


class KnowledgeDocRow(SQLModel, table=True):
    __tablename__ = "knowledge_docs"

    id: str = Field(primary_key=True)          # same ids as data/knowledge.py
    category: str                              # 护理 / 营养 / 疾病
    title: str
    content: str
    embedding: list[float] | None = Field(default=None, sa_column=Column(Vector(512)))
