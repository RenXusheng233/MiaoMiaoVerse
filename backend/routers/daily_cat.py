import random
from datetime import date

from fastapi import APIRouter, Depends
from sqlmodel import Session

from db import get_session
from repositories import cats as repo
from schemas.daily_cat import DailyCatResponse

router = APIRouter(prefix="/api/daily-cat", tags=["daily-cat"])


@router.get("", response_model=DailyCatResponse)
async def get_daily_cat(session: Session = Depends(get_session)):
    """Return today's featured cat. Same result for all requests on the same day."""
    today = date.today()
    seed = int(today.strftime("%Y%m%d"))
    return DailyCatResponse(
        breed=repo.random_breed(session, seed=seed),
        date=today.isoformat(),
        is_daily=True,
    )


@router.get("/random", response_model=DailyCatResponse)
async def get_random_cat(exclude_id: str | None = None, session: Session = Depends(get_session)):
    """Return a random cat, optionally excluding the current one (for 换一只)."""
    return DailyCatResponse(
        breed=repo.random_breed(session, exclude_id=exclude_id),
        date=date.today().isoformat(),
        is_daily=False,
    )
