from fastapi import APIRouter, HTTPException, Query

from data.cats import CAT_INDEX
from schemas.daily_cat import CatBreed
from schemas.radar_scores import RadarScoresResponse
from services import radar_scores

router = APIRouter(prefix="/api/cats", tags=["cats"])


@router.get("", response_model=list[CatBreed])
async def list_cats(
    q: str | None = Query(None, description="按名称搜索(中文或英文)"),
    size: str | None = Query(None, description="体型筛选:小型 / 中型 / 大型"),
    coat: str | None = Query(None, description="毛发筛选:短毛 / 长毛 / 无毛"),
    owner: str | None = Query(None, description="适养人群筛选:久坐打工人 / 多金学生党 / 佛系老年人 / 家有儿童"),
):
    """Return all cat breeds (generated radar scores take precedence), with optional filtering."""
    result = radar_scores.merge_breeds()

    if q:
        q_lower = q.lower()
        result = [
            c for c in result
            if q_lower in c.name_zh or q_lower in c.name_en.lower()
        ]
    if size:
        result = [c for c in result if c.size == size]
    if coat:
        result = [c for c in result if c.coat == coat]
    if owner:
        result = [c for c in result if owner in c.suitable_owners]

    return result


@router.get("/{cat_id}", response_model=CatBreed)
async def get_cat(cat_id: str):
    """Return a single cat breed by ID (with generated radar scores if present)."""
    breed = CAT_INDEX.get(cat_id)
    if not breed:
        raise HTTPException(status_code=404, detail=f"Cat breed '{cat_id}' not found")

    generated = radar_scores.get_scores(cat_id)
    if generated:
        breed = breed.model_copy(update={"scores": generated})
    return breed


@router.post("/{cat_id}/radar-scores", response_model=RadarScoresResponse)
def generate_cat_radar_scores(
    cat_id: str,
    force: bool = Query(False, description="跳过缓存,强制重新生成"),
):
    """Generate radar scores for a breed via LLM; returns the cache entry on repeat calls."""
    breed = CAT_INDEX.get(cat_id)
    if not breed:
        raise HTTPException(status_code=404, detail=f"Cat breed '{cat_id}' not found")

    cached = radar_scores.get_scores(cat_id)
    if cached and not force:
        return RadarScoresResponse(scores=cached, source="cached")

    try:
        scores = radar_scores.generate_scores(breed, force=force)
    except radar_scores.RadarGenerationError:
        raise HTTPException(status_code=502, detail="AI 评分生成失败,请稍后重试")

    return RadarScoresResponse(scores=scores, source="generated")
