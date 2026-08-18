"""Seed management for cat_breeds and knowledge_docs.

Usage (from backend/):
    uv run python -m scripts.seed_db            # --sync: empty table -> import all;
                                                #         non-empty -> update existing rows only
    uv run python -m scripts.seed_db --insert-missing
                                                # sync + insert missing seed rows
    uv run python -m scripts.seed_db --reset    # truncate then import from the seed file

Authority model: the DB is the single authority. --sync NEVER inserts rows for
breeds missing from the DB (use POST /api/cats instead) and NEVER deletes rows
(use DELETE /api/cats); it only refreshes the fields of existing rows. The same
applies to knowledge docs (use POST /api/knowledge-docs / DELETE instead), with
one difference: when a knowledge doc's content is refreshed, its embedding is
recomputed, because the embedding is a pure derivation of the content. The
explicit --insert-missing option adds only missing cat seed rows and leaves API-
created rows untouched.
"""

import argparse
import logging

from sqlmodel import Session, SQLModel, select

from data.cats import CAT_BREEDS
from data.knowledge import KNOWLEDGE_DOCS
from db import _load_legacy_ai_scores, engine
from models.cat import CatBreedRow
from models.knowledge import KnowledgeDocRow
from services.knowledge import _get_embedder

logger = logging.getLogger(__name__)


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


def _sync(session: Session, insert_missing: bool = False) -> None:
    rows = {r.id: r for r in session.exec(select(CatBreedRow)).all()}
    if not rows:
        # First import: full seed including legacy AI scores.
        ai = {} if insert_missing else _load_legacy_ai_scores()
        for breed in CAT_BREEDS:
            session.add(_row_from_seed(breed, ai.get(breed.id)))
        session.commit()
        print(f"Imported {len(CAT_BREEDS)} breeds (table was empty).")
        return

    updated = inserted = skipped = 0
    for breed in CAT_BREEDS:
        row = rows.get(breed.id)
        if row is None:
            if insert_missing:
                session.add(_row_from_seed(breed, None))
                inserted += 1
                continue
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
    if insert_missing:
        print(f"Synced {updated} breeds, inserted {inserted}, skipped {skipped}.")
    else:
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


def _compute_embeddings(contents: list[str]) -> list[list[float] | None]:
    """Batch-embed; any failure yields None per doc (NULL embedding -> keyword fallback)."""
    embedder = _get_embedder()
    if embedder is None:
        return [None] * len(contents)
    try:
        return embedder.embed_documents(contents)
    except Exception:
        logger.warning("knowledge embedding batch failed; docs will have NULL embeddings", exc_info=True)
        return [None] * len(contents)


def _sync_knowledge(session: Session) -> None:
    rows = {r.id: r for r in session.exec(select(KnowledgeDocRow)).all()}
    if not rows:
        contents = [d.content for d in KNOWLEDGE_DOCS]
        embeddings = _compute_embeddings(contents)
        for doc, emb in zip(KNOWLEDGE_DOCS, embeddings):
            session.add(
                KnowledgeDocRow(
                    id=doc.id, category=doc.category, title=doc.title,
                    content=doc.content, embedding=emb,
                )
            )
        session.commit()
        print(f"Imported {len(KNOWLEDGE_DOCS)} knowledge docs (table was empty).")
        return

    updated = skipped = 0
    contents = [d.content for d in KNOWLEDGE_DOCS]
    embeddings = _compute_embeddings(contents)
    for doc, emb in zip(KNOWLEDGE_DOCS, embeddings):
        row = rows.get(doc.id)
        if row is None:
            print(f"[skip] {doc.id} not in DB — use POST /api/knowledge-docs or --reset to insert")
            skipped += 1
            continue
        row.category = doc.category
        row.title = doc.title
        row.content = doc.content
        if emb is not None:
            row.embedding = emb  # content changed -> embedding recomputed (unlike cat_breeds sync)
        session.add(row)
        updated += 1
    session.commit()
    print(f"Synced {updated} knowledge docs, skipped {skipped} (not in DB).")


def _reset_knowledge(session: Session) -> None:
    for row in session.exec(select(KnowledgeDocRow)).all():
        session.delete(row)
    session.commit()
    contents = [d.content for d in KNOWLEDGE_DOCS]
    embeddings = _compute_embeddings(contents)
    for doc, emb in zip(KNOWLEDGE_DOCS, embeddings):
        session.add(
            KnowledgeDocRow(
                id=doc.id, category=doc.category, title=doc.title,
                content=doc.content, embedding=emb,
            )
        )
    session.commit()
    print(f"Reset: re-imported {len(KNOWLEDGE_DOCS)} knowledge docs from the seed file.")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="seed_db",
        description="Sync or reset cat_breeds and knowledge_docs from the seed files.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--insert-missing", action="store_true",
        help="Insert cat breeds present in the seed file but missing from the DB",
    )
    mode.add_argument(
        "--reset", action="store_true",
        help="Truncate both tables and re-import the seed files (drops API-created rows)",
    )
    return parser


def main() -> None:
    args = _build_parser().parse_args()

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        if args.reset:
            _reset(session)
            _reset_knowledge(session)
        else:
            _sync(session, insert_missing=args.insert_missing)
            _sync_knowledge(session)


if __name__ == "__main__":
    main()
