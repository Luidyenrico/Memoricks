from .dates import utc_now
from sqlalchemy.orm import Session
from datetime import datetime
from . import models
from .content import normalize_term, is_reviewable

# Buscar termo por texto exato (para checar duplicatas)
def get_term_by_text(db: Session, text: str, learning_language: str):
    key = normalize_term(text).casefold()
    candidates = db.query(models.Term.id, models.Term.text).filter(
        models.Term.learning_language == learning_language
    ).all()
    term_id = next((row.id for row in candidates if normalize_term(row.text).casefold() == key), None)
    return db.get(models.Term, term_id) if term_id is not None else None

# Buscar termo por ID
def get_term(db: Session, term_id: int):
    return db.query(models.Term).filter(models.Term.id == term_id).first()

# Criar um novo termo
def create_term(
    db: Session,
    text: str,
    term_type: str,
    learning_language: str,
    native_language: str,
    generated_content_json: str | None = None,
    exact_translation: str = "",
):
    if not generated_content_json:
        generated_content_json = '{"translation": "", "meaning": "", "explanation": "", "examples": [], "tip": ""}'

    db_term = models.Term(
        text=text.strip(),
        type=term_type,
        learning_language=learning_language,
        native_language=native_language,
        exact_translation=exact_translation,
        generated_content=generated_content_json,
        created_at=utc_now(),
        next_review_date=utc_now()  # Disponível para revisão imediata
    )
    db.add(db_term)
    db.commit()
    db.refresh(db_term)
    return db_term

# Listar todos os termos pendentes para revisão
def get_pending_reviews(db: Session, learning_language: str | None = None):
    now = utc_now()
    query = db.query(models.Term).filter(
        models.Term.mastered.is_(False),
        models.Term.next_review_date <= now
    )
    if learning_language:
        query = query.filter(models.Term.learning_language == learning_language)
    return [term for term in query.order_by(models.Term.next_review_date.asc()).all()
            if is_reviewable(term.generated_content)]

def get_quiz_terms(db: Session, scope: str = "pending", learning_language: str | None = None):
    query = db.query(models.Term).filter(
        models.Term.mastered.is_(False),
        models.Term.exact_translation != ""
    )
    if learning_language:
        query = query.filter(models.Term.learning_language == learning_language)

    if scope == "active":
        return query.order_by(models.Term.created_at.desc()).all()

    now = utc_now()
    return query.filter(
        models.Term.next_review_date <= now
    ).order_by(models.Term.next_review_date.asc()).all()

def get_all_quiz_translations(db: Session, learning_language: str, native_language: str):
    terms = db.query(models.Term).filter(
        models.Term.learning_language == learning_language,
        models.Term.native_language == native_language,
        models.Term.exact_translation != "",
    ).all()
    return [term.exact_translation for term in terms if is_reviewable(term.generated_content)]

# Atualizar agendamento do termo com base na resposta de revisão
def update_term_review(db: Session, term_id: int, difficulty: str, next_review_date: datetime):
    db_term = get_term(db, term_id)
    if db_term:
        db_term.difficulty_level = difficulty
        db_term.next_review_date = next_review_date
        db.commit()
        db.refresh(db_term)
    return db_term

# Marcar termo como dominado (Mastered)
def master_term(db: Session, term_id: int):
    db_term = get_term(db, term_id)
    if db_term:
        db_term.mastered = True
        db_term.mastered_at = utc_now()
        db.commit()
        db.refresh(db_term)
    return db_term

# Listar termos dominados por tipo (word ou expression)
def get_mastered_terms(db: Session, term_type: str, learning_language: str | None = None):
    query = db.query(models.Term).filter(
        models.Term.mastered.is_(True),
        models.Term.type == term_type
    )
    if learning_language:
        query = query.filter(models.Term.learning_language == learning_language)
    return query.order_by(models.Term.mastered_at.desc()).all()

# Listar todos os termos ativos (não dominados) sob estudo
def get_active_terms(db: Session, learning_language: str | None = None):
    query = db.query(models.Term).filter(
        models.Term.mastered.is_(False)
    )
    if learning_language:
        query = query.filter(models.Term.learning_language == learning_language)
    return query.order_by(models.Term.created_at.desc()).all()

# Obter estatísticas do painel
def get_review_stats(db: Session, learning_language: str | None = None):
    language_filters = []
    if learning_language:
        language_filters.append(models.Term.learning_language == learning_language)

    total_active = db.query(models.Term).filter(
        models.Term.mastered.is_(False),
        *language_filters,
    ).count()

    pending_review = len(get_pending_reviews(db, learning_language))

    mastered_words = db.query(models.Term).filter(
        models.Term.mastered.is_(True),
        models.Term.type == "word",
        *language_filters,
    ).count()
    mastered_expressions = db.query(models.Term).filter(
        models.Term.mastered.is_(True),
        models.Term.type == "expression",
        *language_filters,
    ).count()

    return {
        "total_active": total_active,
        "pending_review": pending_review,
        "mastered_words": mastered_words,
        "mastered_expressions": mastered_expressions
    }


def get_or_create_profile(db: Session):
    profile = db.query(models.UserProfile).filter(models.UserProfile.id == 1).first()
    if profile:
        return profile

    profile = models.UserProfile(
        id=1,
        native_language="pt",
        learning_language="en",
        learning_language_selected=False,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
