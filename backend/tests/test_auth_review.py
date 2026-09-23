"""Regression cases using signed test tokens and a disposable database."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import os
from threading import Barrier
import unittest
from unittest.mock import patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from google.auth import crypt, exceptions, jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from test_regressions import reset_database
from app import auth, crud, migrations, models
from app.database import SessionLocal, engine
from app.main import app


class AuthReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Only the certificate download is mocked. Signature, audience, issuer
        # and time checks run through Google's real verifier.
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.signer = crypt.RSASigner(key, key_id="review-key")
        cls.certs = {"review-key": key.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode()}

    def setUp(self):
        reset_database()
        self.environment = patch.dict(os.environ, {
            "MULTIUSER_ENABLED": "1", "MEMORICKS_OWNER_EMAIL": "owner@example.com",
            "GOOGLE_CLIENT_ID": "review.apps.googleusercontent.com",
            "CORS_ORIGINS": "http://localhost:3001",
        })
        self.environment.start()
        self.client = TestClient(app, raise_server_exceptions=False)
        self.client.__enter__()
        self.nonce = self.client.get("/auth/challenge").json()["nonce"]
        self.download = patch("google.oauth2.id_token._fetch_certs", return_value=self.certs)
        self.download.start()

    def tearDown(self):
        self.download.stop()
        self.client.__exit__(None, None, None)
        self.environment.stop()
        engine.dispose()

    def token(self, **overrides):
        now = int(datetime.now(timezone.utc).timestamp())
        claims = {
            "iss": "https://accounts.google.com", "aud": os.environ["GOOGLE_CLIENT_ID"],
            "sub": "review-subject", "email": "review@example.com", "email_verified": True,
            "name": "Review", "nonce": self.nonce, "iat": now, "exp": now + 3600,
            **overrides,
        }
        return jwt.encode(self.signer, claims).decode()

    def login(self, token):
        return self.client.post("/auth/google", json={"credential": token, "nonce": self.nonce},
                                headers={"Origin": "http://localhost:3001"})

    def test_clock_tolerance_does_not_disable_validation(self):
        now = int(datetime.now(timezone.utc).timestamp())
        for claims in ({"iat": now + 120}, {"exp": now - 120},
                       {"aud": "another-client"}, {"nonce": "another-challenge"},
                       {"email_verified": False}, {"email_verified": "false"}):
            with self.subTest(claims=claims):
                self.assertEqual(self.login(self.token(**claims)).status_code, 401)
        signed = self.token().split(".")
        signed[2] = ("A" if signed[2][0] != "A" else "B") + signed[2][1:]
        self.assertEqual(self.login(".".join(signed)).status_code, 401)
        accepted = self.login(self.token(iat=now + 21))
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(self.client.get("/auth/me").json()["email"], "review@example.com")
        self.assertNotIn(auth.NONCE_COOKIE, self.client.cookies)

    def test_wrong_issuer_is_unauthorized_not_server_error(self):
        self.assertEqual(self.login(self.token(iss="https://other.example")).status_code, 401)

    def test_transport_failure_is_retryable_without_creating_session(self):
        with patch("google.oauth2.id_token._fetch_certs", side_effect=exceptions.TransportError("offline")):
            response = self.login(self.token())
        self.assertEqual(response.status_code, 503, response.text)
        self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_missing_client_id_fails_closed(self):
        token = self.token()
        for configured in ("", "   "):
            with self.subTest(client_id=configured), patch.dict(os.environ, {"GOOGLE_CLIENT_ID": configured}):
                self.assertEqual(self.login(token).status_code, 503)
                self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_profile_first_access_is_safe_under_concurrency(self):
        with SessionLocal.begin() as db:
            user = models.User(email="new-profile@example.com")
            db.add(user)
            db.flush()
            user_id = user.id
        barrier = Barrier(2)
        original = Session.scalar

        def synchronize_first_lookup(db, statement, *args, **kwargs):
            result = original(db, statement, *args, **kwargs)
            descriptions = getattr(statement, "column_descriptions", [])
            if (descriptions and descriptions[0].get("entity") is models.UserProfile
                    and not db.info.get("profile_lookup_seen")):
                db.info["profile_lookup_seen"] = True
                barrier.wait(timeout=10)
            return result

        def load_profile():
            with SessionLocal() as db:
                db.info["user_id"] = user_id
                return crud.get_or_create_profile(db).id

        with patch.object(Session, "scalar", synchronize_first_lookup), ThreadPoolExecutor(2) as pool:
            first, second = list(pool.map(lambda _: load_profile(), range(2)))
        self.assertEqual(first, second)
        with SessionLocal() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(models.UserProfile)
                                      .where(models.UserProfile.user_id == user_id)), 1)

    def test_migrated_database_cannot_silently_disable_account_isolation(self):
        with patch.dict(os.environ, {"MULTIUSER_ENABLED": "0"}):
            with self.assertRaisesRegex(RuntimeError, "MULTIUSER_ENABLED=1"):
                migrations.initialize_database()

    def test_concurrent_account_migrations_are_idempotent(self):
        reset_database()
        with patch.dict(os.environ, {"MULTIUSER_ENABLED": "0"}):
            migrations.initialize_database()
        barrier = Barrier(2)

        def before_migration():
            # Force both starters to observe the migration as pending before
            # either acquires the SQLite write lock. No user database involved.
            barrier.wait(timeout=10)

        with patch.object(migrations, "initialize_passwords"), patch.object(
            migrations, "backup_database", side_effect=before_migration
        ), ThreadPoolExecutor(2) as pool:
            list(pool.map(lambda _: migrations.initialize_accounts(), range(2)))
        with SessionLocal() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(models.User)), 1)
