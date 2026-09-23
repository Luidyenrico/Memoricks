from typing import Literal
from copy import deepcopy
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, select, func
from sqlalchemy.orm import Session
from .. import crud, models, schemas
from ..database import get_db, get_write_db
from ..templates import starter_template
from ..languages import is_supported_language

router = APIRouter(tags=["Temas e subgrupos"])
STYLE_KEYS = {"font", "size", "color", "background"}


def template_structure(template):
    return {
        "fields": [
            {key: value for key, value in field.items() if key not in STYLE_KEYS}
            for field in template["fields"]
        ]
    }


def propagate_styles(db, subgroup, template):
    styles = {
        field["id"]: {key: field.get(key) for key in STYLE_KEYS}
        for field in template["fields"]
    }
    for card in db.scalars(
        select(models.Card).where(models.Card.subgroup_id == subgroup.id)
    ):
        updated = deepcopy(card.template)
        for field in updated["fields"]:
            if field["id"] in styles:
                field.update(styles[field["id"]])
        if updated != card.template:
            card.template = updated
            card.version += 1


@router.get("/review-shortcuts")
def review_shortcuts(db: Session = Depends(get_db)):
    stats = crud.stats_by_subgroup(db)
    available = dict(
        db.execute(
            select(models.Card.subgroup_id, func.count(models.Card.id))
            .where(
                models.Card.mastered.is_(False), models.Card.needs_attention.is_(False),
                crud.owner_condition(db, models.Card)
            )
            .group_by(models.Card.subgroup_id)
        ).all()
    )
    candidates = []
    for subgroup, group in db.execute(
        select(models.Subgroup, models.Group).join(
            models.Group, models.Group.id == models.Subgroup.group_id
        )
    ):
        if not available.get(subgroup.id):
            continue
        candidates.append(
            {
                "id": subgroup.id,
                "title": subgroup.title,
                "group_title": group.title,
                "color": group.color,
                "stats": stats[subgroup.id],
            }
        )
    candidates.sort(
        key=lambda item: (
            -int(item["stats"]["pending"] > 0),
            -item["stats"]["total"],
            -item["stats"]["pending"],
            item["id"],
        )
    )
    return candidates[:6]


@router.get("/templates")
def templates(language: str = "en", db: Session = Depends(get_db)):
    if not is_supported_language(language):
        raise HTTPException(400, "Idioma não suportado.")
    native = crud.get_or_create_profile(db).native_language
    return [
        {
            "id": kind,
            "title": title,
            "template": starter_template(kind, language, native),
        }
        for kind, title in [
            ("general", "Geral"),
            ("languages", "Idiomas"),
            ("python", "Python"),
        ]
    ]


@router.get("/groups")
def list_groups(db: Session = Depends(get_db)):
    groups = db.scalars(select(models.Group).order_by(models.Group.id)).all()
    children = db.scalars(select(models.Subgroup)).all()
    stats = crud.stats_by_subgroup(db)
    return [crud.group_data(group, children, stats) for group in groups]


@router.post("/groups", status_code=201)
def create_group(payload: schemas.GroupInput, db: Session = Depends(get_write_db)):
    group = models.Group(**payload.model_dump(), user_id=db.info.get("user_id"))
    db.add(group)
    crud.commit(db)
    db.refresh(group)
    return crud.group_data(group, [], {})


@router.get("/groups/{group_id}")
def read_group(group_id: int, db: Session = Depends(get_db)):
    group = crud.get_or_404(db, models.Group, group_id)
    children = db.scalars(
        select(models.Subgroup)
        .where(models.Subgroup.group_id == group_id)
        .order_by(models.Subgroup.id)
    ).all()
    stats = crud.stats_by_subgroup(db)
    return {
        **crud.group_data(group, children, stats),
        "subgroups": [crud.subgroup_data(child, stats) for child in children],
    }


@router.put("/groups/{group_id}")
def edit_group(
    group_id: int, payload: schemas.GroupUpdate, db: Session = Depends(get_write_db)
):
    crud.get_or_404(db, models.Group, group_id)
    crud.update_versioned(
        db,
        models.Group,
        group_id,
        payload.version,
        payload.model_dump(exclude={"version"}),
    )
    return read_group(group_id, db)


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(
    group_id: int, version: int = Query(ge=1), db: Session = Depends(get_write_db)
):
    crud.get_or_404(db, models.Group, group_id)
    if db.scalar(
        select(models.Subgroup.id).where(models.Subgroup.group_id == group_id).limit(1)
    ):
        raise HTTPException(
            409,
            "Exclua os subgrupos vazios primeiro. Temas com conteúdo são preservados.",
        )
    _delete_versioned(db, models.Group, group_id, version)
    return Response(status_code=204)


@router.post("/groups/{group_id}/subgroups", status_code=201)
def create_subgroup(
    group_id: int, payload: schemas.SubgroupInput, db: Session = Depends(get_write_db)
):
    crud.get_or_404(db, models.Group, group_id)
    subgroup = models.Subgroup(group_id=group_id, **payload.model_dump())
    db.add(subgroup)
    crud.commit(db)
    db.refresh(subgroup)
    return crud.subgroup_data(subgroup, {})


@router.get("/subgroups/{subgroup_id}")
def read_subgroup(subgroup_id: int, db: Session = Depends(get_db)):
    subgroup = crud.get_or_404(db, models.Subgroup, subgroup_id)
    group = crud.get_or_404(db, models.Group, subgroup.group_id)
    return {
        **crud.subgroup_data(subgroup, crud.stats_by_subgroup(db)),
        "group": crud.group_fields(group),
    }


@router.put("/subgroups/{subgroup_id}")
def edit_subgroup(
    subgroup_id: int,
    payload: schemas.SubgroupUpdate,
    db: Session = Depends(get_write_db),
):
    subgroup = crud.get_or_404(db, models.Subgroup, subgroup_id)
    changes = payload.model_dump(exclude={"version"})
    if template_structure(changes["template"]) != template_structure(subgroup.template):
        changes["template_version"] = subgroup.template_version + 1
    # Stage card updates in the same transaction: a stale subgroup save rolls back all styles.
    propagate_styles(db, subgroup, changes["template"])
    crud.update_versioned(db, models.Subgroup, subgroup_id, payload.version, changes)
    return read_subgroup(subgroup_id, db)


@router.delete("/subgroups/{subgroup_id}", status_code=204)
def delete_subgroup(
    subgroup_id: int, version: int = Query(ge=1), db: Session = Depends(get_write_db)
):
    crud.get_or_404(db, models.Subgroup, subgroup_id)
    if db.scalar(
        select(models.Card.id).where(models.Card.subgroup_id == subgroup_id).limit(1)
    ):
        raise HTTPException(
            409, "Este subgrupo ainda contém cards. Exclua os cards primeiro."
        )
    _delete_versioned(db, models.Subgroup, subgroup_id, version)
    return Response(status_code=204)


def _delete_versioned(db, model, item_id, version):
    result = db.execute(
        delete(model).where(model.id == item_id, model.version == version, crud.owner_condition(db, model))
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Este item foi alterado. Recarregue antes de excluir.")
    crud.commit(db)
