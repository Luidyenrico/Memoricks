from .dates import utc_now
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint
from .database import Base

class Term(Base):
    __tablename__ = "terms"
    __table_args__ = (
        UniqueConstraint("text", "learning_language", name="uq_terms_text_learning_language"),
    )

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, index=True, nullable=False)
    type = Column(String, nullable=False)  # "word" ou "expression"
    learning_language = Column(String(10), default="en", index=True, nullable=False)
    native_language = Column(String(10), default="pt", nullable=False)
    exact_translation = Column(String, default="", nullable=False)
    generated_content = Column(Text, nullable=False)
    difficulty_level = Column(String, default="Difficult", nullable=False)  # "Difficult", "Medium", "Easy"
    next_review_date = Column(DateTime, default=utc_now, nullable=False)
    mastered = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    mastered_at = Column(DateTime, nullable=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, default=1)
    native_language = Column(String(10), default="pt", nullable=False)
    learning_language = Column(String(10), default="en", nullable=False)
    learning_language_selected = Column(
        Boolean,
        default=False,
        server_default="0",
        nullable=False,
    )
