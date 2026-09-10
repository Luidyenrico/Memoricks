from sqlalchemy import create_engine
from pathlib import Path
import os

from dotenv import load_dotenv
from sqlalchemy.orm import declarative_base, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
SQLALCHEMY_DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'memoricks.db').as_posix()}"
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
