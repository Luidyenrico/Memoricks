"""Starter templates; stable field IDs allow safe mapping of older cards."""

from .schemas import CardField, CardTemplate
from .languages import language_name


def field(key, label, instructions, **options):
    return CardField(id=key, label=label, instructions=instructions, **options)


def starter_template(kind="general", language="en", native="pt", preferences=None):
    prompt = field(
        "prompt",
        "Pergunta ou assunto",
        "Formule uma pergunta clara sobre a entrada.",
        side="front",
        length="short",
    )
    if kind == "languages":
        settings = preferences or {}
        fields = [
            field(
                "prompt",
                "Palavra ou expressão",
                f"Reproduza a entrada em {language_name(language)}.",
                side="front",
                size="large",
            ),
            field(
                "translation",
                "Tradução",
                f"Tradução direta em {language_name(native)}.",
                length="short",
            ),
            field(
                "meaning",
                "Significado",
                settings.get("meaning_limit", "Explique brevemente o significado."),
                length="short",
            ),
            field(
                "explanation",
                "Explicação",
                settings.get("explanation_style", "Explique o uso em até duas frases."),
            ),
            field(
                "examples",
                "Exemplos",
                f"Crie {settings.get('examples_count', 3)} exemplos em {language_name(language)}, cada um seguido da tradução em {language_name(native)}.",
                format="list",
            ),
            field(
                "tip",
                "Dica",
                f"Dica para memorizar. Foco: {settings.get('tone_focus', 'geral')}.",
                required=False,
                length="short",
            ),
        ]
    elif kind == "python":
        fields = [
            prompt,
            field(
                "answer", "Conceito", "Explique o conceito de forma prática e precisa."
            ),
            field(
                "code",
                "Exemplo de código",
                "Exemplo curto em Python 3, válido e comentado. Retorne código sem cercas Markdown.",
                format="code",
                font="mono",
            ),
            field(
                "explanation",
                "Como funciona",
                "Explique o exemplo passo a passo.",
                format="list",
            ),
            field(
                "pitfall",
                "Atenção",
                "Um erro comum e como evitá-lo.",
                required=False,
                length="short",
            ),
        ]
    else:
        fields = [
            prompt,
            field(
                "answer",
                "Resposta",
                "Responda com precisão e clareza, dentro do contexto.",
            ),
            field(
                "example",
                "Exemplo",
                "Dê um exemplo concreto que ajude a entender.",
                required=False,
            ),
            field(
                "tip",
                "Dica para lembrar",
                "Uma associação útil para memorizar.",
                required=False,
                length="short",
            ),
        ]
    return CardTemplate(fields=fields).model_dump()


def validate_values(template, values):
    model = CardTemplate.model_validate(template)
    if set(values) - {field.id for field in model.fields}:
        raise ValueError("O card contém campos que não pertencem a este modelo.")
    result = {}
    for field in model.fields:
        value = values.get(field.id, "")
        if not isinstance(value, str):
            raise ValueError(f"O campo {field.label} precisa conter texto.")
        if field.required and not value.strip():
            raise ValueError(f"Preencha o campo {field.label}.")
        if len(value) > field.max_chars:
            raise ValueError(
                f"O campo {field.label} aceita até {field.max_chars} caracteres."
            )
        result[field.id] = value.rstrip() if field.format == "code" else value.strip()
    return result
