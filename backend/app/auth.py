"""Google sign-in and server-side sessions for the optional multiuser mode."""

from datetime import timedelta
import hashlib
import logging
import os
import secrets

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, delete

from . import models
from .database import SessionLocal
from .dates import utc_now

router = APIRouter(prefix="/auth", tags=["Contas"])
logger = logging.getLogger(__name__)
SESSION_COOKIE = "memoricks_session"
NONCE_COOKIE = "memoricks_login_nonce"


def open_session(db, user, request, response):
    old_token = request.cookies.get(SESSION_COOKIE)
    if old_token:
        db.execute(delete(models.LoginSession).where(models.LoginSession.token_hash == hashlib.sha256(old_token.encode()).hexdigest()))
    db.execute(delete(models.LoginSession).where(models.LoginSession.expires_at < utc_now()))
    token = secrets.token_urlsafe(32)
    db.add(models.LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(),
        user_id=user.id, expires_at=utc_now() + timedelta(days=14)))
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=cookie_secure(),
                        samesite="lax", max_age=14*86400, path="/")
    return {"mode": "accounts", "email": user.email, "name": user.name}


def enabled():
    return os.environ.get("MULTIUSER_ENABLED") == "1"


def cookie_secure():
    return os.environ.get("AUTH_COOKIE_SECURE") == "1"


def allowed_origin(request: Request):
    origin = request.headers.get("origin")
    configured = {value.strip() for value in os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")}
    if origin and origin not in configured:
        raise HTTPException(403, "Origem não autorizada.")


def session_user(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(401, "Entre na sua conta.")
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with SessionLocal() as db:
        session = db.get(models.LoginSession, token_hash)
        if session is None or session.expires_at <= utc_now():
            raise HTTPException(401, "Sua sessão expirou. Entre novamente.")
        user = db.get(models.User, session.user_id)
        if user is None:
            raise HTTPException(401, "Conta não encontrada.")
        return user.id


@router.get("/me")
def me(request: Request):
    if not enabled():
        return {"mode": "local"}
    user_id = session_user(request)
    with SessionLocal() as db:
        user = db.get(models.User, user_id)
        return {"mode": "accounts", "email": user.email, "name": user.name}


@router.get("/challenge")
def challenge(response: Response):
    if not enabled():
        raise HTTPException(404)
    nonce = secrets.token_urlsafe(32)
    response.set_cookie(NONCE_COOKIE, nonce, httponly=True, secure=cookie_secure(),
                        samesite="lax", max_age=300, path="/")
    return {"nonce": nonce}


class GoogleCredential(BaseModel):
    credential: str = Field(min_length=1, max_length=16384)
    # Optional echo for detecting a stale tab; never replaces the HttpOnly cookie.
    nonce: str | None = Field(default=None, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")


@router.post("/google")
def google_login(payload: GoogleCredential, request: Request, response: Response):
    if not enabled():
        raise HTTPException(404)
    allowed_origin(request)
    nonce = request.cookies.get(NONCE_COOKIE)
    if not nonce:
        raise HTTPException(400, "Reinicie o login Google.")
    if payload.nonce and not secrets.compare_digest(nonce.encode(), payload.nonce.encode()):
        raise HTTPException(400, "Reinicie o login Google.")
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(503, "O login Google não está configurado neste servidor.")
    try:
        import requests
        from google.auth import exceptions as google_exceptions
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
        # Respect the host's proxy and CA configuration and close the transport
        # after verification. Bound certificate downloads so a network outage
        # cannot occupy a request worker for Google's default 120 seconds.
        with requests.Session() as google_session:
            transport = google_requests.Request(session=google_session)

            def certificate_request(url, **kwargs):
                return transport(url, timeout=10, **kwargs)

            claims = id_token.verify_oauth2_token(
                payload.credential, certificate_request, client_id,
                clock_skew_in_seconds=60,
            )
    except google_exceptions.TransportError as error:
        logger.warning("Google token transport failed (%s)", type(error).__name__)
        raise HTTPException(
            503,
            "Não foi possível consultar o Google agora. Tente novamente em alguns segundos.",
        ) from error
    except (ValueError, KeyError, google_exceptions.GoogleAuthError) as error:
        # Exception messages may contain claims supplied by an untrusted token.
        logger.warning("Google token verification rejected (%s)", type(error).__name__)
        raise HTTPException(401, "Identificação do Google inválida.") from error
    # GIS is initialized with a nonce. Require its signed echo and the cookie
    # together, including on popup login; do not accept a client-only fallback.
    token_nonce = claims.get("nonce")
    nonce_matches = isinstance(token_nonce, str) and secrets.compare_digest(token_nonce.encode(), nonce.encode())
    email_verified = claims.get("email_verified") is True
    has_subject = bool(claims.get("sub"))
    has_email = bool(claims.get("email"))
    if not nonce_matches or not email_verified or not has_subject or not has_email:
        logger.warning(
            "Google token claims rejected (nonce_matches=%s, email_verified=%s, has_subject=%s, has_email=%s)",
            nonce_matches, email_verified, has_subject, has_email,
        )
        raise HTTPException(401, "Identificação do Google inválida.")
    email = str(claims["email"]).lower()
    subject = str(claims["sub"])
    with SessionLocal.begin() as db:
        user = db.scalar(select(models.User).where(models.User.google_sub == subject))
        if user is None:
            user = db.scalar(select(models.User).where(models.User.email == email))
            if user and (user.google_sub or user.password_hash):
                raise HTTPException(409, "Este e-mail já pertence a outra conta. Não foi possível vincular este acesso Google.")
            if user is None:
                user = models.User(email=email, google_sub=subject)
                db.add(user)
            else:
                user.google_sub = subject
        user.name = str(claims.get("name", ""))[:255]
        db.flush()
        result = open_session(db, user, request, response)
    response.delete_cookie(NONCE_COOKIE, path="/")
    return result


@router.post("/logout")
def logout(request: Request, response: Response):
    allowed_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with SessionLocal.begin() as db:
            session = db.get(models.LoginSession, hashlib.sha256(token.encode()).hexdigest())
            if session:
                db.delete(session)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}
