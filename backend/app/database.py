from sqlalchemy import create_engine, event, select
from pathlib import Path
import os

from dotenv import load_dotenv
from sqlalchemy.orm import Session, declarative_base, sessionmaker, with_loader_criteria
from fastapi import Request

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
SQLALCHEMY_DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'memoricks.db').as_posix()}"
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30}
)


@event.listens_for(engine, "connect")
def sqlite_constraints(connection, _record):
    if engine.dialect.name == "sqlite":
        connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


@event.listens_for(Session, "do_orm_execute")
def tenant_reads(state):
    user_id = state.session.info.get("user_id")
    if user_id is None or not state.is_select:
        return
    from . import models
    groups = models.Group.__table__
    subgroups = models.Subgroup.__table__
    state.statement = state.statement.options(
        with_loader_criteria(models.Group, lambda row: row.user_id == user_id),
        with_loader_criteria(models.Subgroup, lambda row: row.group_id.in_(
            select(groups.c.id).where(groups.c.user_id == user_id)
        )),
        with_loader_criteria(models.Card, lambda row: row.subgroup_id.in_(
            select(subgroups.c.id).join(groups, subgroups.c.group_id == groups.c.id)
            .where(groups.c.user_id == user_id)
        )),
        with_loader_criteria(models.UserProfile, lambda row: row.user_id == user_id),
    )


def authenticate_db(request: Request):
    from .auth import enabled, session_user
    return session_user(request) if enabled() else None


# Dependency to get db session
def get_db(request: Request):
    user_id = authenticate_db(request)
    db = SessionLocal()
    db.info["user_id"] = user_id
    try:
        yield db
    finally:
        db.close()


def get_write_db(request: Request):
    # Serialize local mutations from the first read, including template checks.
    user_id = authenticate_db(request)
    with SessionLocal() as db:
        db.info["user_id"] = user_id
        if engine.dialect.name == "sqlite":
            db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        yield db
