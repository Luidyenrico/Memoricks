"""Idempotent upgrades for existing local SQLite databases."""

from sqlalchemy import inspect, text
from .database import engine, Base
from .content import extract_exact_translation


def _unique_index_columns(connection) -> list[list[str]]:
    unique_indexes: list[list[str]] = []
    for index in connection.exec_driver_sql("PRAGMA index_list('terms')").mappings():
        if not index["unique"]:
            continue
        name = str(index["name"]).replace("'", "''")
        columns = [
            row["name"]
            for row in connection.exec_driver_sql(
                f"PRAGMA index_info('{name}')"
            ).mappings()
        ]
        unique_indexes.append(columns)
    return unique_indexes


def _rebuild_terms_with_language_constraint(connection):
    connection.exec_driver_sql(
        """
        CREATE TABLE terms_migrated (
            id INTEGER NOT NULL PRIMARY KEY,
            text VARCHAR NOT NULL,
            type VARCHAR NOT NULL,
            generated_content TEXT NOT NULL,
            difficulty_level VARCHAR NOT NULL,
            next_review_date DATETIME NOT NULL,
            mastered BOOLEAN NOT NULL,
            created_at DATETIME NOT NULL,
            mastered_at DATETIME,
            exact_translation VARCHAR DEFAULT '' NOT NULL,
            learning_language VARCHAR(10) DEFAULT 'en' NOT NULL,
            native_language VARCHAR(10) DEFAULT 'pt' NOT NULL,
            CONSTRAINT uq_terms_text_learning_language UNIQUE (text, learning_language)
        )
        """
    )
    connection.exec_driver_sql(
        """
        INSERT INTO terms_migrated (
            id, text, type, generated_content, difficulty_level,
            next_review_date, mastered, created_at, mastered_at,
            exact_translation, learning_language, native_language
        )
        SELECT
            id, text, type, generated_content, difficulty_level,
            next_review_date, mastered, created_at, mastered_at,
            exact_translation, COALESCE(NULLIF(learning_language, ''), 'en'),
            COALESCE(NULLIF(native_language, ''), 'pt')
        FROM terms
        """
    )
    connection.exec_driver_sql("DROP TABLE terms")
    connection.exec_driver_sql("ALTER TABLE terms_migrated RENAME TO terms")
    connection.exec_driver_sql("CREATE INDEX ix_terms_id ON terms (id)")
    connection.exec_driver_sql("CREATE INDEX ix_terms_text ON terms (text)")
    connection.exec_driver_sql(
        "CREATE INDEX ix_terms_learning_language ON terms (learning_language)"
    )


def ensure_terms_schema():
    inspector = inspect(engine)
    if not inspector.has_table("terms"):
        return
    columns = {column["name"] for column in inspector.get_columns("terms")}

    with engine.begin() as connection:
        # SQLite legacy transaction mode does not begin a transaction for DDL.
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        if "exact_translation" not in columns:
            connection.execute(
                text("ALTER TABLE terms ADD COLUMN exact_translation VARCHAR DEFAULT '' NOT NULL")
            )
            columns.add("exact_translation")

        if "learning_language" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE terms ADD COLUMN learning_language "
                    "VARCHAR(10) DEFAULT 'en' NOT NULL"
                )
            )
            columns.add("learning_language")

        if "native_language" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE terms ADD COLUMN native_language "
                    "VARCHAR(10) DEFAULT 'pt' NOT NULL"
                )
            )
            columns.add("native_language")

        if ["text"] in _unique_index_columns(connection):
            _rebuild_terms_with_language_constraint(connection)


def backfill_exact_translations():
    with engine.begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT id, generated_content
                FROM terms
                WHERE exact_translation IS NULL OR exact_translation = ''
                """
            )
        ).mappings().all()

        for row in rows:
            exact_translation = extract_exact_translation(row["generated_content"])
            if exact_translation:
                connection.execute(
                    text("UPDATE terms SET exact_translation = :translation WHERE id = :term_id"),
                    {"translation": exact_translation, "term_id": row["id"]},
                )


def initialize_database():
    ensure_terms_schema()
    Base.metadata.create_all(bind=engine)
    backfill_exact_translations()

    profile_columns = {
        column["name"] for column in inspect(engine).get_columns("user_profiles")
    }
    if "learning_language_selected" not in profile_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE user_profiles ADD COLUMN learning_language_selected "
                    "BOOLEAN DEFAULT 0 NOT NULL"
                )
            )

    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT OR IGNORE INTO user_profiles "
                "(id, native_language, learning_language) VALUES (1, 'pt', 'en')"
            )
        )
