from typing import Annotated

from pydantic import BaseModel, Field

Score = Annotated[int, Field(ge=1, le=10)]


class CatScores(BaseModel):
    demolition: Score  # 拆家指数 1-10
    clingy: Score  # 粘人程度 1-10
    shedding: Score  # 掉毛指数 1-10
    cost: Score  # 掉钱包指数 1-10
    looks: Score  # 颜值指数 1-10


class CatBreed(BaseModel):
    id: str
    name_zh: str
    name_en: str
    origin: str
    size: str  # 小型 / 中型 / 大型
    coat: str  # 短毛 / 长毛 / 无毛
    quote: str  # 猫咪语录
    meme_tags: list[str]
    suitable_owners: list[str]  # 适养人群标签
    image_url: str
    scores: CatScores


class DailyCatResponse(BaseModel):
    breed: CatBreed
    date: str  # YYYY-MM-DD
    is_daily: bool  # True = 今日固定推荐, False = 随机换一只
