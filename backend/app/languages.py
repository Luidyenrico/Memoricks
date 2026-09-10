SUPPORTED_LANGUAGES = {
    "pt": "Português",
    "en": "Inglês",
    "es": "Espanhol",
    "fr": "Francês",
    "de": "Alemão",
    "it": "Italiano",
    "nl": "Holandês",
    "ja": "Japonês",
    "ko": "Coreano",
    "zh": "Chinês",
    "ru": "Russo",
    "ar": "Árabe",
}


def language_name(code: str) -> str:
    return SUPPORTED_LANGUAGES.get(code, code)


def is_supported_language(code: str) -> bool:
    return code in SUPPORTED_LANGUAGES
