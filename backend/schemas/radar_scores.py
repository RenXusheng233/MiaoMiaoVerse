from typing import Literal

from pydantic import BaseModel

from schemas.daily_cat import CatScores


class RadarScoresResponse(BaseModel):
    scores: CatScores
    source: Literal["generated", "cached"]  # newly generated vs cache hit
