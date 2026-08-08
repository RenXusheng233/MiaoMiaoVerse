"""Data access for cat breeds. Rows are converted to response models here,
so routers and the API contract stay stable."""

import random

from sqlmodel import Session, select

from models.cat import CatBreedRow
from schemas.daily_cat import CatBreed, CatScores


def _to_response(row: CatBreedRow) -> CatBreed:
    """Row -> response model; ai_scores take precedence over manual scores."""
    scores = row.ai_scores or row.scores
    return CatBreed(
        id=row.id,
        name_zh=row.name_zh,
        name_en=row.name_en,
        origin=row.origin,
        size=row.size,
        coat=row.coat,
        quote=row.quote,
        meme_tags=row.meme_tags,
        suitable_owners=row.suitable_owners,
        image_url=row.image_url,
        scores=CatScores(**scores),
    )


def list_breeds(
    session: Session,
    q: str | None = None,
    size: str | None = None,
    coat: str | None = None,
    owner: str | None = None,
) -> list[CatBreed]:
    stmt = select(CatBreedRow)
    if size:
        stmt = stmt.where(CatBreedRow.size == size)
    if coat:
        stmt = stmt.where(CatBreedRow.coat == coat)
    if owner:
        stmt = stmt.where(CatBreedRow.suitable_owners.contains([owner]))  # JSONB @>
    rows = session.exec(stmt).all()
    if q:
        q_lower = q.lower()
        rows = [r for r in rows if q_lower in r.name_zh or q_lower in r.name_en.lower()]
    return [_to_response(r) for r in rows]


def get_breed(session: Session, cat_id: str) -> CatBreed | None:
    row = session.get(CatBreedRow, cat_id)
    return _to_response(row) if row else None


def random_breed(session: Session, exclude_id: str | None = None, seed: int | None = None) -> CatBreed:
    """Pick a random breed; with a seed the pick is deterministic (daily cat)."""
    rows = session.exec(select(CatBreedRow).order_by(CatBreedRow.id)).all()
    pool = [r for r in rows if r.id != exclude_id] if exclude_id else rows
    if not pool:
        pool = rows
    rng = random.Random(seed) if seed is not None else random
    return _to_response(rng.choice(pool))


def get_ai_scores(session: Session, cat_id: str) -> CatScores | None:
    row = session.get(CatBreedRow, cat_id)
    if not row or not row.ai_scores:
        return None
    return CatScores(**row.ai_scores)


def update_ai_scores(session: Session, cat_id: str, scores: CatScores) -> bool:
    """Persist AI-generated scores; returns False when the breed is missing."""
    row = session.get(CatBreedRow, cat_id)
    if not row:
        return False
    row.ai_scores = scores.model_dump()
    session.add(row)
    session.commit()
    return True


def create_breed(session: Session, data) -> CatBreed:
    row = CatBreedRow(
        id=data.id,
        name_zh=data.name_zh,
        name_en=data.name_en,
        origin=data.origin,
        size=data.size,
        coat=data.coat,
        quote=data.quote,
        meme_tags=data.meme_tags,
        suitable_owners=data.suitable_owners,
        image_url=data.image_url,
        scores=data.scores.model_dump(),
        ai_scores=None,
    )
    session.add(row)
    session.commit()
    return _to_response(row)


def update_breed(session: Session, cat_id: str, data) -> CatBreed | None:
    """Full update of base fields + manual scores; ai_scores is NEVER touched here."""
    row = session.get(CatBreedRow, cat_id)
    if not row:
        return None
    row.name_zh = data.name_zh
    row.name_en = data.name_en
    row.origin = data.origin
    row.size = data.size
    row.coat = data.coat
    row.quote = data.quote
    row.meme_tags = data.meme_tags
    row.suitable_owners = data.suitable_owners
    row.image_url = data.image_url
    row.scores = data.scores.model_dump()
    session.add(row)
    session.commit()
    return _to_response(row)


def delete_breed(session: Session, cat_id: str) -> bool:
    row = session.get(CatBreedRow, cat_id)
    if not row:
        return False
    session.delete(row)
    session.commit()
    return True
