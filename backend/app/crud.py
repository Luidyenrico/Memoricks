from sqlalchemy.orm import Session
from datetime import datetime
from . import models

# Buscar termo por texto exato (para checar duplicatas)
def get_term_by_text(db: Session, text: str):
    # Comparar case-insensitive e aparando espaços em branco
    cleaned_text = text.strip().lower()
    return db.query(models.Term).filter(models.Term.text == cleaned_text).first()

# Buscar termo por ID
def get_term(db: Session, term_id: int):
    return db.query(models.Term).filter(models.Term.id == term_id).first()

# Criar um novo termo
def create_term(db: Session, text: str, term_type: str, generated_content_json: str = None):
    if not generated_content_json:
        generated_content_json = '{"translation": "", "meaning": "", "explanation": "", "examples": [], "tip": ""}'
        
    db_term = models.Term(
        text=text.strip().lower(),
        type=term_type,
        generated_content=generated_content_json,
        created_at=datetime.utcnow(),
        next_review_date=datetime.utcnow()  # Disponível para revisão imediata
    )
    db.add(db_term)
    db.commit()
    db.refresh(db_term)
    return db_term

# Listar todos os termos pendentes para revisão
def get_pending_reviews(db: Session):
    now = datetime.utcnow()
    return db.query(models.Term).filter(
        models.Term.mastered == False,
        models.Term.next_review_date <= now
    ).order_by(models.Term.next_review_date.asc()).all()

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
        db_term.mastered_at = datetime.utcnow()
        db.commit()
        db.refresh(db_term)
    return db_term

# Listar termos dominados por tipo (word ou expression)
def get_mastered_terms(db: Session, term_type: str):
    return db.query(models.Term).filter(
        models.Term.mastered == True,
        models.Term.type == term_type
    ).order_by(models.Term.mastered_at.desc()).all()

# Listar todos os termos ativos (não dominados) sob estudo
def get_active_terms(db: Session):
    return db.query(models.Term).filter(
        models.Term.mastered == False
    ).order_by(models.Term.created_at.desc()).all()

# Obter estatísticas do painel
def get_review_stats(db: Session):
    now = datetime.utcnow()
    total_active = db.query(models.Term).filter(models.Term.mastered == False).count()
    
    pending_review = db.query(models.Term).filter(
        models.Term.mastered == False,
        models.Term.next_review_date <= now
    ).count()
        
    mastered_words = db.query(models.Term).filter(
        models.Term.mastered == True,
        models.Term.type == "word"
    ).count()
    mastered_expressions = db.query(models.Term).filter(
        models.Term.mastered == True,
        models.Term.type == "expression"
    ).count()

    return {
        "total_active": total_active,
        "pending_review": pending_review,
        "mastered_words": mastered_words,
        "mastered_expressions": mastered_expressions
    }
