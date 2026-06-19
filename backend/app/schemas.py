from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional, List
import json

# Estrutura interna para exemplos (Inglês e Português)
class ExampleItem(BaseModel):
    en: str
    pt: str

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
    examples_count: int
    tone_focus: str
    show_translation: bool = True
    show_meaning: bool = True
    show_explanation: bool = True
    show_examples: bool = True
    show_tip: bool = True
    custom_instructions: Optional[str] = ""

# Schemas de Termo
class TermBase(BaseModel):
    text: str

class TermCreate(TermBase):
    custom_settings: Optional[AISettings] = None

class TermResponse(BaseModel):
    id: int
    text: str
    type: str
    generated_content: GeneratedContent
    difficulty_level: str
    next_review_date: datetime
    mastered: bool
    created_at: datetime
    mastered_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("generated_content", mode="before")
    @classmethod
    def parse_json(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, dict) and "translation" not in parsed:
                    parsed["translation"] = ""
                return parsed
            except Exception:
                return {
                    "translation": "",
                    "meaning": "Significado indisponível.",
                    "explanation": "Erro ao decodificar JSON.",
                    "examples": [],
                    "tip": ""
                }
        return v

# Schema de Estatísticas de Revisão para o Dashboard
class ReviewStats(BaseModel):
    total_active: int
    pending_review: int
    mastered_words: int
    mastered_expressions: int

# Schema para atualização de termos
class TermUpdate(BaseModel):
    translation: str
    meaning: str
    explanation: str
    examples: List[ExampleItem]
    tip: str


