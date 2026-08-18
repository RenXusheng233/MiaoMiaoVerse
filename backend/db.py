"""Database engine, request-scoped session dependency, and initialization."""

import json
import logging
import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv
from sqlmodel import Session, SQLModel, create_engine, select

from models.cat import CatBreedRow
from models.knowledge import KnowledgeDocRow

logger = logging.getLogger(__name__)

load_dotenv(override=True)
_raw_url = os.getenv("DATABASE_URL")
if not _raw_url:
    raise RuntimeError("DATABASE_URL not set in backend/.env")

# SQLAlchemy 2.x needs the explicit +psycopg dialect for psycopg3
DB_URL = _raw_url.replace("postgresql://", "postgresql+psycopg://", 1)

# psycopg3 rejects unknown URL query params (e.g. "?schema=public" from .env),
# so translate the schema param into the standard search_path connection option.
_url_parts = urlsplit(DB_URL)
_url_query = dict(parse_qsl(_url_parts.query))
_schema = _url_query.pop("schema", None)
DB_URL = urlunsplit(
    (_url_parts.scheme, _url_parts.netloc, _url_parts.path, urlencode(_url_query), _url_parts.fragment)
)
_connect_args: dict[str, object] = {}
if _schema:
    _connect_args["options"] = f"-csearch_path={_schema}"

engine = create_engine(DB_URL, connect_args=_connect_args)

CACHE_PATH = Path(__file__).resolve().parent / "data" / "generated_scores.json"


def get_session():
    """FastAPI dependency: yield a request-scoped Session."""
    with Session(engine) as session:
        yield session


def _load_legacy_ai_scores() -> dict[str, dict]:
    """One-time migration source: generated_scores.json (retired after seed)."""
    if not CACHE_PATH.exists():
        return {}
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, TypeError, ValueError):
        return {}


def _seed_if_empty() -> None:
    """Import the 20 seed breeds (manual scores + legacy AI scores) when the table is empty."""
    from data.cats import CAT_BREEDS

    with Session(engine) as session:
        if session.exec(select(CatBreedRow)).first() is not None:
            return
        ai_scores = _load_legacy_ai_scores()
        for breed in CAT_BREEDS:
            session.add(
                CatBreedRow(
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
                    ai_scores=ai_scores.get(breed.id),
                )
            )
        session.commit()


def _seed_knowledge_if_empty() -> None:
    """Import the 18 knowledge docs (with precomputed embeddings) when empty."""
    from data.knowledge import KNOWLEDGE_DOCS
    from services.knowledge import _get_embedder

    with Session(engine) as session:
        if session.exec(select(KnowledgeDocRow)).first() is not None:
            return
        docs = list(KNOWLEDGE_DOCS)
        embeddings: list[list[float]] | None = None
        embedder = _get_embedder()
        if embedder is not None:
            try:
                embeddings = embedder.embed_documents([d.content for d in docs])
            except Exception:
                logger.warning("knowledge embedding failed during seed; importing docs with NULL embedding", exc_info=True)
                embeddings = None  # docs still imported with NULL embedding
        for doc, emb in zip(docs, embeddings or [None] * len(docs)):
            session.add(
                KnowledgeDocRow(
                    id=doc.id,
                    category=doc.category,
                    title=doc.title,
                    content=doc.content,
                    embedding=emb,
                )
            )
        session.commit()


def init_db() -> None:
    """Create tables (idempotent), then seed when empty. Called at app startup."""
    SQLModel.metadata.create_all(engine)
    _seed_if_empty()
    _seed_knowledge_if_empty()
