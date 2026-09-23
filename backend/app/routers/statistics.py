"""Read-only statistics derived from the dates already stored on current cards."""

from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import crud, models
from ..database import get_db
from ..dates import utc_now

router = APIRouter(tags=["Estatísticas"])


def total_stats(items):
    return crud.summarize(
        {key: sum(item[key] for item in items) for key in ("total", "learned", "pending", "attention", "reviewable")}
    )


@router.get("/statistics")
def statistics(
    days: str = Query(default="30"),
    group_id: int | None = Query(default=None, ge=1),
    subgroup_id: int | None = Query(default=None, ge=1),
    utc_offset_minutes: int = Query(default=0, ge=-840, le=840),
    db: Session = Depends(get_db),
):
    if days not in ("7", "30", "90", "365", "all"):
        raise HTTPException(422, "Escolha 7, 30, 90 ou 365 dias, ou Desde o início.")
    groups = db.scalars(select(models.Group).order_by(models.Group.title)).all()
    subgroups = db.scalars(select(models.Subgroup).order_by(models.Subgroup.title)).all()
    groups_by_id = {group.id: group for group in groups}
    subgroups_by_id = {subgroup.id: subgroup for subgroup in subgroups}
    if group_id is not None and group_id not in groups_by_id:
        raise HTTPException(404, "Grupo não encontrado.")
    if subgroup_id is not None:
        subgroup = subgroups_by_id.get(subgroup_id)
        if subgroup is None:
            raise HTTPException(404, "Subgrupo não encontrado.")
        if group_id is not None and subgroup.group_id != group_id:
            raise HTTPException(400, "Este subgrupo não pertence ao grupo selecionado.")
        group_id = subgroup.group_id

    stats = crud.stats_by_subgroup(db)
    group_rows = []
    for group in groups:
        children = [
            {"id": child.id, "title": child.title, "stats": stats.get(child.id, crud.summarize())}
            for child in subgroups if child.group_id == group.id
        ]
        group_rows.append({
            "id": group.id,
            "title": group.title,
            "color": group.color,
            "stats": total_stats([child["stats"] for child in children]),
            "subgroups": children,
        })

    selected = [
        child for child in subgroups
        if (group_id is None or child.group_id == group_id)
        and (subgroup_id is None or child.id == subgroup_id)
    ]
    selected_ids = [child.id for child in selected]
    summary = total_stats([stats.get(child.id, crud.summarize()) for child in selected])
    distribution = (
        [{"id": group["id"], "title": group["title"], "color": group["color"], "stats": group["stats"]}
         for group in group_rows]
        if group_id is None else
        [{"id": child.id, "title": child.title, "color": groups_by_id[child.group_id].color,
          "stats": stats.get(child.id, crud.summarize())} for child in selected]
    )

    offset = timedelta(minutes=utc_offset_minutes)
    today = (utc_now() + offset).date()
    if days == "all":
        # The library's first card is the starting point, regardless of the
        # selected group. Only existing cards have a retained creation date.
        first_created = db.scalar(select(func.min(models.Card.created_at)).where(crud.owner_condition(db, models.Card)))
        start = min(today, (first_created + offset).date()) if first_created else today
        day_count = (today - start).days + 1
    else:
        day_count = int(days)
        start = today - timedelta(days=day_count - 1)
    created = Counter()
    learned = Counter()
    learned_before = 0
    learned_without_date = 0
    # Project only the dates and status; no card content or template is loaded.
    for card in db.execute(
        select(models.Card.created_at, models.Card.mastered, models.Card.mastered_at)
        .where(models.Card.subgroup_id.in_(selected_ids), crud.owner_condition(db, models.Card))
    ):
        created[(card.created_at + offset).date()] += 1
        if card.mastered:
            if card.mastered_at is None:
                learned_without_date += 1
            else:
                day = (card.mastered_at + offset).date()
                if day < start:
                    learned_before += 1
                learned[day] += 1

    timeline = []
    cumulative = learned_before
    for index in range(day_count):
        day = start + timedelta(days=index)
        cumulative += learned[day]
        timeline.append({
            "date": day.isoformat(), "learned": learned[day],
            "learned_total": cumulative, "created": created[day],
        })

    return {
        "summary": summary,
        "groups": group_rows,
        "distribution": distribution,
        "distribution_level": "groups" if group_id is None else "subgroups",
        "timeline": timeline,
        "period": {"days": day_count, "start": start.isoformat(), "end": today.isoformat()},
        "learned_without_date": learned_without_date,
        "review_history_available": False,
    }
