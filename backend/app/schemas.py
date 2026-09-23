from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .content import normalize_term


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CardField(InputModel):
    id: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9_-]{0,63}$")
    label: str = Field(min_length=1, max_length=80)
    instructions: str = Field(default="", max_length=4000)
    side: Literal["front", "back"] = "back"
    format: Literal["text", "list", "code"] = "text"
    required: bool = True
    length: Literal["short", "medium", "detailed"] = "medium"
    max_chars: int = Field(default=3000, ge=20, le=20000)
    font: Literal["sans", "serif", "mono"] = "sans"
    size: Literal["small", "medium", "large"] = "medium"
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    background: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("label")
    @classmethod
    def label_not_blank(cls, value):
        if not value.strip():
            raise ValueError("O nome do campo não pode ficar vazio.")
        return value.strip()


class CardTemplate(InputModel):
    fields: list[CardField] = Field(min_length=2, max_length=20)

    @model_validator(mode="after")
    def validate_fields(self):
        ids = [field.id for field in self.fields]
        if len(ids) != len(set(ids)):
            raise ValueError("Cada campo precisa de um identificador único.")
        for side in ("front", "back"):
            if not any(field.side == side and field.required for field in self.fields):
                raise ValueError(
                    "Mantenha pelo menos um campo obrigatório na frente e no verso."
                )
        return self


class GroupInput(InputModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)
    context: str = Field(default="", max_length=12000)
    color: str = Field(default="#85a5ff", pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("title")
    @classmethod
    def clean_title(cls, value):
        value = normalize_term(value)
        if not value:
            raise ValueError("Informe um título.")
        return value


class GroupUpdate(GroupInput):
    version: int = Field(ge=1)


class SubgroupInput(InputModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)
    context: str = Field(default="", max_length=12000)
    template: CardTemplate

    @field_validator("title")
    @classmethod
    def clean_title(cls, value):
        return GroupInput.clean_title(value)


class SubgroupUpdate(SubgroupInput):
    version: int = Field(ge=1)


class GenerationInput(InputModel):
    text: str = Field(min_length=1, max_length=5000)

    @field_validator("text")
    @classmethod
    def clean_text(cls, value):
        if not value.strip():
            raise ValueError("Informe um assunto, pergunta ou conteúdo.")
        return value.strip()


class CardInput(GenerationInput):
    values: dict[str, str]
    template_version: int = Field(ge=1)
    source: Literal["manual", "ai", "demo"] = "manual"


class CardUpdate(CardInput):
    version: int = Field(ge=1)
    use_current_template: bool = False


class BatchPlanInput(GenerationInput):
    text: str = Field(min_length=1, max_length=40000)


class BatchGenerationInput(GenerationInput):
    common_context: str = Field(default="", max_length=3000)
    subgroup_version: int = Field(ge=1)
    group_version: int = Field(ge=1)


class BatchSaveInput(InputModel):
    request_id: str = Field(pattern=r"^[a-zA-Z0-9-]{16,64}$")
    cards: list[CardInput] = Field(min_length=1, max_length=50)


class ReviewInput(InputModel):
    action: Literal["difficult", "medium", "easy", "master"]
    version: int = Field(ge=1)


class CardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subgroup_id: int
    text: str
    values: dict[str, str]
    template: CardTemplate
    template_version: int
    source: str
    needs_attention: bool
    difficulty_level: str
    next_review_date: datetime
    mastered: bool
    created_at: datetime
    mastered_at: datetime | None
    version: int

    @field_validator("next_review_date", "created_at", "mastered_at")
    @classmethod
    def utc_offset(cls, value):
        return (
            value.replace(tzinfo=timezone.utc)
            if value and value.tzinfo is None
            else value
        )


class ProfileUpdate(InputModel):
    native_language: str


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    native_language: str
