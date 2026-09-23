"""Two real API sessions must never see or modify one another's library."""

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from test_regressions import reset_database
from app.main import app
from app import auth, models
from app.database import SessionLocal, engine
from sqlalchemy import select


class AccountIsolationTests(unittest.TestCase):
    def test_owner_migration_and_two_account_isolation(self):
        reset_database()
        environment = {
            "MULTIUSER_ENABLED": "1",
            "MEMORICKS_OWNER_EMAIL": "luidy.efcti@gmail.com",
            "GOOGLE_CLIENT_ID": "test.apps.googleusercontent.com",
        }
        with patch.dict(os.environ, environment), TestClient(app) as owner, TestClient(app) as guest:
            self.assertEqual(owner.get("/groups").status_code, 401)

            def sign_in(client, email, subject):
                nonce = client.get("/auth/challenge").json()["nonce"]
                claims = {"sub": subject, "email": email, "email_verified": True,
                          "name": email, "nonce": nonce}
                with patch("google.oauth2.id_token.verify_oauth2_token", return_value=claims):
                    response = client.post("/auth/google", json={"credential": "mock"},
                                           headers={"Origin": "http://localhost:3000"})
                self.assertEqual(response.status_code, 200, response.text)

            sign_in(owner, "luidy.efcti@gmail.com", "owner-google-sub")
            sign_in(guest, "guest@example.com", "guest-google-sub")
            owner_groups = owner.get("/groups").json()
            self.assertGreater(len(owner_groups), 0)
            self.assertEqual(guest.get("/groups").json(), [])
            group_id = owner_groups[0]["id"]
            owner_detail = owner.get(f"/groups/{group_id}").json()
            subgroup = owner_detail["subgroups"][0]
            draft_values = {
                field["id"]: "Pergunta" if field["side"] == "front" else "Resposta"
                for field in subgroup["template"]["fields"]
            }
            created = owner.post(f"/subgroups/{subgroup['id']}/cards", json={
                "text": "Pergunta", "values": draft_values,
                "template_version": subgroup["template_version"], "source": "manual",
            })
            self.assertEqual(created.status_code, 201, created.text)
            card_id = created.json()["id"]
            self.assertEqual(guest.get(f"/groups/{group_id}").status_code, 404)
            self.assertEqual(guest.get(f"/subgroups/{subgroup['id']}").status_code, 404)
            self.assertEqual(guest.get(f"/cards/{card_id}").status_code, 404)
            self.assertEqual(guest.post(f"/cards/{card_id}/review", json={
                "action": "easy", "version": 1
            }).status_code, 404)
            self.assertEqual(guest.put(f"/groups/{group_id}", json={
                "title": "Roubado", "description": "", "context": "", "color": "#85a5ff", "version": 1
            }).status_code, 404)
            self.assertEqual(guest.get("/statistics").json()["summary"]["total"], 0)
            self.assertGreater(owner.get("/statistics").json()["summary"]["total"], 0)
            self.assertEqual(guest.get("/review-shortcuts").json(), [])
            guest_group = guest.post("/groups", json={
                "title": "Só do convidado", "description": "", "context": "", "color": "#85a5ff"
            }).json()
            self.assertEqual(owner.get(f"/groups/{guest_group['id']}").status_code, 404)
            self.assertEqual(len(owner.get("/groups").json()), len(owner_groups))
            self.assertEqual(guest.get("/profile").json()["native_language"], "pt")
            self.assertEqual(owner.post("/auth/logout").status_code, 200)
            self.assertEqual(owner.get("/groups").status_code, 401)



class GoogleAccountsTests(unittest.TestCase):
    def setUp(self):
        reset_database()
        self.environment = patch.dict(os.environ, {
            "MULTIUSER_ENABLED": "1", "MEMORICKS_OWNER_EMAIL": "luidy.efcti@gmail.com",
            "GOOGLE_CLIENT_ID": "test.apps.googleusercontent.com",
        })
        self.environment.start()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.environment.stop()
        engine.dispose()

    def test_google_token_without_nonce_is_rejected(self):
        nonce = self.client.get("/auth/challenge").json()["nonce"]
        claims = {"sub": "google-without-nonce", "email": "google@example.com",
                  "email_verified": True, "name": "Google User"}
        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=claims):
            response = self.client.post("/auth/google", json={"credential": "mock"})
        self.assertEqual(response.status_code, 401, response.text)
        self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_google_login_requires_cookie_even_with_nonce_in_body(self):
        nonce = self.client.get("/auth/challenge").json()["nonce"]
        self.client.cookies.clear()
        claims = {"sub": "google-cross-host", "email": "cross@example.com",
                  "email_verified": True, "name": "Cross Host", "nonce": nonce}
        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=claims):
            response = self.client.post("/auth/google", json={"credential": "mock", "nonce": nonce})
        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_password_endpoints_are_removed(self):
        for path in ("/auth/register", "/auth/login"):
            self.assertEqual(self.client.post(path, json={"email": "ana@example.com", "password": "unused"}).status_code, 404)
        self.assertNotIn("/auth/register", self.client.get("/openapi.json").json()["paths"])
        self.assertNotIn("/auth/login", self.client.get("/openapi.json").json()["paths"])

    def test_google_logout_revokes_session_and_repeat_login_preserves_library(self):
        def login():
            nonce = self.client.get("/auth/challenge").json()["nonce"]
            claims = {"sub": "stable-subject", "email": "ana@example.com", "email_verified": True, "name": "Ana", "nonce": nonce}
            with patch("google.oauth2.id_token.verify_oauth2_token", return_value=claims):
                result = self.client.post("/auth/google", json={"credential": "mock"})
            self.assertEqual(result.status_code, 200, result.text)
            return result
        self.assertIn("HttpOnly", login().headers["set-cookie"])
        group = self.client.post("/groups", json={"title": "Meu tema", "description": "", "context": "", "color": "#85a5ff"}).json()
        token = self.client.cookies.get(auth.SESSION_COOKIE)
        self.client.post("/auth/logout")
        self.assertEqual(self.client.get("/auth/me").status_code, 401)
        with TestClient(app) as replay:
            replay.cookies.set(auth.SESSION_COOKIE, token)
            self.assertEqual(replay.get("/auth/me").status_code, 401)
        login()
        self.assertEqual(self.client.get("/groups").json()[0]["id"], group["id"])
