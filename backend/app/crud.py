"""Queries and optimistic writes shared by the API."""

from fastapi import HTTPException
from sqlalchemy import case, func, select, update
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.exc import IntegrityError
from . import models
from .dates import utc_now


def get_or_404(db, model, item_id):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(404, "Este item não foi encontrado.")
    return item


def owner_condition(db, model):
    user_id = db.info.get("user_id")
    if user_id is None:
        return True
    if model is models.Group:
        return model.user_id == user_id
    if model is models.Subgroup:
        return model.group_id.in_(
            select(models.Group.id).where(models.Group.user_id == user_id)
        )
    if model is models.Card:
        return model.subgroup_id.in_(
            select(models.Subgroup.id).join(models.Group)
            .where(models.Group.user_id == user_id)
        )
    raise ValueError("Modelo sem proprietário")


def commit(db):
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            409, "Já existe um card com essa entrada neste subgrupo."
        ) from error


def update_versioned(db, model, item_id, version, changes):
    result = db.execute(
        update(model)
        .where(model.id == item_id, model.version == version, owner_condition(db, model))
        .values(**changes, version=version + 1)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            409, "Este item foi alterado em outra janela. Recarregue antes de salvar."
        )
    commit(db)
    db.expire_all()
    return get_or_404(db, model, item_id)


def stats_by_subgroup(db):
    card = models.Card
    rows = db.execute(
        select(
            card.subgroup_id,
            func.count(card.id).label("total"),
            func.sum(case((card.mastered.is_(True), 1), else_=0)).label("learned"),
            func.sum(
                case(
                    (card.mastered.is_(False) & card.needs_attention.is_(False), 1),
                    else_=0,
                )
            ).label("reviewable"),
            func.sum(
                case(
                    (
                        (
                            card.mastered.is_(False)
                            & card.needs_attention.is_(False)
                            & (card.next_review_date <= utc_now())
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("pending"),
            func.sum(case((card.needs_attention.is_(True), 1), else_=0)).label(
                "attention"
            ),
        ).where(owner_condition(db, card)).group_by(card.subgroup_id)
    ).mappings()
    return {row["subgroup_id"]: summarize(dict(row)) for row in rows}


def summarize(counts=None):
    counts = counts or {}
    total, learned = counts.get("total", 0), counts.get("learned", 0)
    return {
        "total": total,
        "learned": learned,
        "active": total - learned,
        "pending": counts.get("pending", 0),
        "attention": counts.get("attention", 0),
        "reviewable": counts.get("reviewable", 0),
        "percent": round(100 * learned / total) if total else 0,
    }


def group_data(group, subgroups, stats):
    children = [child for child in subgroups if child.group_id == group.id]
    totals = {
        key: sum(stats.get(child.id, {}).get(key, 0) for child in children)
        for key in ("total", "learned", "pending", "attention", "reviewable")
    }
    return {
        **group_fields(group),
        "subgroup_count": len(children),
        "stats": summarize(totals),
    }


def group_fields(group):
    return {
        key: getattr(group, key)
        for key in ("id", "title", "description", "context", "color", "version")
    }


def subgroup_data(subgroup, stats):
    return {
        **{
            key: getattr(subgroup, key)
            for key in (
                "id",
                "group_id",
                "title",
                "description",
                "context",
                "template",
                "template_version",
                "version",
            )
        },
        "stats": stats.get(subgroup.id, summarize()),
    }


def get_or_create_profile(db):
    user_id = db.info.get("user_id")
    profile = (
        db.scalar(select(models.UserProfile).where(models.UserProfile.user_id == user_id))
        if user_id is not None else db.get(models.UserProfile, 1)
    )
    if profile is None:
        # /profile and /templates can be the first requests of the same account.
        # The unique owner constraint must arbitrate creation, not a prior read.
        values = {"user_id": user_id} if user_id is not None else {"id": 1}
        key = "user_id" if user_id is not None else "id"
        db.execute(insert(models.UserProfile).values(**values)
                   .on_conflict_do_nothing(index_elements=[key]))
        db.commit()
        profile = (
            db.scalar(select(models.UserProfile).where(models.UserProfile.user_id == user_id))
            if user_id is not None else db.get(models.UserProfile, 1)
        )
    return profile
