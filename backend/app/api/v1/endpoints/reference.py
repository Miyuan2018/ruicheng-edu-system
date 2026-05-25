"""Reference data API — public read, SYS_ADMIN write."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import get_current_user, require_role
from app.models.reference import (
    QuestionType, DifficultyLevel, GradeLevel,
    PaperStatus, ErrorType, QuestionSource, Province,
)
from app.models.subject import Subject

router = APIRouter()

MODEL_MAP = {
    "question-types": (QuestionType, ("id", "code", "name", "color", "sort_order", "is_active")),
    "difficulty-levels": (DifficultyLevel, ("id", "code", "name", "color", "sort_order", "is_active")),
    "grade-levels": (GradeLevel, ("id", "code", "name", "sort_order", "is_active")),
    "paper-statuses": (PaperStatus, ("id", "code", "name", "is_active")),
    "error-types": (ErrorType, ("id", "code", "name", "is_active")),
    "question-sources": (QuestionSource, ("id", "code", "name", "color", "is_active")),
    "provinces": (Province, ("id", "code", "name", "sort_order", "is_active")),
    "subjects": (Subject, ("id", "code", "name", "category", "is_active")),
}


def _serialize(records, fields):
    return [{f: str(getattr(r, f)) if f == "id" else getattr(r, f)
             for f in fields if getattr(r, f) is not None} for r in records]


@router.get("/all")
async def get_all_reference_data(db: AsyncSession = Depends(get_db)):
    """Return all reference data in a single request (public)."""
    result = {}
    for key, (model_cls, fields) in MODEL_MAP.items():
        order_col = model_cls.sort_order if hasattr(model_cls, "sort_order") else model_cls.id
        rows = await db.execute(
            select(model_cls).where(model_cls.is_active == True).order_by(order_col)
        )
        result[key] = _serialize(rows.scalars().all(), fields)
    return result


# ─── Per-table list (public) ───

def _make_list_endpoint(key, model_cls, fields):
    async def handler(db: AsyncSession = Depends(get_db)):
        order_col = model_cls.sort_order if hasattr(model_cls, "sort_order") else model_cls.id
        rows = await db.execute(
            select(model_cls).where(model_cls.is_active == True).order_by(order_col)
        )
        return _serialize(rows.scalars().all(), fields)
    return handler


for key, (model_cls, fields) in MODEL_MAP.items():
    router.get(f"/{key}")(_make_list_endpoint(key, model_cls, fields))


# ─── CRUD (SYS_ADMIN only) — per-table create/update/delete ───

def _make_create_endpoint(key, model_cls, fields):
    async def handler(
        code: str = Query(...), name: str = Query(...),
        color: str = Query(None), sort_order: int = Query(0),
        current_user=Depends(require_role("SYS_ADMIN")),
        db: AsyncSession = Depends(get_db),
    ):
        existing = await db.execute(select(model_cls).where(model_cls.code == code))
        if existing.scalar_one_or_none():
            raise HTTPException(400, detail="code已存在")
        kwargs = {"id": uuid.uuid4(), "code": code, "name": name}
        if "color" in fields: kwargs["color"] = color
        if "sort_order" in fields: kwargs["sort_order"] = sort_order
        obj = model_cls(**kwargs)
        db.add(obj); await db.commit(); await db.refresh(obj)
        return _serialize([obj], fields)[0]
    return handler


def _make_update_endpoint(key, model_cls, fields):
    async def handler(
        item_id: uuid.UUID,
        name: str = Query(None), color: str = Query(None),
        sort_order: int = Query(None), is_active: bool = Query(None),
        current_user=Depends(require_role("SYS_ADMIN")),
        db: AsyncSession = Depends(get_db),
    ):
        r = await db.execute(select(model_cls).where(model_cls.id == item_id))
        obj = r.scalar_one_or_none()
        if not obj: raise HTTPException(404)
        if name is not None: obj.name = name
        if "color" in fields and color is not None: obj.color = color
        if "sort_order" in fields and sort_order is not None: obj.sort_order = sort_order
        if is_active is not None: obj.is_active = is_active
        await db.commit()
        return _serialize([obj], fields)[0]
    return handler


def _make_delete_endpoint(key, model_cls, fields):
    async def handler(
        item_id: uuid.UUID,
        current_user=Depends(require_role("SYS_ADMIN")),
        db: AsyncSession = Depends(get_db),
    ):
        r = await db.execute(select(model_cls).where(model_cls.id == item_id))
        obj = r.scalar_one_or_none()
        if not obj: raise HTTPException(404)
        obj.is_active = False
        await db.commit()
        return {"message": "已停用"}
    return handler


for key, (model_cls, fields) in MODEL_MAP.items():
    router.post(f"/{key}")(_make_create_endpoint(key, model_cls, fields))
    router.put(f"/{key}/{{item_id}}")(_make_update_endpoint(key, model_cls, fields))
    router.delete(f"/{key}/{{item_id}}")(_make_delete_endpoint(key, model_cls, fields))
