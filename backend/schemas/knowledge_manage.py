from typing import Literal

from pydantic import BaseModel, Field


class KnowledgeDocCreate(BaseModel):
    id: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    category: Literal["护理", "营养", "疾病"]
    title: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=10, max_length=2000)


class KnowledgeDocUpdate(KnowledgeDocCreate):
    """Full update; content changes force an embedding recompute."""
