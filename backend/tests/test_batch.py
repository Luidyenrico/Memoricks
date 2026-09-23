"""Batch regression coverage uses a disposable database and mocked provider."""
import asyncio
import json
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
import test_regressions as regression
from app import generation, migrations, models
from app.database import engine
from app.routers import cards
from sqlalchemy import inspect


class BatchTests(unittest.TestCase):
    setUp = regression.APIRegressions.setUp
    tearDown = regression.APIRegressions.tearDown
    draft = regression.APIRegressions.draft
    edit_subgroup = regression.APIRegressions.edit_subgroup

    def save(self, drafts, request_id="batch-test-request-0001"):
        return self.client.post(f"/subgroups/{self.python['id']}/cards/batch", json={"request_id": request_id, "cards": drafts})

    def total(self):
        return self.client.get(f"/subgroups/{self.python['id']}/cards").json()["total"]

    def test_batch_atomic_save_idempotence_and_changed_retry(self):
        drafts = [self.draft(entry="Primeira"), self.draft(entry="Segunda")]
        self.assertEqual(self.save(drafts).status_code, 201)
        first = self.save(drafts).json()
        self.assertEqual(first["count"], 2)
        self.assertEqual(len(first["cards"]), 2)
        self.assertEqual({c["id"] for c in first["cards"]}, {c["id"] for c in self.save(drafts).json()["cards"]})
        self.assertEqual(self.total(), 2)
        drafts[0]["text"] = "Alterada"
        self.assertEqual(self.save(drafts).status_code, 409)
        self.assertEqual(self.total(), 2)

    def test_invalid_duplicate_and_stale_batches_save_nothing(self):
        first = self.draft(entry="Primeira")
        invalid = self.draft(entry="Segunda")
        invalid["values"] = {}
        self.assertEqual(self.save([first, invalid]).status_code, 422)
        self.assertEqual(self.total(), 0)
        self.assertEqual(self.save([first, first]).status_code, 409)
        self.assertEqual(self.total(), 0)
        invalid = self.draft(entry="Segunda")
        invalid["template_version"] += 1
        self.assertEqual(self.save([first, invalid]).status_code, 409)
        self.assertEqual(self.total(), 0)

    def test_existing_card_conflict_rolls_back_whole_batch(self):
        self.assertEqual(self.save([self.draft(entry="Existente")]).status_code, 201)
        response = self.save([self.draft(entry="Nova"), self.draft(entry="Existente")], "batch-test-request-0002")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.total(), 1)

    def test_batch_generation_context_and_stale_guard(self):
        payload = {"text": "Pergunta e resposta", "subgroup_version": self.python["version"],
                   "group_version": self.group["version"], "common_context": "Livro — capítulo 1"}
        url = f"/subgroups/{self.python['id']}/batch-generate"
        self.assertEqual(self.client.post(url, json=payload).status_code, 200)
        self.assertIn("Livro — capítulo 1", cards.generate_card.call_args.args[2]["context"])
        self.assertEqual(self.total(), 0)
        self.edit_subgroup(self.python, context="Novo contexto")
        self.assertEqual(self.client.post(url, json=payload).status_code, 409)
        self.assertEqual(cards.generate_card.call_count, 1)

    def test_rate_limit_propagates_retry_after_without_persisting(self):
        for header, expected in [("2", 60), ("125", 125), ("invalid", 60)]:
            error = Exception("quota")
            error.response = SimpleNamespace(headers={"retry-after": header})
            limited = generation.GenerationRateLimit(error)
            with patch.object(cards, "generate_card", side_effect=limited):
                response = self.client.post(f"/subgroups/{self.python['id']}/generate", json={"text": "Teste"})
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.json()["detail"]["retry_after"], expected)
        self.assertEqual(self.total(), 0)

    def test_receipt_table_is_added_to_existing_database_without_reseed(self):
        models.BatchReceipt.__table__.drop(engine)
        migrations.initialize_database()
        self.assertTrue(inspect(engine).has_table("batch_receipts"))
        self.assertEqual(len(self.client.get("/groups").json()), 2)

    def test_batch_limits(self):
        self.assertEqual(self.save([self.draft()] * 51).status_code, 422)
        self.assertEqual(self.client.post(f"/subgroups/{self.python['id']}/batch-plan", json={"text": " "}).status_code, 422)


class PlannerTests(unittest.TestCase):
    def client(self, data, finish="stop"):
        create = AsyncMock(return_value=SimpleNamespace(choices=[SimpleNamespace(
            finish_reason=finish, message=SimpleNamespace(content=json.dumps(data)))]))
        return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))

    def test_plan_preserves_all_questions_and_multiline_answers(self):
        text = "Capítulo 1\nPergunta A?\nResposta A\n- exemplo\nPergunta B?\nResposta B"
        with patch.object(generation, "ai_client", self.client({"starts": [1, 5], "common_context": "Capítulo 1"})):
            result = asyncio.run(generation.plan_cards(text))
        self.assertEqual("\n".join(result["entries"]), text)
        self.assertEqual(len(result["entries"]), 2)

    def test_invalid_and_truncated_plan_rejected(self):
        for data, finish in [({"starts": [2], "common_context": ""}, "stop"),
                             ({"starts": [1, 1], "common_context": ""}, "stop"),
                             ({"starts": [1], "common_context": "Inventado"}, "stop"),
                             ({"starts": [1], "common_context": ""}, "length")]:
            with patch.object(generation, "ai_client", self.client(data, finish)):
                with self.assertRaises(generation.ContentGenerationError):
                    asyncio.run(generation.plan_cards("A\nB"))

    def test_provider_429_does_not_immediately_try_fallback(self):
        client = self.client({})
        error = Exception("quota")
        error.status_code = 429
        error.response = SimpleNamespace(headers={"retry-after": "90"})
        client.chat.completions.create.side_effect = error
        with patch.object(generation, "ai_client", client):
            with self.assertRaises(generation.GenerationRateLimit):
                asyncio.run(generation.plan_cards("Pergunta?"))
        self.assertEqual(client.chat.completions.create.call_count, 1)
