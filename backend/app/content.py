"""Compatibility helpers for stored vocabulary cards."""

import json
import unicodedata


def normalize_term(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split())


def parse_content(value) -> dict:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return {}
    return value if isinstance(value, dict) else {}


def extract_exact_translation(value) -> str:
    translation = parse_content(value).get("translation", "")
    return translation.strip() if isinstance(translation, str) else ""


def is_failed_generation_content(value) -> bool:
    content = parse_content(value)
    examples = content.get("examples") or []
    return (
        str(content.get("translation", "")).startswith("Erro '")
        or str(content.get("meaning", "")).startswith("Erro na IA")
        or any(
            isinstance(example, dict)
            and str(example.get("learning", example.get("en", ""))).startswith(
                "Error loading example:"
            )
            for example in (examples if isinstance(examples, list) else [])
        )
    )


def is_reviewable(value) -> bool:
    content = parse_content(value)
    meaning = content.get("meaning")
    return (
        isinstance(meaning, str)
        and bool(meaning.strip())
        and not is_failed_generation_content(content)
    )
