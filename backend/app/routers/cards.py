from copy import deepcopy
from datetime import timedelta
from typing import Literal
import hashlib
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..content import normalize_term
from ..database import get_db, get_write_db
from ..dates import utc_now
from ..generation import ContentGenerationError, GenerationRateLimit, generate_card, plan_cards
from ..languages import language_name
from ..templates import validate_values
from .collections import _delete_versioned

router = APIRouter(tags=["Cards"])


def validated(template, values):
    try:
        return validate_values(template, values)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


def template_is_current(subgroup, version):
    if version != subgroup.template_version:
        raise HTTPException(
            409,
            "O modelo deste subgrupo mudou. Reabra o editor para usar os campos atuais.",
        )


@router.get("/subgroups/{subgroup_id}/cards")
def list_cards(
    subgroup_id: int,
    status: Literal["active", "mastered", "pending", "all"] = "active",
    q: str = Query(default="", max_length=5000),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    crud.get_or_404(db, models.Subgroup, subgroup_id)
    card = models.Card
    conditions = [card.subgroup_id == subgroup_id]
    if status == "mastered":
        conditions.append(card.mastered.is_(True))
    elif status != "all":
        conditions.append(card.mastered.is_(False))
    if status == "pending":
        conditions += [
            card.next_review_date <= utc_now(),
            card.needs_attention.is_(False),
        ]
    if q.strip():
        conditions.append(
            card.input_key.contains(normalize_term(q).casefold(), autoescape=True)
        )
    count = db.scalar(select(func.count()).select_from(card).where(*conditions))
    order = (
        card.next_review_date.asc() if status == "pending" else card.created_at.desc()
    )
    items = db.scalars(
        select(card)
        .where(*conditions)
        .order_by(order, card.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return {
        "items": [schemas.CardResponse.model_validate(item) for item in items],
        "total": count,
    }


@router.post("/subgroups/{subgroup_id}/generate")
async def generate_preview(
    subgroup_id: int, payload: schemas.GenerationInput, db: Session = Depends(get_db)
):
    subgroup = crud.get_or_404(db, models.Subgroup, subgroup_id)
    group = crud.get_or_404(db, models.Group, subgroup.group_id)
    profile = crud.get_or_create_profile(db)
    context = {
        key: deepcopy(getattr(subgroup, key))
        for key in ("title", "description", "context", "template")
    }
    group_context = crud.group_fields(group)
    common_context = getattr(payload, "common_context", "")
    if common_context:
        context["context"] += "\nContexto do material enviado: " + common_context
    version, group_version, template_version = (
        subgroup.version,
        group.version,
        subgroup.template_version,
    )
    group_id, native = group.id, language_name(profile.native_language)
    # Release the read transaction while waiting on the provider.
    db.rollback()
    try:
        values, source = await generate_card(
            payload.text, group_context, context, native
        )
    except GenerationRateLimit as error:
        raise HTTPException(429, {"message": str(error), "retry_after": error.retry_after}) from error
    except ContentGenerationError as error:
        raise HTTPException(502, str(error)) from error
    subgroup = crud.get_or_404(db, models.Subgroup, subgroup_id)
    group = crud.get_or_404(db, models.Group, group_id)
    if subgroup.version != version or group.version != group_version:
        raise HTTPException(
            409,
            "O contexto ou modelo mudou durante a geração. Gere novamente para usar as configurações atuais.",
        )
    return {
        "text": payload.text,
        "values": values,
        "template": context["template"],
        "template_version": template_version,
        "source": source,
    }


@router.post("/subgroups/{subgroup_id}/batch-plan")
async def batch_plan(subgroup_id: int, payload: schemas.BatchPlanInput, db: Session = Depends(get_db)):
    subgroup = crud.get_or_404(db, models.Subgroup, subgroup_id)
    group = crud.get_or_404(db, models.Group, subgroup.group_id)
    versions = {"subgroup_version": subgroup.version, "group_version": group.version}
    db.rollback()
    try:
        plan = await plan_cards(payload.text)
    except GenerationRateLimit as error:
        raise HTTPException(429, {"message": str(error), "retry_after": error.retry_after}) from error
    except ContentGenerationError as error:
        raise HTTPException(502, str(error)) from error
    return {**plan, **versions}


@router.post("/subgroups/{subgroup_id}/batch-generate")
async def batch_generate(subgroup_id: int, payload: schemas.BatchGenerationInput, db: Session = Depends(get_db)):
    subgroup = crud.get_or_404(db, models.Subgroup, subgroup_id)
    group = crud.get_or_404(db, models.Group, subgroup.group_id)
    if subgroup.version != payload.subgroup_version or group.version != payload.group_version:
        raise HTTPException(409, "O contexto ou modelo mudou. Salve as prévias compatíveis ou inicie uma nova fila com o contexto atual.")
    return await generate_preview(subgroup_id, payload, db)


@router.post("/subgroups/{subgroup_id}/cards/batch", status_code=201)
def save_batch(subgroup_id: int, payload: schemas.BatchSaveInput, db: Session = Depends(get_write_db)):
    digest = hashlib.sha256(json.dumps({"subgroup": subgroup_id, "cards": [c.model_dump() for c in payload.cards]}, sort_keys=True).encode()).hexdigest()
    receipt_id = hashlib.sha256(f"{db.info.get('user_id')}:{payload.request_id}".encode()).hexdigest() if db.info.get("user_id") else payload.request_id
    receipt = db.get(models.BatchReceipt, receipt_id)
    if receipt:
        if receipt.payload_hash != digest:
            raise HTTPException(409, "Esta confirmação já foi usada para outro conteúdo. Reabra o lote.")
        saved = db.scalars(select(models.Card).where(
            models.Card.subgroup_id == subgroup_id,
            models.Card.input_key.in_([normalize_term(c.text).casefold() for c in payload.cards]),
        )).all()
        return {"count": receipt.count, "cards": [schemas.CardResponse.model_validate(c) for c in saved]}
    subgroup = crud.get_or_404(db, models.Subgroup, subgroup_id)
    keys = set()
    prepared = []
    for index, draft in enumerate(payload.cards, 1):
        template_is_current(subgroup, draft.template_version)
        key = normalize_term(draft.text).casefold()
        if key in keys or db.scalar(select(models.Card.id).where(models.Card.subgroup_id == subgroup_id, models.Card.input_key == key)):
            raise HTTPException(409, f"Card {index}: entrada repetida neste lote ou já existente no subgrupo. Edite ou remova a prévia. Nenhum card do lote foi salvo.")
        keys.add(key)
        prepared.append(models.Card(subgroup_id=subgroup_id, text=draft.text, input_key=key,
            values=validated(subgroup.template, draft.values), template=deepcopy(subgroup.template),
            template_version=draft.template_version, source=draft.source))
    db.add_all(prepared)
    db.add(models.BatchReceipt(request_id=receipt_id, payload_hash=digest, count=len(prepared)))
    crud.commit(db)
    return {"count": len(prepared), "cards": [schemas.CardResponse.model_validate(c) for c in prepared]}


@router.post(
    "/subgroups/{subgroup_id}/cards",
    response_model=schemas.CardResponse,
    status_code=201,
)
def create_card(
    subgroup_id: int, payload: schemas.CardInput, db: Session = Depends(get_write_db)
):
    subgroup = crud.get_or_404(db, models.Subgroup, subgroup_id)
    template_is_current(subgroup, payload.template_version)
    card = models.Card(
        subgroup_id=subgroup_id,
        text=payload.text,
        input_key=normalize_term(payload.text).casefold(),
        values=validated(subgroup.template, payload.values),
        template=deepcopy(subgroup.template),
        template_version=subgroup.template_version,
        source=payload.source,
    )
    db.add(card)
    crud.commit(db)
    db.refresh(card)
    return card


@router.get("/cards/{card_id}", response_model=schemas.CardResponse)
def read_card(card_id: int, db: Session = Depends(get_db)):
    return crud.get_or_404(db, models.Card, card_id)


@router.get("/cards/{card_id}/upgrade")
def upgrade_preview(card_id: int, db: Session = Depends(get_db)):
    card = crud.get_or_404(db, models.Card, card_id)
    subgroup = crud.get_or_404(db, models.Subgroup, card.subgroup_id)
    keys = {field["id"] for field in subgroup.template["fields"]}
    return {
        "text": card.text,
        "template": subgroup.template,
        "template_version": subgroup.template_version,
        "values": {key: card.values.get(key, "") for key in keys},
        "source": "manual",
        "removed_fields": [
            field["label"]
            for field in card.template["fields"]
            if field["id"] not in keys
        ],
    }


@router.put("/cards/{card_id}", response_model=schemas.CardResponse)
def edit_card(
    card_id: int, payload: schemas.CardUpdate, db: Session = Depends(get_write_db)
):
    card = crud.get_or_404(db, models.Card, card_id)
    subgroup = crud.get_or_404(db, models.Subgroup, card.subgroup_id)
    if payload.use_current_template:
        template_is_current(subgroup, payload.template_version)
        template = deepcopy(subgroup.template)
    else:
        if payload.template_version != card.template_version:
            raise HTTPException(409, "O modelo do card mudou. Reabra o editor.")
        template = card.template
    changes = {
        "text": payload.text,
        "input_key": normalize_term(payload.text).casefold(),
        "values": validated(template, payload.values),
        "template": template,
        "template_version": payload.template_version,
        "source": payload.source,
        "needs_attention": False,
    }
    return crud.update_versioned(db, models.Card, card_id, payload.version, changes)


@router.post("/cards/{card_id}/review", response_model=schemas.CardResponse)
def review_card(
    card_id: int, payload: schemas.ReviewInput, db: Session = Depends(get_write_db)
):
    card = crud.get_or_404(db, models.Card, card_id)
    if card.mastered:
        raise HTTPException(409, "Este card já está nos aprendidos.")
    if card.needs_attention:
        raise HTTPException(409, "Complete os campos deste card antes de revisar.")
    now = utc_now()
    if payload.action == "master":
        if card.difficulty_level != "Easy":
            raise HTTPException(
                400,
                "Marque o card como Fácil em uma revisão anterior antes de dominar.",
            )
        changes = {"mastered": True, "mastered_at": now}
    else:
        label, seconds = {
            "difficult": ("Difficult", 300),
            "medium": ("Medium", 3600),
            "easy": ("Easy", 86400),
        }[payload.action]
        changes = {
            "difficulty_level": label,
            "next_review_date": now + timedelta(seconds=seconds),
        }
    return crud.update_versioned(db, models.Card, card_id, payload.version, changes)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(
    card_id: int, version: int = Query(ge=1), db: Session = Depends(get_write_db)
):
    crud.get_or_404(db, models.Card, card_id)
    _delete_versioned(db, models.Card, card_id, version)
    return Response(status_code=204)
