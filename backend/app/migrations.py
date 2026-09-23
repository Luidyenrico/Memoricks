"""Atomic, one-time migration. Legacy terms remain untouched as an archive."""

from copy import deepcopy
from contextlib import closing
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3

from sqlalchemy import inspect, text
from .database import Base, engine
from . import models
from .content import is_reviewable, normalize_term, parse_content
from .languages import language_name
from .templates import starter_template

MIGRATION = "general_cards_v3"


def backup_database():
    path = engine.url.database
    if not path or path == ":memory:" or not Path(path).exists():
        return
    target = Path(path).resolve()
    folder = target.parent / "backups"
    folder.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup = folder / f"{target.stem}-before-v3-{stamp}.db"
    with closing(sqlite3.connect(str(target))) as source, closing(
        sqlite3.connect(str(backup))
    ) as destination:
        source.backup(destination)
    return backup


def legacy_values(row):
    content = parse_content(row.get("generated_content"))
    values = {"prompt": str(row.get("text") or "")}
    for key in ("translation", "meaning", "explanation", "tip"):
        value = content.get(key, "")
        values[key] = (
            value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        )
    examples = content.get("examples", [])
    if isinstance(examples, list):
        values["examples"] = "\n".join(
            (
                f"{item.get('learning', item.get('en', ''))} — {item.get('native', item.get('pt', ''))}"
                if isinstance(item, dict)
                else str(item)
            )
            for item in examples
        )
    else:
        values["examples"] = str(examples or "")
    return values


def initialize_database():
    inspector = inspect(engine)
    if inspector.has_table("schema_migrations"):
        with engine.connect() as connection:
            if connection.execute(
                text("SELECT 1 FROM schema_migrations WHERE name=:name"),
                {"name": MIGRATION},
            ).first():
                if not inspector.has_table("batch_receipts"):
                    backup_database()
                    models.BatchReceipt.__table__.create(engine, checkfirst=True)
                initialize_accounts()
                return
    backup_database()
    # BEGIN IMMEDIATE covers DDL as well as data, including SQLite legacy mode.
    with engine.begin() as connection:
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        Base.metadata.create_all(connection)
        connection.exec_driver_sql(
            "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)"
        )
        if connection.execute(
            text("SELECT 1 FROM schema_migrations WHERE name=:name"),
            {"name": MIGRATION},
        ).first():
            return
        columns = {
            column["name"]
            for column in inspect(connection).get_columns("user_profiles")
        }
        if "learning_language_selected" not in columns:
            connection.exec_driver_sql(
                "ALTER TABLE user_profiles ADD COLUMN learning_language_selected BOOLEAN NOT NULL DEFAULT 0"
            )
        connection.exec_driver_sql(
            "INSERT OR IGNORE INTO user_profiles (id, native_language, learning_language, learning_language_selected) VALUES (1, 'pt', 'en', 0)"
        )
        profile = (
            connection.execute(text("SELECT * FROM user_profiles WHERE id=1"))
            .mappings()
            .one()
        )
        native = profile["native_language"]
        preferences = {}
        settings_path = Path(__file__).with_name("ai_settings.json")
        try:
            preferences = parse_content(settings_path.read_text(encoding="utf-8-sig"))
        except OSError:
            pass
        legacy = []
        if inspect(connection).has_table("terms"):
            legacy = [
                dict(row)
                for row in connection.execute(
                    text("SELECT * FROM terms ORDER BY id")
                ).mappings()
            ]
        group_table, subgroup_table = models.Group.__table__, models.Subgroup.__table__
        language_group = connection.execute(
            group_table.insert().values(
                title="Línguas",
                description="Palavras, expressões e novas formas de se comunicar.",
                context=f"Ensine idiomas com exemplos de uso natural. Explique em {language_name(native)}.",
            )
        ).inserted_primary_key[0]
        language_codes = sorted(
            {row.get("learning_language") or "en" for row in legacy}
            or {profile["learning_language"] or "en"}
        )
        subgroups = {}
        for language in language_codes:
            template = starter_template("languages", language, native, preferences)
            subgroups[language] = connection.execute(
                subgroup_table.insert().values(
                    group_id=language_group,
                    title=language_name(language),
                    description=f"Estudo de {language_name(language)}.",
                    context=f"Estude {language_name(language)}. Explique em {language_name(native)}. "
                    + str(preferences.get("custom_instructions") or ""),
                    template=template,
                )
            ).inserted_primary_key[0]
        seen = set()
        for row in legacy:
            language = row.get("learning_language") or "en"
            template = starter_template(
                "languages", language, row.get("native_language") or native, preferences
            )
            values = legacy_values(row)
            # Preserve optional/missing legacy fields without preventing future edits.
            for field in template["fields"]:
                if field["side"] == "back" and field["id"] != "meaning":
                    field["required"] = False
                field["max_chars"] = min(
                    20000, max(3000, len(values.get(field["id"], "")))
                )
            key = normalize_term(row["text"]).casefold()
            if (subgroups[language], key) in seen:
                key += f" [legacy:{row['id']}]"
            seen.add((subgroups[language], key))
            connection.execute(
                models.Card.__table__.insert().values(
                    id=row["id"],
                    subgroup_id=subgroups[language],
                    text=row["text"],
                    input_key=key,
                    values=values,
                    template=deepcopy(template),
                    template_version=1,
                    source="legacy",
                    legacy_content=row.get("generated_content"),
                    needs_attention=not is_reviewable(row.get("generated_content")),
                    difficulty_level=row["difficulty_level"],
                    mastered=bool(row["mastered"]),
                    next_review_date=_date(row["next_review_date"]),
                    created_at=_date(row["created_at"]),
                    mastered_at=_date(row.get("mastered_at")),
                )
            )
        technology = connection.execute(
            group_table.insert().values(
                title="Tecnologia",
                description="Entenda conceitos e aprenda na prática.",
                context="Ensine tecnologia com precisão, exemplos práticos e linguagem acessível.",
                color="#6ee7b7",
            )
        ).inserted_primary_key[0]
        for title, kind, context in [
            (
                "Python",
                "python",
                "Python 3: conceitos, exemplos executáveis e boas práticas.",
            ),
            (
                "IA",
                "general",
                "Inteligência artificial: conceitos, aplicações, limites e exemplos. Evite afirmações sem fundamento.",
            ),
        ]:
            connection.execute(
                subgroup_table.insert().values(
                    group_id=technology,
                    title=title,
                    description=f"Seu espaço para aprender {title}.",
                    context=context,
                    template=starter_template(kind),
                )
            )
        connection.execute(
            text("INSERT INTO schema_migrations (name) VALUES (:name)"),
            {"name": MIGRATION},
        )
    initialize_accounts()


def initialize_accounts():
    """One-time, backed-up ownership migration for the existing SQLite library."""
    import os

    if os.environ.get("MULTIUSER_ENABLED") != "1":
        with engine.connect() as connection:
            has_accounts = connection.execute(
                text("SELECT 1 FROM schema_migrations WHERE name='accounts_v1'")
            ).first()
        if has_accounts:
            raise RuntimeError(
                "Este banco já possui contas. Mantenha MULTIUSER_ENABLED=1 "
                "para preservar a autenticação e o isolamento dos dados."
            )
        return
    if engine.dialect.name != "sqlite":
        raise RuntimeError("A migração de contas atual requer SQLite.")
    owner_email = os.environ.get("MEMORICKS_OWNER_EMAIL", "").strip().lower()
    if not owner_email:
        raise RuntimeError("Configure MEMORICKS_OWNER_EMAIL antes de ativar contas.")
    with engine.connect() as connection:
        already_migrated = connection.execute(
            text("SELECT 1 FROM schema_migrations WHERE name='accounts_v1'")
        ).first()
    if already_migrated:
        initialize_passwords()
        return
    backup_database()
    with engine.begin() as connection:
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        # Another worker may have migrated while this one waited for the lock.
        if not connection.execute(text("SELECT 1 FROM schema_migrations WHERE name='accounts_v1'")).first():
            models.User.__table__.create(connection, checkfirst=True)
            models.LoginSession.__table__.create(connection, checkfirst=True)
            columns = {column["name"] for column in inspect(connection).get_columns("study_groups")}
            if "user_id" not in columns:
                connection.exec_driver_sql("ALTER TABLE study_groups ADD COLUMN user_id INTEGER REFERENCES users(id)")
            columns = {column["name"] for column in inspect(connection).get_columns("user_profiles")}
            if "user_id" not in columns:
                connection.exec_driver_sql("ALTER TABLE user_profiles ADD COLUMN user_id INTEGER REFERENCES users(id)")
            connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_study_groups_user_id ON study_groups (user_id)")
            connection.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_user_id ON user_profiles (user_id)")
            connection.execute(text("INSERT OR IGNORE INTO users (email, name) VALUES (:email, '')"), {"email": owner_email})
            owner_id = connection.execute(text("SELECT id FROM users WHERE email=:email"), {"email": owner_email}).scalar_one()
            connection.execute(text("UPDATE study_groups SET user_id=:id WHERE user_id IS NULL"), {"id": owner_id})
            connection.execute(text("UPDATE user_profiles SET user_id=:id WHERE user_id IS NULL"), {"id": owner_id})
            connection.exec_driver_sql("INSERT INTO schema_migrations (name) VALUES ('accounts_v1')")
    initialize_passwords()


def initialize_passwords():
    with engine.connect() as connection:
        if connection.execute(text("SELECT 1 FROM schema_migrations WHERE name='passwords_v1'")).first():
            return
    backup_database()
    with engine.begin() as connection:
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        if connection.execute(text("SELECT 1 FROM schema_migrations WHERE name='passwords_v1'")).first():
            return
        columns = {column["name"] for column in inspect(connection).get_columns("users")}
        if "password_hash" not in columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")
        models.AuthThrottle.__table__.create(connection, checkfirst=True)
        connection.exec_driver_sql("INSERT INTO schema_migrations (name) VALUES ('passwords_v1')")


def _date(value):
    if value is None or isinstance(value, datetime):
        return value
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return (
        parsed.astimezone(timezone.utc).replace(tzinfo=None)
        if parsed.tzinfo
        else parsed
    )
