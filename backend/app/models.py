from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime
from .database import Base

class Term(Base):
    __tablename__ = "terms"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, unique=True, index=True, nullable=False)
    type = Column(String, nullable=False)  # "word" ou "expression"
    generated_content = Column(Text, nullable=False)  # Armazenará o JSON da IA como string
    difficulty_level = Column(String, default="Difficult", nullable=False)  # "Difficult", "Medium", "Easy"
    next_review_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    mastered = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    mastered_at = Column(DateTime, nullable=True)
