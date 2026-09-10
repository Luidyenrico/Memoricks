from ..dates import utc_now
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
import json
import random
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text as sql_text
from ..content import extract_exact_translation, is_failed_generation_content, is_reviewable
from ..generation import ContentGenerationError, generate_ai_content, load_settings, save_settings

from ..database import get_db
from .. import crud, schemas
from ..languages import is_supported_language, language_name

class ReviewRequest(BaseModel):
    action: str


router = APIRouter(
    prefix="/terms",
    tags=["Terms"],
)

def unique_translations(translations: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()

    for translation in translations:
        cleaned = translation.strip()
        key = cleaned.casefold()
        if cleaned and key not in seen:
            seen.add(key)
            unique.append(cleaned)

    return unique


def selected_learning_language(db: Session, requested: str | None) -> str:
    language = requested or crud.get_or_create_profile(db).learning_language
    if not is_supported_language(language):
        raise HTTPException(status_code=400, detail="Idioma de estudo não suportado.")
    return language

@router.get("/stats", response_model=schemas.ReviewStats)
def get_stats(learning_language: str | None = None, db: Session = Depends(get_db)):
    language = selected_learning_language(db, learning_language)
    return crud.get_review_stats(db, learning_language=language)

@router.get("/pending", response_model=List[schemas.TermResponse])
def read_pending_reviews(learning_language: str | None = None, db: Session = Depends(get_db)):
    language = selected_learning_language(db, learning_language)
    return crud.get_pending_reviews(db, learning_language=language)

@router.get("/active", response_model=List[schemas.TermResponse])
def read_active_terms(learning_language: str | None = None, db: Session = Depends(get_db)):
    language = selected_learning_language(db, learning_language)
    return crud.get_active_terms(db, learning_language=language)

@router.get("/mastered/{term_type}", response_model=List[schemas.TermResponse])
def read_mastered_terms(
    term_type: str,
    learning_language: str | None = None,
    db: Session = Depends(get_db),
):
    if term_type not in ["word", "expression"]:
        raise HTTPException(status_code=400, detail="Tipo inválido. Deve ser 'word' ou 'expression'.")
    language = selected_learning_language(db, learning_language)
    return crud.get_mastered_terms(
        db,
        term_type=term_type,
        learning_language=language,
    )

@router.get("/quiz", response_model=List[schemas.TranslationQuizQuestion])
def read_translation_quiz(
    scope: str = "pending",
    learning_language: str | None = None,
    db: Session = Depends(get_db),
):
    if scope not in ["pending", "active"]:
        raise HTTPException(status_code=400, detail="Escopo invalido. Use 'pending' ou 'active'.")

    language = selected_learning_language(db, learning_language)
    terms = [term for term in crud.get_quiz_terms(db, scope=scope, learning_language=language)
             if is_reviewable(term.generated_content)]
    if not terms:
        return []
    translation_pools = {
        native: unique_translations(crud.get_all_quiz_translations(db, language, native))
        for native in {term.native_language for term in terms}
    }
    questions: list[schemas.TranslationQuizQuestion] = []

    for term in terms:
        correct_translation = term.exact_translation.strip()
        if not correct_translation:
            correct_translation = extract_exact_translation(term.generated_content)
        if not correct_translation:
            continue

        distractors = [
            translation
            for translation in translation_pools[term.native_language]
            if translation.casefold() != correct_translation.casefold()
        ]
        if len(distractors) < 3:
            continue

        options = random.sample(distractors, 3)
        options.append(correct_translation)
        random.shuffle(options)

        questions.append(
            schemas.TranslationQuizQuestion(
                term_id=term.id,
                text=term.text,
                type=term.type,
                correct_translation=correct_translation,
                options=options,
            )
        )

    if not questions:
        raise HTTPException(
            status_code=400,
            detail="O quiz precisa de 4 traduções diferentes no mesmo par de idiomas. Você pode continuar pelos flashcards.",
        )
    return questions

@router.get("/{term_id}", response_model=schemas.TermResponse)
def read_term(term_id: int, db: Session = Depends(get_db)):
    db_term = crud.get_term(db, term_id)
    if not db_term:
        raise HTTPException(status_code=404, detail="Termo não encontrado")
    return db_term

@router.post("/", response_model=schemas.TermResponse, status_code=status.HTTP_201_CREATED)
async def create_term(payload: schemas.TermCreate, db: Session = Depends(get_db)):
    term_text = payload.text.strip()
    if not term_text:
        raise HTTPException(status_code=400, detail="O texto do termo não pode ser vazio.")

    learning_language = payload.term_language
    native_language = payload.explanation_language
    if not is_supported_language(learning_language):
        raise HTTPException(status_code=400, detail="Idioma do termo não suportado.")
    if not is_supported_language(native_language):
        raise HTTPException(status_code=400, detail="Idioma da explicação não suportado.")

    normalized_term = term_text

    db_term = crud.get_term_by_text(
        db,
        text=normalized_term,
        learning_language=learning_language,
    )
    if db_term and not is_failed_generation_content(db_term.generated_content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"O termo '{normalized_term}' já existe na sua lista de "
                f"{language_name(learning_language)}."
            ),
        )

    words_count = len(normalized_term.split())
    term_type = "word" if words_count == 1 else "expression"

    try:
        generated_json = await generate_ai_content(
            normalized_term,
            learning_language,
            native_language,
            payload.custom_settings,
        )
    except ContentGenerationError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    # Serialize the final duplicate check and write; AI generation runs outside
    # this transaction. Unicode casefold also handles legacy accented terms.
    db.rollback()
    try:
        db.execute(sql_text("BEGIN IMMEDIATE"))
        existing = crud.get_term_by_text(db, normalized_term, learning_language)
        if existing and not is_failed_generation_content(existing.generated_content):
            raise HTTPException(status_code=409, detail="Este termo já foi cadastrado neste idioma.")
        profile = crud.get_or_create_profile(db)
        # Do not change the selected study language to the user's native language.
        if learning_language != profile.native_language:
            profile.learning_language = learning_language
            profile.learning_language_selected = True
        if existing:
            existing.generated_content = generated_json
            existing.exact_translation = extract_exact_translation(generated_json)
            existing.native_language = native_language
            db.commit()
            db.refresh(existing)
            new_term = existing
        else:
            new_term = crud.create_term(
                db=db, text=normalized_term, term_type=term_type,
                learning_language=learning_language, native_language=native_language,
                generated_content_json=generated_json,
                exact_translation=extract_exact_translation(generated_json),
            )
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Este termo já foi cadastrado neste idioma.") from error
    except Exception:
        db.rollback()
        raise

    return new_term

@router.post("/{term_id}/cancel", response_model=schemas.TermResponse)
def cancel_term_generation(term_id: int, db: Session = Depends(get_db)):
    db_term = crud.get_term(db, term_id)
    if not db_term:
        raise HTTPException(status_code=404, detail="Termo não encontrado")

    if is_reviewable(db_term.generated_content):
        raise HTTPException(status_code=409, detail="Este termo já está pronto. Use a exclusão de termos para removê-lo.")
    db.delete(db_term)
    db.commit()
    return db_term

@router.post("/{term_id}/review", response_model=schemas.TermResponse)
def review_term(term_id: int, payload: ReviewRequest, db: Session = Depends(get_db)):
    db_term = crud.get_term(db, term_id)
    if not db_term:
        raise HTTPException(status_code=404, detail="Termo não encontrado")

    if db_term.mastered:
        raise HTTPException(status_code=409, detail="Este termo já foi dominado.")
    if not is_reviewable(db_term.generated_content):
        raise HTTPException(status_code=409, detail="Preencha o conteúdo do termo antes de revisar.")

    action = payload.action.lower()
    if action == "master":
        if db_term.difficulty_level != "Easy":
            raise HTTPException(status_code=400, detail="Apenas termos classificados como Fácil podem ser dominados.")
        return crud.master_term(db, term_id)

    schedules = {
        "difficult": ("Difficult", timedelta(minutes=5)),
        "again": ("Difficult", timedelta()),
        "medium": ("Medium", timedelta(hours=1)),
        "easy": ("Easy", timedelta(days=1)),
    }
    if action not in schedules:
        raise HTTPException(status_code=400, detail="Ação inválida. Use difficult, medium, easy, again ou master.")
    difficulty, interval = schedules[action]
    return crud.update_term_review(db, term_id, difficulty, utc_now() + interval)

@router.delete("/{term_id}", response_model=schemas.TermResponse)
def delete_term(term_id: int, db: Session = Depends(get_db)):
    db_term = crud.get_term(db, term_id)
    if not db_term:
        raise HTTPException(status_code=404, detail="Termo não encontrado")
    db.delete(db_term)
    db.commit()
    return db_term

@router.get("/settings/ai", response_model=schemas.AISettings)
def get_ai_settings():
    return load_settings()

@router.put("/settings/ai", response_model=schemas.AISettings)
def update_ai_settings(payload: schemas.AISettings):
    settings = payload.model_dump()
    try:
        save_settings(settings)
    except OSError as error:
        raise HTTPException(status_code=500, detail="Não foi possível salvar as configurações. Tente novamente.") from error
    return settings

@router.put("/{term_id}", response_model=schemas.TermResponse)
def update_term(term_id: int, payload: schemas.TermUpdate, db: Session = Depends(get_db)):
    db_term = crud.get_term(db, term_id)
    if not db_term:
        raise HTTPException(status_code=404, detail="Termo não encontrado")

    updated_content = {
        "translation": payload.translation.strip(),
        "meaning": payload.meaning.strip(),
        "explanation": payload.explanation.strip(),
        "examples": [
            {"learning": ex.learning.strip(), "native": ex.native.strip()}
            for ex in payload.examples
        ],
        "tip": payload.tip.strip()
    }
    db_term.generated_content = json.dumps(updated_content)
    db_term.exact_translation = updated_content["translation"]
    db.commit()
    db.refresh(db_term)
    return db_term
