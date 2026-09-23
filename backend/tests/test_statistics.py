"""Exercise statistics against a dedicated temporary database, never user data."""

from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app import models
from app.routers import statistics


NOW = datetime(2026, 9, 14, 12)


class StatisticsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="memoricks-statistics-")
        self.engine = create_engine(
            f"sqlite:///{Path(self.temp.name).as_posix()}/test.db",
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(bind=self.engine)
        test_app = FastAPI()
        test_app.include_router(statistics.router)

        def test_db():
            with self.session() as db:
                yield db

        test_app.dependency_overrides[get_db] = test_db
        self.client = TestClient(test_app)
        self.clock = patch("app.routers.statistics.utc_now", return_value=NOW)
        self.stats_clock = patch("app.crud.utc_now", return_value=NOW)
        self.clock.start()
        self.stats_clock.start()
        with self.session() as db:
            db.add_all([models.Group(id=1, title="Idiomas"), models.Group(id=2, title="Tecnologia")])
            db.flush()
            db.add_all([
                models.Subgroup(id=1, group_id=1, title="Inglês", template={}),
                models.Subgroup(id=2, group_id=1, title="Italiano", template={}),
                models.Subgroup(id=3, group_id=2, title="Python", template={}),
            ])
            db.commit()

    def tearDown(self):
        self.clock.stop()
        self.stats_clock.stop()
        self.client.close()
        self.engine.dispose()
        self.temp.cleanup()

    def card(self, subgroup_id=1, **changes):
        with self.session() as db:
            count = db.query(models.Card).count()
            card = models.Card(
                subgroup_id=subgroup_id, text=f"Card {count}", input_key=f"card {count}",
                values={}, template={}, template_version=1,
                created_at=NOW - timedelta(days=10),
                next_review_date=NOW - timedelta(minutes=1),
            )
            for key, value in changes.items():
                setattr(card, key, value)
            db.add(card)
            db.commit()
            return card.id

    def test_current_counts_filtering_and_distribution_match_review_eligibility(self):
        self.card()
        self.card(next_review_date=NOW + timedelta(hours=1))
        self.card(needs_attention=True)
        self.card(mastered=True, mastered_at=NOW - timedelta(days=2))
        self.card(subgroup_id=3)
        body = self.client.get("/statistics?days=7").json()
        self.assertEqual(body["summary"], {
            "total": 5, "active": 4, "pending": 2, "learned": 1, "percent": 20, "attention": 1, "reviewable": 3,
        })
        self.assertEqual(len(body["groups"]), 2)
        self.assertEqual(sum(row["stats"]["total"] for row in body["distribution"]), 5)
        filtered = self.client.get("/statistics?group_id=1&subgroup_id=1").json()
        self.assertEqual(filtered["summary"]["total"], 4)
        self.assertEqual(filtered["summary"]["pending"], 1)
        self.assertEqual(filtered["distribution_level"], "subgroups")
        self.assertEqual([row["title"] for row in filtered["distribution"]], ["Inglês"])
        self.assertFalse(body["review_history_available"])

    def test_timeline_uses_local_dates_and_retained_mastered_cards_only(self):
        self.card(mastered=True, mastered_at=NOW - timedelta(days=40))
        self.card(mastered=True, mastered_at=datetime(2026, 9, 14, 1), created_at=datetime(2026, 9, 14, 1))
        self.card(mastered=True, mastered_at=None)
        self.card(mastered=False, mastered_at=NOW - timedelta(days=1))
        deleted_id = self.card(mastered=True, mastered_at=NOW)
        with self.session() as db:
            db.delete(db.get(models.Card, deleted_id))
            db.commit()
        body = self.client.get("/statistics?days=7&utc_offset_minutes=-180").json()
        self.assertEqual(len(body["timeline"]), 7)
        self.assertEqual(body["timeline"][0]["learned_total"], 1)
        self.assertEqual(body["timeline"][-2], {
            "date": "2026-09-13", "learned": 1, "learned_total": 2, "created": 1,
        })
        self.assertEqual(body["timeline"][-1]["learned_total"], 2)
        self.assertEqual(body["learned_without_date"], 1)
        self.assertEqual(body["summary"]["learned"], 3)

    def test_empty_subgroup_has_zero_series_and_subgroup_infers_group(self):
        body = self.client.get("/statistics?subgroup_id=2&days=90").json()
        self.assertEqual(body["summary"]["total"], 0)
        self.assertEqual(len(body["timeline"]), 90)
        self.assertTrue(all(point["learned_total"] == point["created"] == 0 for point in body["timeline"]))
        self.assertEqual(body["distribution_level"], "subgroups")
        self.assertEqual(len(body["distribution"]), 1)

    def test_invalid_filters_are_rejected(self):
        for query, status in [
            ("group_id=99", 404), ("subgroup_id=99", 404),
            ("group_id=2&subgroup_id=1", 400), ("days=999999", 422),
            ("utc_offset_minutes=900", 422), ("group_id=-1", 422),
        ]:
            with self.subTest(query=query):
                self.assertEqual(self.client.get(f"/statistics?{query}").status_code, status)

    def test_all_time_starts_at_first_card_in_local_time_and_keeps_group_filter(self):
        self.card(created_at=datetime(2024, 1, 2, 1), mastered=True, mastered_at=NOW)
        self.card(subgroup_id=3, created_at=NOW)
        body = self.client.get("/statistics?days=all&utc_offset_minutes=-180").json()
        self.assertEqual(body["period"]["start"], "2024-01-01")
        self.assertEqual(body["period"]["end"], "2026-09-14")
        self.assertGreater(body["period"]["days"], 365)
        self.assertEqual(len(body["timeline"]), body["period"]["days"])
        self.assertEqual(body["timeline"][0]["created"], 1)
        self.assertEqual(body["timeline"][-1]["learned_total"], 1)
        filtered = self.client.get("/statistics?days=all&group_id=2&utc_offset_minutes=-180").json()
        self.assertEqual(filtered["period"], body["period"])
        self.assertEqual(filtered["summary"]["total"], 1)
        self.assertEqual(filtered["timeline"][0]["created"], 0)
        self.assertEqual(filtered["timeline"][-1]["created"], 1)

    def test_all_time_empty_library_and_first_card_today_have_one_day(self):
        for populated in (False, True):
            with self.subTest(populated=populated):
                if populated:
                    self.card(created_at=NOW)
                response = self.client.get("/statistics?days=all")
                self.assertEqual(response.status_code, 200)
                body = response.json()
                self.assertEqual(body["period"], {"days": 1, "start": "2026-09-14", "end": "2026-09-14"})
                self.assertEqual(len(body["timeline"]), 1)
                self.assertEqual(body["timeline"][0]["created"], int(populated))


if __name__ == "__main__":
    unittest.main()
