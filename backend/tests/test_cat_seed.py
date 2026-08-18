import os
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
import unittest
from unittest.mock import patch

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://test:test@localhost:5432/test",
)

from data.cats import CAT_BREEDS
from models.cat import CatBreedRow
from scripts.seed_db import _build_parser, _sync


class _RowsResult:
    def __init__(self, rows: list[CatBreedRow]) -> None:
        self._rows = rows

    def all(self) -> list[CatBreedRow]:
        return self._rows


class _FakeSession:
    def __init__(self, rows: list[CatBreedRow]) -> None:
        self.rows = rows
        self.added_history: list[CatBreedRow] = []
        self._pending: list[CatBreedRow] = []
        self.commits = 0

    def exec(self, _statement: object) -> _RowsResult:
        return _RowsResult(self.rows)

    def add(self, row: CatBreedRow) -> None:
        self.added_history.append(row)
        self._pending.append(row)

    def commit(self) -> None:
        known_ids = {row.id for row in self.rows}
        for row in self._pending:
            if row.id not in known_ids:
                self.rows.append(row)
                known_ids.add(row.id)
        self._pending.clear()
        self.commits += 1


def _row_from_seed(
    breed,
    ai_scores: dict[str, int] | None = None,
) -> CatBreedRow:
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


class CatSeedTests(unittest.TestCase):
    def test_insert_missing_and_reset_are_mutually_exclusive(self) -> None:
        parser = _build_parser()

        with self.assertRaises(SystemExit), redirect_stderr(StringIO()):
            parser.parse_args(["--insert-missing", "--reset"])

    def test_seed_contains_twenty_unique_breeds(self) -> None:
        ids = [breed.id for breed in CAT_BREEDS]

        self.assertEqual(len(ids), 20)
        self.assertEqual(len(set(ids)), 20)

    def test_flagged_empty_sync_ignores_legacy_ai_scores(self) -> None:
        session = _FakeSession([])
        legacy_scores = {
            CAT_BREEDS[0].id: {
                "demolition": 1,
                "clingy": 2,
                "shedding": 3,
                "cost": 4,
                "looks": 5,
            }
        }

        with (
            patch(
                "scripts.seed_db._load_legacy_ai_scores",
                return_value=legacy_scores,
            ),
            redirect_stdout(StringIO()),
        ):
            _sync(session, insert_missing=True)

        self.assertEqual(len(session.rows), 20)
        self.assertTrue(all(row.ai_scores is None for row in session.rows))

    def test_sync_inserts_nine_missing_rows_and_preserves_other_data(self) -> None:
        generated_scores = {
            "demolition": 1,
            "clingy": 2,
            "shedding": 3,
            "cost": 4,
            "looks": 5,
        }
        existing_seed_rows = [
            _row_from_seed(breed, generated_scores if index == 0 else None)
            for index, breed in enumerate(CAT_BREEDS[:11])
        ]
        api_created = CatBreedRow(
            id="api_created_cat",
            name_zh="接口创建猫",
            name_en="API-created cat",
            origin="测试地区",
            size="中型",
            coat="短毛",
            quote="测试语录",
            meme_tags=["测试标签"],
            suitable_owners=["久坐打工人"],
            image_url="https://example.com/api-created.jpg",
            scores={
                "demolition": 5,
                "clingy": 5,
                "shedding": 5,
                "cost": 5,
                "looks": 5,
            },
            ai_scores=None,
        )
        session = _FakeSession([*existing_seed_rows, api_created])

        with redirect_stdout(StringIO()):
            _sync(session, insert_missing=True)

        inserted_ids = {
            row.id
            for row in session.added_history
            if row.id not in {existing.id for existing in existing_seed_rows}
        }
        self.assertEqual(inserted_ids, {breed.id for breed in CAT_BREEDS[11:]})
        self.assertIn(api_created, session.rows)
        self.assertEqual(
            existing_seed_rows[0].ai_scores,
            generated_scores,
        )
        self.assertTrue(
            all(
                row.ai_scores is None
                for row in session.rows
                if row.id in {breed.id for breed in CAT_BREEDS[11:]}
            )
        )
        self.assertEqual(len(session.rows), 21)
        self.assertEqual(session.commits, 1)

        with redirect_stdout(StringIO()):
            _sync(session, insert_missing=True)

        self.assertEqual(len(session.rows), 21)
        self.assertEqual(session.commits, 2)

    def test_sync_preserves_default_skip_missing_behavior(self) -> None:
        existing = _row_from_seed(CAT_BREEDS[0])
        session = _FakeSession([existing])

        with redirect_stdout(StringIO()):
            _sync(session)

        self.assertEqual(session.added_history, [existing])
        self.assertEqual(session.rows, [existing])
        self.assertEqual(session.commits, 1)


if __name__ == "__main__":
    unittest.main()
