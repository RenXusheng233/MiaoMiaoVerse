"""Seed management for cat_breeds.

Usage (from backend/):
    uv run python -m scripts.seed_db            # --sync: empty table -> import all;
                                                #         non-empty -> update existing rows only
    uv run python -m scripts.seed_db --reset    # truncate then import from the seed file

Authority model: the DB is the single authority. --sync NEVER inserts rows for
breeds missing from the DB (use POST /api/cats instead) and NEVER deletes rows
(use DELETE /api/cats); it only refreshes the fields of existing rows.
"""

import argparse

from sqlmodel import Session, select

from data.cats import CAT_BREEDS
from db import _load_legacy_ai_scores, engine, init_db
from models.cat import CatBreedRow


def _row_from_seed(breed, ai_scores: dict | None) -> CatBreedRow:
    return CatBreedRow(
        id=breed.id,
        name_zh=breed.name_zh,
        name_en=breed.name_en,
        origin=breed.origin,
        size=breed.size,
        coat=breed.coat,
        quote=breed.quote,
        meme_tags=breed.meme_tags,
        suitable_owners=breed.suitable_owners,
        image_url=breed.image_url,
        scores=breed.scores.model_dump(),
        ai_scores=ai_scores,
    )


def _sync(session: Session) -> None:
    rows = {r.id: r for r in session.exec(select(CatBreedRow)).all()}
    if not rows:
        # First import: full seed including legacy AI scores.
        ai = _load_legacy_ai_scores()
        for breed in CAT_BREEDS:
            session.add(_row_from_seed(breed, ai.get(breed.id)))
        session.commit()
        print(f"Imported {len(CAT_BREEDS)} breeds (table was empty).")
        return

    updated = skipped = 0
    for breed in CAT_BREEDS:
        row = rows.get(breed.id)
        if row is None:
            print(f"[skip] {breed.id} not in DB — use POST /api/cats or --reset to insert")
            skipped += 1
            continue
        row.name_zh = breed.name_zh
        row.name_en = breed.name_en
        row.origin = breed.origin
        row.size = breed.size
        row.coat = breed.coat
        row.quote = breed.quote
        row.meme_tags = breed.meme_tags
        row.suitable_owners = breed.suitable_owners
        row.image_url = breed.image_url
        row.scores = breed.scores.model_dump()
        # ai_scores is intentionally NOT touched by --sync
        session.add(row)
        updated += 1
    session.commit()
    print(f"Synced {updated} breeds, skipped {skipped} (not in DB).")


def _reset(session: Session) -> None:
    for row in session.exec(select(CatBreedRow)).all():
        session.delete(row)
    session.commit()
    ai = _load_legacy_ai_scores()
    for breed in CAT_BREEDS:
        session.add(_row_from_seed(breed, ai.get(breed.id)))
    session.commit()
    print(f"Reset: re-imported {len(CAT_BREEDS)} breeds from the seed file.")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="seed_db",
        description="Sync or reset cat_breeds from the seed file (data/cats.py).",
    )
    parser.add_argument(
        "--reset", action="store_true",
        help="Truncate cat_breeds and re-import the seed file (drops API-created rows)",
    )
    args = parser.parse_args()

    init_db()
    with Session(engine) as session:
        if args.reset:
            _reset(session)
        else:
            _sync(session)


if __name__ == "__main__":
    main()
