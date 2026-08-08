"""SQLModel table model for cat breeds. The single source of truth in PostgreSQL."""

from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Column, Field, SQLModel


class CatBreedRow(SQLModel, table=True):
    __tablename__ = "cat_breeds"

    id: str = Field(primary_key=True)          # e.g. "ragdoll"
    name_zh: str
    name_en: str
    origin: str
    size: str                                   # 小型 / 中型 / 大型
    coat: str                                   # 短毛 / 长毛 / 无毛
    quote: str
    meme_tags: list[str] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False))
    suitable_owners: list[str] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False))
    image_url: str
    scores: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False))   # 手工分
    ai_scores: dict | None = Field(default=None, sa_column=Column(JSONB))                 # AI 生成分,读取优先
