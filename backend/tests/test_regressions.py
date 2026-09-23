"""Temporary databases and mocked AI only. Never write the user's study data."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from copy import deepcopy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

TEMP = tempfile.TemporaryDirectory(prefix="memoricks-v3-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(TEMP.name).as_posix()}/test.db"
os.environ["MULTIUSER_ENABLED"] = "0"
os.environ["GROQ_API_KEY"] = ""

from fastapi.testclient import TestClient
from sqlalchemy import inspect, select, text
from app.main import app
from app import generation, migrations, models
from app.database import Base, SessionLocal, engine
from app.routers import cards
from app.templates import starter_template

CONTENT = {
    "translation": "olá",
    "meaning": "Saudação",
    "explanation": "Usada para cumprimentar.",
    "examples": [{"en": "Hello!", "pt": "Olá!"}],
    "tip": "Cumprimente alguém.",
}


async def fake_generation(entry, group, subgroup, language):
    return {
        field["id"]: entry if field["side"] == "front" else "Uma resposta correta."
        for field in subgroup["template"]["fields"]
    }, "ai"


def reset_database():
    Base.metadata.drop_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS schema_migrations")
        connection.exec_driver_sql("DROP TABLE IF EXISTS terms")


class APIRegressions(unittest.TestCase):
    def setUp(self):
        reset_database()
        self.client = TestClient(app)
        self.client.__enter__()
        self.patch = patch.object(cards, "generate_card", side_effect=fake_generation)
        self.patch.start()
        groups = self.client.get("/groups").json()
        self.group = next(group for group in groups if group["title"] == "Tecnologia")
        self.children = self.client.get(f"/groups/{self.group['id']}").json()[
            "subgroups"
        ]
        self.python, self.ai = self.children

    def tearDown(self):
        self.patch.stop()
        self.client.__exit__(None, None, None)

    def draft(self, subgroup=None, entry="Listas"):
        subgroup = subgroup or self.python
        return {
            "text": entry,
            "values": {
                field["id"]: entry if field["side"] == "front" else "Conteúdo."
                for field in subgroup["template"]["fields"]
            },
            "template_version": subgroup["template_version"],
            "source": "manual",
        }

    def create(self, subgroup=None, entry="Listas"):
        subgroup = subgroup or self.python
        response = self.client.post(
            f"/subgroups/{subgroup['id']}/cards", json=self.draft(subgroup, entry)
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def edit_subgroup(self, subgroup, **changes):
        payload = {
            key: deepcopy(subgroup[key])
            for key in ("title", "description", "context", "template", "version")
        }
        payload.update(changes)
        return self.client.put(f"/subgroups/{subgroup['id']}", json=payload)

    def review(self, card, action):
        return self.client.post(
            f"/cards/{card['id']}/review",
            json={"action": action, "version": card["version"]},
        )

    def test_seed_hierarchy_and_idempotence(self):
        self.assertEqual([item["title"] for item in self.children], ["Python", "IA"])
        migrations.initialize_database()
        self.assertEqual(len(self.client.get("/groups").json()), 2)
        self.assertEqual(
            self.client.get(f"/subgroups/{self.python['id']}/cards").json()["total"], 0
        )

    def test_manual_creation_has_no_ai_and_is_scoped(self):
        card = self.create()
        self.assertEqual(card["source"], "manual")
        cards.generate_card.assert_not_called()
        self.assertEqual(
            self.client.get(f"/subgroups/{self.ai['id']}/cards").json()["total"], 0
        )
        self.assertEqual(
            self.client.get(f"/groups/{self.group['id']}").json()["stats"]["pending"], 1
        )
        self.assertEqual(
            self.client.get(f"/subgroups/{self.python['id']}").json()["stats"]["total"],
            1,
        )

    def test_one_preview_is_not_persisted_until_user_saves(self):
        response = self.client.post(
            f"/subgroups/{self.python['id']}/generate", json={"text": "Listas"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.client.get(f"/subgroups/{self.python['id']}/cards").json()["total"], 0
        )
        preview = response.json()
        preview.pop("template")
        self.assertEqual(
            self.client.post(
                f"/subgroups/{self.python['id']}/cards", json=preview
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client.get(f"/subgroups/{self.python['id']}/cards").json()["total"], 1
        )

    def test_failed_generation_saves_nothing(self):
        with patch.object(
            cards,
            "generate_card",
            side_effect=generation.ContentGenerationError("Indisponível"),
        ):
            response = self.client.post(
                f"/subgroups/{self.python['id']}/generate", json={"text": "Listas"}
            )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            self.client.get(f"/subgroups/{self.python['id']}/cards").json()["total"], 0
        )

    def test_prompt_inherits_group_subgroup_and_every_field(self):
        messages = generation.build_messages(
            "list comprehension", self.group, self.python, "Português"
        )
        context = json.loads(messages[1]["content"])
        self.assertEqual(context["grupo"]["contexto"], self.group["context"])
        self.assertEqual(context["subgrupo"]["contexto"], self.python["context"])
        self.assertEqual(context["campos"], self.python["template"]["fields"])
        self.assertEqual(context["entrada"], "list comprehension")

    def test_changed_context_during_generation_is_rejected(self):
        async def change_context(*args):
            with SessionLocal() as db:
                subgroup = db.get(models.Subgroup, self.python["id"])
                subgroup.version += 1
                subgroup.context = "Mudou"
                db.commit()
            return await fake_generation(*args)

        with patch.object(cards, "generate_card", side_effect=change_context):
            response = self.client.post(
                f"/subgroups/{self.python['id']}/generate", json={"text": "Listas"}
            )
        self.assertEqual(response.status_code, 409)

    def test_unicode_duplicates_scoped_to_subgroup(self):
        self.create(entry="  STRAßE   ")
        payload = self.draft(entry="strasse")
        self.assertEqual(
            self.client.post(
                f"/subgroups/{self.python['id']}/cards", json=payload
            ).status_code,
            409,
        )
        self.create(self.ai, entry="strasse")

    def test_concurrent_duplicate_creation_has_one_winner(self):
        def create(_):
            return self.client.post(
                f"/subgroups/{self.python['id']}/cards", json=self.draft()
            ).status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(create, range(2)))
        self.assertEqual(sorted(results), [201, 409])

    def test_templates_validate_sides_ids_and_unsafe_style(self):
        template = deepcopy(self.python["template"])
        template["fields"][0]["side"] = "back"
        self.assertEqual(
            self.edit_subgroup(self.python, template=template).status_code, 422
        )
        template = deepcopy(self.python["template"])
        template["fields"][1]["id"] = template["fields"][0]["id"]
        self.assertEqual(
            self.edit_subgroup(self.python, template=template).status_code, 422
        )
        template = deepcopy(self.python["template"])
        template["fields"][0]["color"] = "url(javascript:alert(1))"
        self.assertEqual(
            self.edit_subgroup(self.python, template=template).status_code, 422
        )

    def test_required_and_unknown_fields_are_rejected(self):
        data = self.draft()
        data["values"]["answer"] = "  "
        self.assertEqual(
            self.client.post(
                f"/subgroups/{self.python['id']}/cards", json=data
            ).status_code,
            422,
        )
        data = self.draft()
        data["values"]["injected"] = "extra"
        self.assertEqual(
            self.client.post(
                f"/subgroups/{self.python['id']}/cards", json=data
            ).status_code,
            422,
        )

    def test_template_change_preserves_old_card_until_explicit_upgrade(self):
        card = self.create()
        original = deepcopy(card)
        template = deepcopy(self.python["template"])
        template["fields"] = [
            field for field in template["fields"] if field["id"] != "pitfall"
        ]
        template["fields"][1]["label"] = "Novo conceito"
        template["fields"][1]["font"] = "serif"
        updated = self.edit_subgroup(self.python, template=template).json()
        self.assertEqual(updated["template_version"], 2)
        expected = deepcopy(original)
        expected["template"]["fields"][1]["font"] = "serif"
        expected["version"] += 1
        self.assertEqual(self.client.get(f"/cards/{card['id']}").json(), expected)
        preview = self.client.get(f"/cards/{card['id']}/upgrade").json()
        self.assertEqual(preview["removed_fields"], ["Atenção"])
        data = {
            key: preview[key]
            for key in ("text", "values", "source", "template_version")
        }
        data.update(version=expected["version"], use_current_template=True)
        result = self.client.put(f"/cards/{card['id']}", json=data)
        self.assertEqual(result.status_code, 200, result.text)
        result = result.json()
        self.assertEqual(result["template"], template)
        self.assertEqual(result["next_review_date"], original["next_review_date"])
        self.assertEqual(result["created_at"], original["created_at"])

    def test_styles_propagate_to_all_matching_cards_only_and_roll_back_on_conflict(
        self,
    ):
        first = self.create()
        second = self.review(self.create(entry="Funções"), "easy").json()
        second = self.review(second, "master").json()
        other = self.create(self.ai)
        template = deepcopy(self.python["template"])
        template["fields"][1].update(
            font="mono", size="large", color="#123456", background="#abcdef"
        )
        response = self.edit_subgroup(self.python, template=template)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["template_version"], self.python["template_version"]
        )
        for original in (first, second):
            expected = deepcopy(original)
            expected["template"]["fields"][1].update(
                font="mono", size="large", color="#123456", background="#abcdef"
            )
            expected["version"] += 1
            self.assertEqual(
                self.client.get(f"/cards/{original['id']}").json(), expected
            )
        self.assertEqual(self.client.get(f"/cards/{other['id']}").json(), other)
        stale_template = deepcopy(template)
        stale_template["fields"][1]["font"] = "serif"
        self.assertEqual(
            self.edit_subgroup(self.python, template=stale_template).status_code, 409
        )
        self.assertEqual(
            self.client.get(f"/cards/{first['id']}").json()["template"], template
        )
        reset = deepcopy(template)
        reset["fields"][1].update(color=None, background=None)
        self.assertEqual(
            self.edit_subgroup(response.json(), template=reset).status_code, 200
        )
        self.assertEqual(
            self.client.get(f"/cards/{first['id']}").json()["template"], reset
        )

    def test_old_snapshot_can_be_edited_after_template_change(self):
        card = self.create()
        template = deepcopy(self.python["template"])
        template["fields"][1]["label"] = "Novo título"
        self.edit_subgroup(self.python, template=template)
        data = {
            key: card[key]
            for key in ("text", "values", "source", "template_version", "version")
        }
        data["values"]["answer"] = "Explicação corrigida"
        data["use_current_template"] = False
        response = self.client.put(f"/cards/{card['id']}", json=data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["template"], card["template"])

    def test_stale_template_and_edits_do_not_overwrite(self):
        card = self.create()
        changed = self.review(card, "easy").json()
        stale = self.review(card, "difficult")
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(
            self.client.get(f"/cards/{card['id']}").json()["difficulty_level"], "Easy"
        )
        template = deepcopy(self.python["template"])
        template["fields"][1]["label"] = "Mudou"
        self.edit_subgroup(self.python, template=template)
        self.assertEqual(
            self.client.post(
                f"/subgroups/{self.python['id']}/cards", json=self.draft(entry="Outro")
            ).status_code,
            409,
        )

    def test_review_intervals_and_master_guard(self):
        card = self.create()
        self.assertEqual(self.review(card, "master").status_code, 400)
        for action, seconds in [("difficult", 300), ("medium", 3600), ("easy", 86400)]:
            before = datetime.now(timezone.utc)
            response = self.review(card, action)
            self.assertEqual(response.status_code, 200, response.text)
            card = response.json()
            date = datetime.fromisoformat(
                card["next_review_date"].replace("Z", "+00:00")
            )
            self.assertAlmostEqual((date - before).total_seconds(), seconds, delta=3)
        card = self.review(card, "master").json()
        self.assertTrue(card["mastered"])
        self.assertEqual(self.review(card, "easy").status_code, 409)
        self.assertEqual(
            self.client.get(
                f"/subgroups/{self.python['id']}/cards?status=active"
            ).json()["total"],
            0,
        )
        self.assertEqual(
            self.client.get(
                f"/subgroups/{self.python['id']}/cards?status=mastered"
            ).json()["total"],
            1,
        )
        self.assertEqual(
            self.client.get(f"/groups/{self.group['id']}").json()["stats"]["percent"],
            100,
        )

    def test_empty_subgroups_only_can_be_deleted_and_do_not_reseed(self):
        self.assertEqual(
            self.client.delete(f"/groups/{self.group['id']}?version=1").status_code, 409
        )
        card = self.create()
        self.assertEqual(
            self.client.delete(f"/subgroups/{self.python['id']}?version=1").status_code,
            409,
        )
        self.assertEqual(
            self.client.delete(f"/cards/{card['id']}?version=1").status_code, 204
        )
        self.assertEqual(
            self.client.delete(f"/subgroups/{self.python['id']}?version=1").status_code,
            204,
        )
        migrations.initialize_database()
        self.assertEqual(
            self.client.get(f"/subgroups/{self.python['id']}").status_code, 404
        )

    def test_removed_quiz_and_unsupported_hierarchy(self):
        self.assertEqual(self.client.get("/terms/quiz").status_code, 404)
        self.assertEqual(
            self.client.post(
                f"/subgroups/{self.python['id']}/subgroups", json={}
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                f"/groups/{self.group['id']}/cards", json=self.draft()
            ).status_code,
            404,
        )

    def test_search_and_pagination_are_scoped(self):
        self.create(entry="ÉCOLE")
        self.create(entry="Outro")
        response = self.client.get(
            f"/subgroups/{self.python['id']}/cards?q=école&limit=1"
        )
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["items"][0]["text"], "ÉCOLE")
        self.assertEqual(
            self.client.get(f"/subgroups/{self.ai['id']}/cards?q=école").json()[
                "total"
            ],
            0,
        )

    def test_language_preset_follows_profile_and_requested_language(self):
        self.client.put("/profile", json={"native_language": "es"})
        template = next(
            item
            for item in self.client.get("/templates?language=it").json()
            if item["id"] == "languages"
        )
        fields = {field["id"]: field for field in template["template"]["fields"]}
        self.assertIn("Italiano", fields["prompt"]["instructions"])
        self.assertIn("Espanhol", fields["translation"]["instructions"])

    def test_practice_stats_keep_valid_active_cards_when_learned_cards_need_attention(self):
        active = self.create(entry="Ativo para praticar")
        self.assertEqual(self.review(active, "medium").status_code, 200)
        learned = self.create(entry="Aprendido legado incompleto")
        learned = self.review(learned, "easy").json()
        self.assertEqual(self.review(learned, "master").status_code, 200)
        with SessionLocal() as db:
            db.get(models.Card, learned["id"]).needs_attention = True
            db.commit()

        subgroup_stats = self.client.get(f"/subgroups/{self.python['id']}").json()["stats"]
        self.assertEqual(subgroup_stats["active"], 1)
        self.assertEqual(subgroup_stats["learned"], 1)
        self.assertEqual(subgroup_stats["attention"], 1)
        self.assertEqual(subgroup_stats["pending"], 0)
        self.assertEqual(subgroup_stats["reviewable"], 1)
        group_stats = self.client.get(f"/groups/{self.group['id']}").json()["stats"]
        self.assertEqual(group_stats["reviewable"], 1)
        shortcut = next(item for item in self.client.get("/review-shortcuts").json() if item["id"] == self.python["id"])
        self.assertEqual(shortcut["stats"]["reviewable"], 1)
        statistics = self.client.get(f"/statistics?group_id={self.group['id']}").json()
        self.assertEqual(statistics["summary"]["reviewable"], 1)

    def test_shortcuts_prioritize_pending_then_size_and_exclude_unreviewable(self):
        python_card = self.create()
        for i in range(3):
            card = self.create(self.ai, entry=f"IA {i}")
            self.review(card, "easy")
        shortcuts = self.client.get("/review-shortcuts").json()
        self.assertEqual(
            [item["id"] for item in shortcuts], [self.python["id"], self.ai["id"]]
        )
        python_card = self.review(python_card, "easy").json()
        shortcuts = self.client.get("/review-shortcuts").json()
        self.assertEqual(shortcuts[0]["id"], self.ai["id"])
        self.review(python_card, "master")
        with SessionLocal() as db:
            for card in db.scalars(
                select(models.Card).where(models.Card.subgroup_id == self.ai["id"])
            ):
                card.needs_attention = True
            db.commit()
        self.assertEqual(self.client.get("/review-shortcuts").json(), [])


class MigrationRegressions(unittest.TestCase):
    def setUp(self):
        reset_database()

    def legacy(self, date="2026-01-02 03:04:05"):
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE TABLE terms (id INTEGER PRIMARY KEY,text TEXT,type TEXT,generated_content TEXT,difficulty_level TEXT,next_review_date TEXT,mastered BOOLEAN,created_at TEXT,mastered_at TEXT, learning_language TEXT,native_language TEXT)"
            )
            for item_id, language, mastered, content in [
                (17, "en", 1, CONTENT),
                (29, "it", 0, CONTENT),
                (30, "pt", 0, {"meaning": "Erro na IA"}),
            ]:
                connection.execute(
                    text(
                        "INSERT INTO terms VALUES (:id,:term,'word',:content,'Easy',:date,:mastered,:date,:mastered_at,:language,'pt')"
                    ),
                    {
                        "id": item_id,
                        "term": f"Termo {item_id}",
                        "content": json.dumps(content),
                        "date": date,
                        "mastered": mastered,
                        "mastered_at": date if mastered else None,
                        "language": language,
                    },
                )

    def test_migration_preserves_content_ids_dates_progress_and_archive(self):
        self.legacy()
        with engine.connect() as connection:
            original = connection.execute(
                text("SELECT * FROM terms ORDER BY id")
            ).fetchall()
        migrations.initialize_database()
        migrations.initialize_database()
        with engine.connect() as connection:
            self.assertEqual(
                connection.execute(text("SELECT * FROM terms ORDER BY id")).fetchall(),
                original,
            )
        with SessionLocal() as db:
            items = db.scalars(select(models.Card).order_by(models.Card.id)).all()
            self.assertEqual([item.id for item in items], [17, 29, 30])
            self.assertTrue(items[0].mastered)
            self.assertEqual(items[0].difficulty_level, "Easy")
            self.assertEqual(items[0].created_at, datetime(2026, 1, 2, 3, 4, 5))
            self.assertEqual(items[0].values["translation"], "olá")
            self.assertIn("Hello! — Olá!", items[0].values["examples"])
            self.assertTrue(items[-1].needs_attention)
            self.assertEqual(len(db.scalars(select(models.Group)).all()), 2)
        backups = list((Path(TEMP.name) / "backups").glob("*.db"))
        self.assertTrue(backups)
        with closing(
            sqlite3.connect(str(max(backups, key=lambda p: p.stat().st_mtime)))
        ) as backup:
            self.assertEqual(
                backup.execute("SELECT COUNT(*) FROM terms").fetchone()[0], 3
            )
        with TestClient(app) as client:
            with SessionLocal() as db:
                subgroup_id = db.get(models.Card, 30).subgroup_id
            self.assertEqual(
                client.get(f"/subgroups/{subgroup_id}/cards?status=pending").json()[
                    "total"
                ],
                0,
            )

    def test_failed_migration_rolls_back_and_keeps_original(self):
        self.legacy(date="not a date")
        with self.assertRaises(ValueError):
            migrations.initialize_database()
        with engine.connect() as connection:
            self.assertEqual(
                connection.execute(text("SELECT COUNT(*) FROM terms")).scalar(), 3
            )
        self.assertFalse(inspect(engine).has_table("cards"))

    def test_pre_language_database_migrates(self):
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE TABLE terms (id INTEGER PRIMARY KEY,text TEXT,type TEXT,generated_content TEXT,difficulty_level TEXT,next_review_date TEXT,mastered BOOLEAN,created_at TEXT,mastered_at TEXT)"
            )
            connection.execute(
                text(
                    "INSERT INTO terms VALUES (1,'hello','word',:content,'Difficult','2026-01-01',0,'2026-01-01',NULL)"
                ),
                {"content": json.dumps(CONTENT)},
            )
        migrations.initialize_database()
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Card, 1).values["prompt"], "hello")


def tearDownModule():
    engine.dispose()
    TEMP.cleanup()


if __name__ == "__main__":
    unittest.main()
