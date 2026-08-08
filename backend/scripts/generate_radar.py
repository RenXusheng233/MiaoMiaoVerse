import argparse

from sqlmodel import Session, select

from db import engine
from models.cat import CatBreedRow
from repositories.cats import get_breed
from services import radar_scores


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="generate_radar",
        description="Generate radar scores for cat breeds via LLM and persist to ai_scores.",
    )
    parser.add_argument("--cat", help="Only generate this breed id (default: all)")
    parser.add_argument(
        "--force", action="store_true", help="Regenerate even when a cached score exists"
    )
    args = parser.parse_args()

    ok: list[str] = []
    failed: list[tuple[str, str]] = []

    with Session(engine) as session:
        rows = session.exec(select(CatBreedRow)).all()
        if args.cat:
            rows = [r for r in rows if r.id == args.cat]
        if not rows:
            parser.error(
                f"Unknown breed id: {args.cat}"
                if args.cat
                else "No breeds in the database — run `uv run python -m scripts.seed_db` first"
            )

        for row in rows:
            breed = get_breed(session, row.id)
            try:
                scores = radar_scores.generate_scores(session, breed, force=args.force)
            except radar_scores.RadarGenerationError as exc:
                failed.append((row.id, str(exc)))
                print(f"[FAIL] {row.id} ({row.name_zh}): {exc}")
                continue

            ok.append(row.id)
            print(
                f"[ OK ] {row.id} ({row.name_zh}): "
                f"拆家={scores.demolition} 粘人={scores.clingy} "
                f"掉毛={scores.shedding} 掉钱包={scores.cost} 颜值={scores.looks}"
            )

    print(f"\nDone: {len(ok)} succeeded, {len(failed)} failed")
    for breed_id, error in failed:
        print(f"  - {breed_id}: {error}")


if __name__ == "__main__":
    main()
