"""Batch-generate radar scores for cat breeds into the JSON cache.

Usage (from backend/):
    uv run python -m scripts.generate_radar              # all breeds
    uv run python -m scripts.generate_radar --cat ragdoll  # single breed
    uv run python -m scripts.generate_radar --force        # regenerate even if cached
"""

import argparse

from data.cats import CAT_BREEDS
from services import radar_scores


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="generate_radar",
        description="Generate radar scores for cat breeds via LLM and write them to the JSON cache.",
    )
    parser.add_argument("--cat", help="Only generate this breed id (default: all)")
    parser.add_argument(
        "--force", action="store_true", help="Regenerate even when a cached score exists"
    )
    args = parser.parse_args()

    breeds = [b for b in CAT_BREEDS if not args.cat or b.id == args.cat]
    if not breeds:
        parser.error(f"Unknown breed id: {args.cat}")

    ok: list[str] = []
    failed: list[tuple[str, str]] = []

    for breed in breeds:
        try:
            scores = radar_scores.generate_scores(breed, force=args.force)
        except radar_scores.RadarGenerationError as exc:
            failed.append((breed.id, str(exc)))
            print(f"[FAIL] {breed.id} ({breed.name_zh}): {exc}")
            continue

        ok.append(breed.id)
        print(
            f"[ OK ] {breed.id} ({breed.name_zh}): "
            f"拆家={scores.demolition} 粘人={scores.clingy} "
            f"掉毛={scores.shedding} 掉钱包={scores.cost} 颜值={scores.looks}"
        )

    print(f"\nDone: {len(ok)} succeeded, {len(failed)} failed")
    for breed_id, error in failed:
        print(f"  - {breed_id}: {error}")


if __name__ == "__main__":
    main()
