from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..languages import SUPPORTED_LANGUAGES, is_supported_language


router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("/languages", response_model=list[schemas.LanguageOption])
def read_languages():
    return [
        schemas.LanguageOption(code=code, name=name)
        for code, name in SUPPORTED_LANGUAGES.items()
    ]


@router.get("", response_model=schemas.ProfileResponse)
def read_profile(db: Session = Depends(get_db)):
    return crud.get_or_create_profile(db)


@router.put("", response_model=schemas.ProfileResponse)
def update_profile(payload: schemas.ProfileUpdate, db: Session = Depends(get_db)):
    profile = crud.get_or_create_profile(db)
    native_language = profile.native_language if payload.native_language is None else payload.native_language
    learning_language = profile.learning_language if payload.learning_language is None else payload.learning_language

    if not is_supported_language(native_language):
        raise HTTPException(status_code=400, detail="Idioma nativo não suportado.")
    if not is_supported_language(learning_language):
        raise HTTPException(status_code=400, detail="Idioma de estudo não suportado.")
    if native_language == learning_language:
        raise HTTPException(
            status_code=400,
            detail="O idioma nativo e o idioma de estudo precisam ser diferentes.",
        )

    profile.native_language = native_language
    profile.learning_language = learning_language
    if payload.learning_language is not None:
        profile.learning_language_selected = True
    db.commit()
    db.refresh(profile)
    return profile
