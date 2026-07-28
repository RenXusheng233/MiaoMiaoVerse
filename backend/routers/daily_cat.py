import random
from datetime import date

from fastapi import APIRouter

from data.cats import CAT_BREEDS
from schemas.daily_cat import DailyCatResponse

router = APIRouter(prefix="/api/daily-cat", tags=["daily-cat"])


def _pick_cat(seed: int):
    rng = random.Random(seed)
    return rng.choice(CAT_BREEDS)


@router.get("", response_model=DailyCatResponse)
async def get_daily_cat():
    """Return today's featured cat. Same result for all requests on the same day."""
    today = date.today()
    seed = int(today.strftime("%Y%m%d"))
    return DailyCatResponse(
        breed=_pick_cat(seed),
        date=today.isoformat(),
        is_daily=True,
    )


@router.get("/random", response_model=DailyCatResponse)
async def get_random_cat(exclude_id: str | None = None):
    """Return a random cat, optionally excluding the current one (for 换一只)."""
    pool = [c for c in CAT_BREEDS if c.id != exclude_id] if exclude_id else CAT_BREEDS
    if not pool:
        pool = CAT_BREEDS
    breed = random.choice(pool)
    return DailyCatResponse(
        breed=breed,
        date=date.today().isoformat(),
        is_daily=False,
    )
