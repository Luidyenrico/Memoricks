from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from datetime import datetime, timezone
from typing import Optional, List
from .content import normalize_term, parse_content

class ExampleItem(BaseModel):
    learning: str
    native: str

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_language_keys(cls, value):
        if isinstance(value, dict):
            migrated = dict(value)
            migrated.setdefault("learning", migrated.get("en", ""))
            migrated.setdefault("native", migrated.get("pt", ""))
            return migrated
        return value

# Nova estrutura de resposta da IA
class GeneratedContent(BaseModel):
    translation: str
    meaning: str
    explanation: str
    examples: List[ExampleItem]
    tip: str

# Schema para preferências de IA
class AISettings(BaseModel):
    meaning_limit: str
    explanation_style: str
    examples_count: int = Field(ge=2, le=4)
    tone_focus: str
    show_translation: bool = True
    show_meaning: bool = True
    show_explanation: bool = True
    show_examples: bool = True
    show_tip: bool = True
    custom_instructions: Optional[str] = ""

# Schemas de Termo
class TermBase(BaseModel):
    text: str = Field(min_length=1, max_length=300)

    @field_validator("text", mode="before")
    @classmethod
    def clean_text(cls, value):
        return normalize_term(value) if isinstance(value, str) else value

class TermCreate(TermBase):
    term_language: str
    explanation_language: str
    custom_settings: Optional[AISettings] = None

class TermResponse(BaseModel):
    id: int
    text: str
    type: str
    learning_language: str
    native_language: str
    exact_translation: str
    generated_content: GeneratedContent
    difficulty_level: str
    next_review_date: datetime
    mastered: bool
    created_at: datetime
    mastered_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("next_review_date", "created_at", "mastered_at", mode="after")
    @classmethod
    def include_utc_offset(cls, value):
        # SQLite stores these dates as naive UTC. Make that explicit on the wire.
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    @field_validator("generated_content", mode="before")
    @classmethod
    def parse_json(cls, v):
        if isinstance(v, GeneratedContent):
            return v
        parsed = parse_content(v)
        content = {
            key: parsed.get(key) if isinstance(parsed.get(key), str) else ""
            for key in ("translation", "meaning", "explanation", "tip")
        }
        examples = parsed.get("examples")
        content["examples"] = [
            {"learning": example.get("learning", example.get("en", "")),
             "native": example.get("native", example.get("pt", ""))}
            for example in (examples if isinstance(examples, list) else [])
            if isinstance(example, dict)
            and isinstance(example.get("learning", example.get("en", "")), str)
            and isinstance(example.get("native", example.get("pt", "")), str)
        ]
        return content

# Schema de Estatísticas de Revisão para o Dashboard
class ReviewStats(BaseModel):
    total_active: int
    pending_review: int
    mastered_words: int
    mastered_expressions: int

class TranslationQuizQuestion(BaseModel):
    term_id: int
    text: str
    type: str
    correct_translation: str
    options: List[str]


class LanguageOption(BaseModel):
    code: str
    name: str


class ProfileResponse(BaseModel):
    native_language: str
    learning_language: str
    learning_language_selected: bool

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    native_language: Optional[str] = None
    learning_language: Optional[str] = None

# Schema para atualização de termos
class TermUpdate(GeneratedContent):
    pass
