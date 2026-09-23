"""Two-level collections and cards with immutable template snapshots."""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from .database import Base
from .dates import utc_now


class Group(Base):
    __tablename__ = "study_groups"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False, default="")
    context = Column(Text, nullable=False, default="")
    color = Column(String(7), nullable=False, default="#85a5ff")
    version = Column(Integer, nullable=False, default=1)


class Subgroup(Base):
    __tablename__ = "subgroups"
    id = Column(Integer, primary_key=True)
    group_id = Column(
        Integer,
        ForeignKey("study_groups.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False, default="")
    context = Column(Text, nullable=False, default="")
    template = Column(JSON, nullable=False)
    template_version = Column(Integer, nullable=False, default=1)
    version = Column(Integer, nullable=False, default=1)


class Card(Base):
    __tablename__ = "cards"
    __table_args__ = (
        UniqueConstraint("subgroup_id", "input_key", name="uq_card_input_subgroup"),
    )
    id = Column(Integer, primary_key=True)
    subgroup_id = Column(
        Integer,
        ForeignKey("subgroups.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    text = Column(Text, nullable=False)
    input_key = Column(Text, nullable=False)
    values = Column(JSON, nullable=False)
    template = Column(JSON, nullable=False)
    template_version = Column(Integer, nullable=False)
    source = Column(String(20), nullable=False, default="manual")
    legacy_content = Column(Text, nullable=True)
    needs_attention = Column(Boolean, nullable=False, default=False)
    difficulty_level = Column(String(20), nullable=False, default="Difficult")
    next_review_date = Column(DateTime, nullable=False, default=utc_now, index=True)
    mastered = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    mastered_at = Column(DateTime, nullable=True)
    version = Column(Integer, nullable=False, default=1)


class BatchReceipt(Base):
    __tablename__ = "batch_receipts"
    request_id = Column(String(64), primary_key=True)
    payload_hash = Column(String(64), nullable=False)
    count = Column(Integer, nullable=False)


class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    native_language = Column(String(10), default="pt", nullable=False)
    # Compatibility columns; navigation now uses subgroups.
    learning_language = Column(String(10), default="en", nullable=False)
    learning_language_selected = Column(
        Boolean, default=False, server_default="0", nullable=False
    )


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    google_sub = Column(String(255), nullable=True, unique=True)
    email = Column(String(320), nullable=False, unique=True)
    name = Column(String(255), nullable=False, default="")
    # Legacy column retained for non-destructive upgrades; password login is removed.
    password_hash = Column(String(255), nullable=True)


class AuthThrottle(Base):
    __tablename__ = "auth_throttles"
    key = Column(String(64), primary_key=True)
    attempts = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
