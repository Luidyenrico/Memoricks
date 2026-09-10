"""AI provider integration and persisted generation preferences."""

import json
import os
import tempfile
from openai import AsyncOpenAI
from . import schemas
from .languages import language_name

# A Groq expõe uma API compatível com o cliente da OpenAI já usado pelo projeto.
groq_api_key = os.environ.get("GROQ_API_KEY")
groq_model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
groq_fallback_model = os.environ.get("GROQ_FALLBACK_MODEL", "openai/gpt-oss-20b")

ai_client = None
if groq_api_key:
    ai_client = AsyncOpenAI(
        api_key=groq_api_key,
        base_url="https://api.groq.com/openai/v1",
        timeout=30.0,
        max_retries=0,
    )

AI_MODELS = list(dict.fromkeys([groq_model, groq_fallback_model]))

GENERATION_MAX_TOKENS = int(os.environ.get("GENERATION_MAX_TOKENS", "1200"))

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ai_settings.json")

def load_settings() -> dict:
    default_settings = {
        "meaning_limit": "Curto (até 10 palavras)",
        "explanation_style": "Padrão (até 2 frases)",
        "examples_count": 3,
        "tone_focus": "Geral"
    }
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as handle:
            stored = json.load(handle)
        return schemas.AISettings.model_validate({**default_settings, **stored}).model_dump()
    except (OSError, ValueError, TypeError):
        return schemas.AISettings(**default_settings).model_dump()


def save_settings(settings: dict):
    # Replace atomically, so readers never observe a partially written JSON file.
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=os.path.dirname(SETTINGS_FILE), delete=False) as handle:
            temporary_path = handle.name
            json.dump(settings, handle, indent=4, ensure_ascii=False)
        os.replace(temporary_path, SETTINGS_FILE)
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.unlink(temporary_path)


class ContentGenerationError(Exception):
    pass


def generation_error_message(error: Exception) -> str:
    status_code = getattr(error, "status_code", None)
    body = getattr(error, "body", None)
    error_details = body.get("error", body) if isinstance(body, dict) else {}
    error_code = error_details.get("code") if isinstance(error_details, dict) else None

    if status_code in [401, 403]:
        return (
            "A Groq recusou a chave de API configurada. O termo não foi cadastrado; "
            "verifique a variável GROQ_API_KEY."
        )

    if status_code == 429 or error_code in ["rate_limit_exceeded", "insufficient_quota"]:
        return (
            "A Groq não conseguiu gerar o conteúdo porque o limite gratuito da conta "
            "foi atingido. O termo não foi cadastrado; tente novamente após a renovação "
            "do limite."
        )

    return (
        "Não foi possível gerar o conteúdo agora. O termo não foi cadastrado; "
        "tente novamente em instantes."
    )


def generated_content_response_format() -> dict:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "vocabulary_card",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "translation": {"type": "string"},
                    "meaning": {"type": "string"},
                    "explanation": {"type": "string"},
                    "examples": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "learning": {"type": "string"},
                                "native": {"type": "string"},
                            },
                            "required": ["learning", "native"],
                            "additionalProperties": False,
                        },
                    },
                    "tip": {"type": "string"},
                },
                "required": [
                    "translation",
                    "meaning",
                    "explanation",
                    "examples",
                    "tip",
                ],
                "additionalProperties": False,
            },
        },
    }

async def generate_ai_content(
    term: str,
    learning_language: str,
    native_language: str,
    custom_settings: schemas.AISettings | None = None,
) -> str:
    # Carrega preferências personalizadas de IA
    settings = custom_settings.model_dump() if custom_settings else load_settings()
    meaning_limit = settings.get("meaning_limit", "Curto (até 10 palavras)")
    explanation_style = settings.get("explanation_style", "Padrão (até 2 frases)")
    examples_count = settings.get("examples_count", 3)
    tone_focus = settings.get("tone_focus", "Geral")

    if not ai_client:
        mock_examples = [
            {
                "learning": f"Example sentence {i+1} using '{term}'.",
                "native": f"Frase de exemplo {i+1} usando '{term}'.",
            }
            for i in range(examples_count)
        ]
        mock_content = {
            "translation": f"[Demonstração] Tradução de '{term}'",
            "meaning": f"Significado de '{term}' (Formato: {meaning_limit}).",
            "explanation": "Conteúdo de demonstração. A geração por IA não está configurada neste ambiente; estes exemplos não são traduções reais.",
            "examples": mock_examples,
            "tip": f"Dica rápida focada em: {tone_focus}."
        }
        return json.dumps(mock_content)

    learning_name = language_name(learning_language)
    native_name = language_name(native_language)
    messages = [
        {
            "role": "system",
            "content": (
                f"Create concise vocabulary cards for {learning_name} learners. "
                f"The supplied term is already in {learning_name}; do not detect its "
                "language and do not rewrite it. "
                f"Write translation, meaning, explanation and tip in {native_name}. "
                f"Return exactly {examples_count} examples. Each example.learning must be "
                f"in {learning_name}; each example.native must be its {native_name} "
                "translation. Return only the requested structured response."
            ),
        },
        {
            "role": "user",
            "content": (
                f"term={json.dumps(term, ensure_ascii=False)}; "
                f"translation=direct and concise; meaning={meaning_limit}; "
                f"explanation={explanation_style}; examples={examples_count}; "
                f"tip focus={tone_focus}. "
                f"Additional instructions: {settings.get('custom_instructions') or 'none'}."
            ),
        },
    ]

    last_error: Exception | None = None
    for model_name in AI_MODELS:
        try:
            response = await ai_client.chat.completions.create(
                model=model_name,
                messages=messages,
                response_format=generated_content_response_format(),
                max_completion_tokens=GENERATION_MAX_TOKENS,
                reasoning_effort="low",
            )
            raw_content = response.choices[0].message.content
            if not raw_content:
                raise ValueError("O modelo não retornou conteúdo.")

            parsed_object = schemas.GeneratedContent.model_validate_json(raw_content)
            if len(parsed_object.examples) != examples_count:
                raise ValueError("O modelo retornou uma quantidade incorreta de exemplos.")

            if not parsed_object.translation.strip() or not parsed_object.meaning.strip():
                raise ValueError("O modelo retornou um cartão vazio.")
            return parsed_object.model_dump_json()
        except Exception as error:
            last_error = error

    if last_error is None:
        last_error = RuntimeError("Nenhum modelo de IA foi configurado.")
    raise ContentGenerationError(generation_error_message(last_error)) from last_error
