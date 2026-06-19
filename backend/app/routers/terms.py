from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
import asyncio
import os
import json
from openai import AsyncOpenAI
from pydantic import BaseModel

from ..database import get_db, SessionLocal
from .. import crud, schemas, models

router = APIRouter(
    prefix="/terms",
    tags=["Terms"],
)

# Configura a API da OpenAI
openai_api_key = os.environ.get("OPENAI_API_KEY")
openai_model = os.environ.get("OPENAI_MODEL", "gpt-5-nano")

client = None
if openai_api_key:
    client = AsyncOpenAI(api_key=openai_api_key)

GENERATION_CANCEL_GRACE_SECONDS = float(os.environ.get("GENERATION_CANCEL_GRACE_SECONDS", "2.0"))
generation_tasks: dict[int, asyncio.Task] = {}
cancelled_generation_ids: set[int] = set()

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ai_settings.json")

def load_settings() -> dict:
    default_settings = {
        "meaning_limit": "Curto (até 10 palavras)",
        "explanation_style": "Padrão (até 2 frases)",
        "examples_count": 3,
        "tone_focus": "Geral"
    }
    if not os.path.exists(SETTINGS_FILE):
        return default_settings
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default_settings
        
def save_settings(settings: dict):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Erro ao salvar configurações: {e}")

class ReviewRequest(BaseModel):
    action: str  # "difficult", "medium", "easy", "master"

async def generate_ai_content(term_id: int, term: str) -> str | None:
    # Carrega preferências personalizadas de IA
    settings = load_settings()
    meaning_limit = settings.get("meaning_limit", "Curto (até 10 palavras)")
    explanation_style = settings.get("explanation_style", "Padrão (até 2 frases)")
    examples_count = settings.get("examples_count", 3)
    tone_focus = settings.get("tone_focus", "Geral")

    await asyncio.sleep(GENERATION_CANCEL_GRACE_SECONDS)
    if term_id in cancelled_generation_ids:
        return None

    if not client:
        # Fallback de demonstração simulado caso a chave não esteja no .env
        mock_examples = [
            {"en": f"Example sentence {i+1} using '{term}'.", "pt": f"Frase de exemplo {i+1} usando '{term}'."}
            for i in range(examples_count)
        ]
        mock_content = {
            "translation": f"Tradução de '{term}'",
            "meaning": f"Significado de '{term}' (Formato: {meaning_limit}).",
            "explanation": f"Explicação de '{term}' (Estilo: {explanation_style}).",
            "examples": mock_examples,
            "tip": f"Dica rápida focada em: {tone_focus}."
        }
        return json.dumps(mock_content)

    try:
        # Chamada com validação de JSON no SDK da OpenAI (gpt-5-nano)
        response = await client.beta.chat.completions.parse(
            model=openai_model,
            messages=[
                {
                    "role": "system",
                    "content": "Você é um professor de inglês especialista. Forneça explicações de termos para revisão rápida em formato JSON, seguindo estritamente as preferências de detalhamento do usuário."
                },
                {
                    "role": "user",
                    "content": f"""
                    Analise o seguinte termo (palavra ou expressão) em inglês: "{term}"
                    Gere uma explicação estruturada contendo:
                    1. A tradução direta do termo para o português (campo "translation" - exemplo: "pillow" -> "almofada", "duvet" -> "edredom"). Deve ser apenas a tradução direta e concisa.
                    2. O significado principal em português (campo "meaning" - tamanho/limite: {meaning_limit}).
                    3. Uma explicação curta (campo "explanation" - estilo: {explanation_style}).
                    4. Exatamente {examples_count} exemplos práticos de frases reais em inglês contendo o termo, seguidos da tradução em português de cada frase (campo "examples" - cada item contendo a frase em inglês "en" e tradução em português "pt").
                    5. Uma dica rápida de memorização ou pronúncia (campo "tip" - com foco / tom: {tone_focus}).
                    
                    As explicações do significado, explicação e dica devem ser em português brasileiro.
                    Não inclua campos extras ou explicações acadêmicas longas. O objetivo é leitura rápida.
                    """
                }
            ],
            response_format=schemas.GeneratedContent
        )
        parsed_object = response.choices[0].message.parsed
        if not parsed_object:
            raise ValueError("O modelo não retornou um conteúdo estruturado válido.")
        
        if term_id in cancelled_generation_ids:
            return None

        return parsed_object.model_dump_json()
    except asyncio.CancelledError:
        return None
    except Exception as e:
        # Fallback em caso de erros de rede ou cotas da API
        error_content = {
            "translation": f"Erro '{term}'",
            "meaning": f"Erro na IA para '{term}'.",
            "explanation": f"Houve uma falha na chamada ou processamento da API da OpenAI ({openai_model}).",
            "examples": [
                {"en": f"Error loading example: {str(e)}", "pt": "Erro ao carregar tradução."}
            ],
            "tip": "Verifique suas credenciais e conexão de rede."
        }
        return json.dumps(error_content)

# Tarefa assíncrona executada em segundo plano
async def cancel_generation_task(term_id: int):
    cancelled_generation_ids.add(term_id)
    task = generation_tasks.get(term_id)
    if not task:
        cancelled_generation_ids.discard(term_id)
        return
    if task.done():
        generation_tasks.pop(term_id, None)
        cancelled_generation_ids.discard(term_id)
        return
    task.cancel()
    try:
        await asyncio.wait_for(task, timeout=2)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        pass

async def async_generate_content_task(term_id: int, term_text: str):
    db = SessionLocal()
    try:
        # Gera o conteúdo estruturado usando a API da OpenAI
        generated_json = await generate_ai_content(term_id, term_text)
        if not generated_json or term_id in cancelled_generation_ids:
            return
        
        # Atualiza o termo no banco de dados
        db_term = db.query(models.Term).filter(models.Term.id == term_id).first()
        if db_term and term_id not in cancelled_generation_ids:
            db_term.generated_content = generated_json
            db.commit()
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"Erro na tarefa assíncrona: {e}")
    finally:
        generation_tasks.pop(term_id, None)
        cancelled_generation_ids.discard(term_id)
        db.close()

@router.get("/stats", response_model=schemas.ReviewStats)
def get_stats(db: Session = Depends(get_db)):
    return crud.get_review_stats(db)

@router.get("/pending", response_model=List[schemas.TermResponse])
def read_pending_reviews(db: Session = Depends(get_db)):
    return crud.get_pending_reviews(db)

@router.get("/active", response_model=List[schemas.TermResponse])
def read_active_terms(db: Session = Depends(get_db)):
    return crud.get_active_terms(db)

@router.get("/mastered/{term_type}", response_model=List[schemas.TermResponse])
def read_mastered_terms(term_type: str, db: Session = Depends(get_db)):
    if term_type not in ["word", "expression"]:
        raise HTTPException(status_code=400, detail="Tipo inválido. Deve ser 'word' ou 'expression'.")
    return crud.get_mastered_terms(db, term_type=term_type)

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
        
    # Verifica duplicatas
    db_term = crud.get_term_by_text(db, text=term_text)
    if db_term:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"O termo '{term_text}' já existe no seu banco de dados."
        )
    
    # Identifica se é palavra ou expressão com base na quantidade de palavras
    words_count = len(term_text.split())
    term_type = "word" if words_count == 1 else "expression"
    
    # Salva imediatamente no banco de dados com conteúdo vazio (placeholder)
    new_term = crud.create_term(
        db=db, 
        text=term_text, 
        term_type=term_type
    )
    
    # Agenda a chamada da IA como tarefa cancelavel em segundo plano
    generation_tasks[new_term.id] = asyncio.create_task(
        async_generate_content_task(new_term.id, term_text)
    )
    
    return new_term

@router.post("/{term_id}/cancel", response_model=schemas.TermResponse)
async def cancel_term_generation(term_id: int, db: Session = Depends(get_db)):
    db_term = crud.get_term(db, term_id)
    if not db_term:
        raise HTTPException(status_code=404, detail="Termo não encontrado")

    await cancel_generation_task(term_id)
    db.delete(db_term)
    db.commit()
    return db_term

@router.post("/{term_id}/review", response_model=schemas.TermResponse)
def review_term(term_id: int, payload: ReviewRequest, db: Session = Depends(get_db)):
    db_term = crud.get_term(db, term_id)
    if not db_term:
        raise HTTPException(status_code=404, detail="Termo não encontrado")
        
    action = payload.action.lower()
    
    if action == "master":
        if db_term.difficulty_level != "Easy":
            raise HTTPException(
                status_code=400, 
                detail="Apenas termos classificados como 'Fácil' (Easy) podem ser marcados como dominados."
            )
        return crud.master_term(db, term_id)
        
    elif action == "difficult":
        # Difícil: Revisar em 5 minutos
        next_review = datetime.utcnow() + timedelta(minutes=5)
        return crud.update_term_review(db, term_id, difficulty="Difficult", next_review_date=next_review)
        
    elif action == "medium":
        # Médio: Revisar em 1 hora
        next_review = datetime.utcnow() + timedelta(hours=1)
        return crud.update_term_review(db, term_id, difficulty="Medium", next_review_date=next_review)
        
    elif action == "easy":
        # Fácil: Revisar em 1 dia
        next_review = datetime.utcnow() + timedelta(days=1)
        return crud.update_term_review(db, term_id, difficulty="Easy", next_review_date=next_review)
        
    else:
        raise HTTPException(status_code=400, detail="Ação inválida. Use 'difficult', 'medium', 'easy' ou 'master'.")

@router.delete("/{term_id}", response_model=schemas.TermResponse)
async def delete_term(term_id: int, db: Session = Depends(get_db)):
    db_term = crud.get_term(db, term_id)
    if not db_term:
        raise HTTPException(status_code=404, detail="Termo não encontrado")
    await cancel_generation_task(term_id)
    db.delete(db_term)
    db.commit()
    return db_term

@router.get("/settings/ai", response_model=schemas.AISettings)
def get_ai_settings():
    return load_settings()
    
@router.put("/settings/ai", response_model=schemas.AISettings)
def update_ai_settings(payload: schemas.AISettings):
    settings = payload.model_dump()
    save_settings(settings)
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
        "examples": [{"en": ex.en.strip(), "pt": ex.pt.strip()} for ex in payload.examples],
        "tip": payload.tip.strip()
    }
    db_term.generated_content = json.dumps(updated_content)
    db.commit()
    db.refresh(db_term)
    return db_term
