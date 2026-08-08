from typing import Literal

from pydantic import BaseModel, Field

from schemas.daily_cat import CatScores


class CatBreedCreate(BaseModel):
    id: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    name_zh: str = Field(min_length=1, max_length=50)
    name_en: str = Field(min_length=1, max_length=50)
    origin: str = Field(min_length=1, max_length=50)
    size: Literal["小型", "中型", "大型"]
    coat: Literal["短毛", "长毛", "无毛"]
    quote: str = Field(min_length=1, max_length=200)
    meme_tags: list[str] = Field(min_length=1)
    suitable_owners: list[str] = Field(min_length=1)
    image_url: str = Field(min_length=1, max_length=500)
    scores: CatScores


class CatBreedUpdate(CatBreedCreate):
    """Full update; the body id is ignored — the path id wins."""
