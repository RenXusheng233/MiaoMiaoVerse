from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from db import get_session
from repositories import cats as repo
from schemas.cat_manage import CatBreedCreate, CatBreedUpdate
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
    session: Session = Depends(get_session),
):
    """Return all cat breeds (ai_scores take precedence), with optional filtering."""
    return repo.list_breeds(session, q=q, size=size, coat=coat, owner=owner)


@router.get("/{cat_id}", response_model=CatBreed)
async def get_cat(cat_id: str, session: Session = Depends(get_session)):
    """Return a single cat breed by ID."""
    breed = repo.get_breed(session, cat_id)
    if not breed:
        raise HTTPException(status_code=404, detail=f"Cat breed '{cat_id}' not found")
    return breed


@router.post("/{cat_id}/radar-scores", response_model=RadarScoresResponse)
def generate_cat_radar_scores(
    cat_id: str,
    force: bool = Query(False, description="跳过缓存,强制重新生成"),
    session: Session = Depends(get_session),
):
    """Generate radar scores via LLM; DB ai_scores cached on repeat calls."""
    breed = repo.get_breed(session, cat_id)
    if not breed:
        raise HTTPException(status_code=404, detail=f"Cat breed '{cat_id}' not found")

    cached = repo.get_ai_scores(session, cat_id)
    if cached and not force:
        return RadarScoresResponse(scores=cached, source="cached")

    try:
        scores = radar_scores.generate_scores(session, breed, force=force)
    except radar_scores.RadarGenerationError:
        raise HTTPException(status_code=502, detail="AI 评分生成失败,请稍后重试")

    return RadarScoresResponse(scores=scores, source="generated")


@router.post("", response_model=CatBreed, status_code=201)
def create_cat(data: CatBreedCreate, session: Session = Depends(get_session)):
    """Create a new breed; ai_scores start empty (generated via radar-scores)."""
    if repo.get_breed(session, data.id) is not None:
        raise HTTPException(status_code=409, detail=f"Cat breed '{data.id}' already exists")
    return repo.create_breed(session, data)


@router.put("/{cat_id}", response_model=CatBreed)
def update_cat(cat_id: str, data: CatBreedUpdate, session: Session = Depends(get_session)):
    """Full update of base fields + manual scores; ai_scores is never touched."""
    breed = repo.update_breed(session, cat_id, data)
    if not breed:
        raise HTTPException(status_code=404, detail=f"Cat breed '{cat_id}' not found")
    return breed


@router.delete("/{cat_id}", status_code=204)
def delete_cat(cat_id: str, session: Session = Depends(get_session)):
    """Delete a breed and its ai_scores (single row)."""
    if not repo.delete_breed(session, cat_id):
        raise HTTPException(status_code=404, detail=f"Cat breed '{cat_id}' not found")
