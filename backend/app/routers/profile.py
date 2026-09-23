from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, schemas
from ..database import get_db, get_write_db
from ..languages import SUPPORTED_LANGUAGES, is_supported_language

router = APIRouter(prefix="/profile", tags=["Perfil"])


@router.get("/languages")
def read_languages():
    return [{"code": code, "name": name} for code, name in SUPPORTED_LANGUAGES.items()]


@router.get("", response_model=schemas.ProfileResponse)
def read_profile(db: Session = Depends(get_db)):
    return crud.get_or_create_profile(db)


@router.put("", response_model=schemas.ProfileResponse)
def update_profile(payload: schemas.ProfileUpdate, db: Session = Depends(get_write_db)):
    if not is_supported_language(payload.native_language):
        raise HTTPException(400, "Idioma não suportado.")
    profile = crud.get_or_create_profile(db)
    profile.native_language = payload.native_language
    db.commit()
    db.refresh(profile)
    return profile
