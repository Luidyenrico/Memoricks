"""API regressions. Never use the user's database or call a real AI provider."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

TEMP = tempfile.TemporaryDirectory(prefix="memoricks-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(TEMP.name).as_posix()}/test.db"
os.environ["GROQ_API_KEY"] = ""

from app.main import app
from app import crud, generation, migrations, models, schemas
from app.database import Base, SessionLocal, engine
from app.routers import terms


CONTENT = {"translation": "olá", "meaning": "Saudação", "explanation": "Usada para cumprimentar.",
           "examples": [{"learning": "Hello, friend!", "native": "Olá, amigo!"}], "tip": "Cumprimente alguém."}


async def fake_generation(term, learning_language, native_language, custom_settings=None):
    return json.dumps({**CONTENT, "translation": f"{native_language}: {term}"})


class APIRegressions(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        self.generation_patch = patch.object(terms, "generate_ai_content", side_effect=fake_generation)
        self.generation_patch.start()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.generation_patch.stop()

    def create(self, value="hello", learning="en", native="pt"):
        return self.client.post("/terms/", json={"text": value, "term_language": learning, "explanation_language": native})

    def insert(self, value, content, native="pt", learning="en"):
        with SessionLocal() as db:
            return crud.create_term(db, value, "word", learning, native, json.dumps(content),
                                    content.get("translation", "") if isinstance(content, dict) else "").id

    def test_create_normalizes_whitespace_and_rejects_unicode_duplicates(self):
        created = self.create("  ÉCOLE  \n belle ", "fr")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["text"], "ÉCOLE belle")
        self.assertEqual(self.create("école   belle", "fr").status_code, 400)
        self.assertEqual(self.create("école belle", "en").status_code, 201)

    def test_legacy_unicode_duplicate_is_rejected(self):
        self.insert("  STRAßE  ", CONTENT, learning="de")
        self.assertEqual(self.create("strasse", "de").status_code, 400)

    def test_concurrent_creation_has_one_winner(self):
        async def delayed_generation(*args, **kwargs):
            await asyncio.sleep(0.05)
            return await fake_generation(*args, **kwargs)
        with patch.object(terms, "generate_ai_content", side_effect=delayed_generation):
            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(lambda _: self.create("same"), range(2)))
        self.assertEqual(sorted(response.status_code for response in results), [201, 409])
        self.assertEqual(len(self.client.get("/terms/active").json()), 1)

    def test_failed_retry_preserves_existing_record(self):
        term_id = self.insert("failed", {**CONTENT, "meaning": "Erro na IA"})
        with patch.object(terms, "generate_ai_content", side_effect=generation.ContentGenerationError("Indisponível")):
            self.assertEqual(self.create("failed").status_code, 502)
        self.assertEqual(self.client.get(f"/terms/{term_id}").status_code, 200)
        self.assertEqual(self.create("failed").json()["id"], term_id)

    def test_failed_new_generation_does_not_create_term(self):
        with patch.object(terms, "generate_ai_content", side_effect=generation.ContentGenerationError("Indisponível")):
            self.assertEqual(self.create().status_code, 502)
        self.assertEqual(self.client.get("/terms/active").json(), [])

    def test_review_intervals_are_explicit_utc_and_mastering_is_guarded(self):
        term_id = self.create().json()["id"]
        self.assertEqual(self.client.post(f"/terms/{term_id}/review", json={"action": "master"}).status_code, 400)
        for action, seconds in (("difficult", 300), ("medium", 3600), ("easy", 86400), ("again", 0)):
            before = datetime.now(timezone.utc)
            response = self.client.post(f"/terms/{term_id}/review", json={"action": action})
            self.assertEqual(response.status_code, 200)
            due = datetime.fromisoformat(response.json()["next_review_date"].replace("Z", "+00:00"))
            self.assertIsNotNone(due.tzinfo)
            self.assertAlmostEqual((due - before).total_seconds(), seconds, delta=3)
        self.client.post(f"/terms/{term_id}/review", json={"action": "easy"})
        mastered = self.client.post(f"/terms/{term_id}/review", json={"action": "master"})
        self.assertTrue(mastered.json()["mastered"])
        self.assertEqual(self.client.post(f"/terms/{term_id}/review", json={"action": "again"}).status_code, 409)
        self.assertEqual(len(self.client.get("/terms/mastered/word").json()), 1)

    def test_corrupt_and_incomplete_records_do_not_break_lists_or_enter_reviews(self):
        for i, content in enumerate([[], None, {"meaning": "", "examples": None}, {**CONTENT, "meaning": "Erro na IA"}]):
            self.insert(f"broken-{i}", content)
        self.insert("valid", CONTENT)
        active = self.client.get("/terms/active")
        self.assertEqual(active.status_code, 200)
        self.assertEqual(len(active.json()), 5)
        self.assertEqual(len(self.client.get("/terms/pending").json()), 1)
        self.assertEqual(self.client.get("/terms/stats").json()["pending_review"], 1)

    def test_legacy_examples_are_migrated_in_response(self):
        term_id = self.insert("legacy", {**CONTENT, "examples": [{"en": "Hello", "pt": "Olá"}]})
        content = self.client.get(f"/terms/{term_id}").json()["generated_content"]
        self.assertEqual(content["examples"], [{"learning": "Hello", "native": "Olá"}])

    def test_cancel_cannot_delete_a_ready_term(self):
        term_id = self.create().json()["id"]
        self.assertEqual(self.client.post(f"/terms/{term_id}/cancel").status_code, 409)
        self.assertEqual(self.client.get(f"/terms/{term_id}").status_code, 200)

    def test_edit_updates_quiz_translation(self):
        term_id = self.create().json()["id"]
        updated = self.client.put(f"/terms/{term_id}", json={**CONTENT, "translation": "  nova tradução  "})
        self.assertEqual(updated.json()["exact_translation"], "nova tradução")

    def test_quiz_never_mixes_explanation_languages(self):
        for native in ("pt", "es"):
            for i in range(4):
                self.insert(f"{native}-{i}", {**CONTENT, "translation": f"{native}:{i}"}, native=native)
        response = self.client.get("/terms/quiz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 8)
        for question in response.json():
            prefix = question["correct_translation"].split(":")[0]
            self.assertEqual(len(set(question["options"])), 4)
            self.assertTrue(all(option.startswith(prefix) for option in question["options"]))

    def test_quiz_empty_queue_is_not_a_configuration_error(self):
        self.assertEqual(self.client.get("/terms/quiz").json(), [])
        self.create()
        self.assertEqual(self.client.get("/terms/quiz").status_code, 400)

    def test_validates_input_and_settings_limits(self):
        self.assertEqual(self.create(" \n ").status_code, 422)
        self.assertEqual(self.create("x" * 301).status_code, 422)
        self.assertEqual(self.create("hello", "xx").status_code, 400)
        settings = self.client.get("/terms/settings/ai").json()
        for count in (-1, 0, 10000):
            self.assertEqual(self.client.put("/terms/settings/ai", json={**settings, "examples_count": count}).status_code, 422)

    def test_settings_write_failure_is_reported(self):
        settings = self.client.get("/terms/settings/ai").json()
        with patch.object(terms, "save_settings", side_effect=PermissionError()):
            self.assertEqual(self.client.put("/terms/settings/ai", json=settings).status_code, 500)

    def test_profile_never_becomes_same_language_pair_after_creation(self):
        self.assertEqual(self.create("olá", "pt", "en").status_code, 201)
        profile = self.client.get("/profile").json()
        self.assertNotEqual(profile["native_language"], profile["learning_language"])


class MigrationRegressions(unittest.TestCase):
    def test_legacy_upgrade_is_repeatable_and_preserves_data(self):
        database = create_engine(f"sqlite:///{Path(TEMP.name).as_posix()}/legacy.db")
        with database.begin() as connection:
            connection.exec_driver_sql("""CREATE TABLE terms (
                id INTEGER PRIMARY KEY, text VARCHAR UNIQUE NOT NULL, type VARCHAR NOT NULL,
                generated_content TEXT NOT NULL, difficulty_level VARCHAR NOT NULL,
                next_review_date DATETIME NOT NULL, mastered BOOLEAN NOT NULL,
                created_at DATETIME NOT NULL, mastered_at DATETIME)""")
            connection.execute(text("""INSERT INTO terms VALUES
                (7, 'hello', 'word', :content, 'Easy', '2026-01-01', 1, '2025-01-01', '2026-01-01')"""),
                {"content": json.dumps(CONTENT)})
        with patch.object(migrations, "engine", database):
            migrations.initialize_database()
            migrations.initialize_database()
        with database.connect() as connection:
            row = connection.execute(text("SELECT * FROM terms WHERE id = 7")).mappings().one()
            self.assertEqual(row["exact_translation"], "olá")
            self.assertEqual(row["learning_language"], "en")
            self.assertEqual(row["mastered"], 1)
            self.assertEqual(row["generated_content"], json.dumps(CONTENT))
        database.dispose()


class SettingsRegressions(unittest.TestCase):
    def test_corrupt_settings_fall_back_and_writes_round_trip(self):
        settings_file = Path(TEMP.name) / "settings.json"
        settings_file.write_text("[]", encoding="utf-8")
        with patch.object(generation, "SETTINGS_FILE", str(settings_file)):
            settings = generation.load_settings()
            self.assertEqual(settings["examples_count"], 3)
            settings["examples_count"] = 2
            generation.save_settings(settings)
            self.assertEqual(generation.load_settings()["examples_count"], 2)

    def test_custom_settings_control_generation(self):
        settings = schemas.AISettings(meaning_limit="Curto", explanation_style="Direto", examples_count=2, tone_focus="Geral")
        with patch.object(generation, "ai_client", None):
            result = asyncio.run(generation.generate_ai_content("hello", "en", "pt", settings))
        self.assertEqual(len(json.loads(result)["examples"]), 2)


def tearDownModule():
    engine.dispose()
    TEMP.cleanup()


if __name__ == "__main__":
    unittest.main()
