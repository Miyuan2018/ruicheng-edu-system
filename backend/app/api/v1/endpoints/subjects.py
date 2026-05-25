"""Subject management API — SYS_ADMIN only."""
import uuid, json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.subject import Subject
from app.core.security import get_current_user, require_role

router = APIRouter()


@router.get("")
async def list_subjects(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.is_active == True).order_by(Subject.name))
    return [{"id": str(s.id), "name": s.name, "category": s.category} for s in result.scalars().all()]


@router.get("/all")
async def list_all_subjects(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Including inactive, for admin management."""
    result = await db.execute(select(Subject).order_by(Subject.name))
    return [{"id": str(s.id), "name": s.name, "category": s.category, "is_active": s.is_active} for s in result.scalars().all()]


@router.post("")
async def create_subject(name: str, category: str = None, current_user=Depends(require_role("SYS_ADMIN")), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Subject).where(Subject.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(400, detail="学科已存在")
    s = Subject(name=name, category=category)
    db.add(s); await db.commit(); await db.refresh(s)
    return {"id": str(s.id), "name": s.name, "category": s.category}


@router.get("/my")
async def get_my_subjects(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get subjects for current user. QUESTION_ADMIN gets all, teacher gets assigned."""
    if current_user.user_type in ("SYS_ADMIN",):
        result = await db.execute(select(Subject).where(Subject.is_active == True).order_by(Subject.name))
        return [s.name for s in result.scalars().all()]
    if current_user.user_type == "QUESTION_ADMIN":
        result = await db.execute(select(Subject).where(Subject.is_active == True).order_by(Subject.name))
        return [s.name for s in result.scalars().all()]
    if current_user.user_type == "TEACHER":
        from app.models.admin import Admin
        r = await db.execute(select(Admin).where(Admin.id == uuid.UUID(current_user.id)))
        admin = r.scalar_one_or_none()
        if admin and admin.subjects:
            subjs = admin.subjects if isinstance(admin.subjects, list) else json.loads(admin.subjects) if isinstance(admin.subjects, str) else []
            if "ALL" in subjs:
                result = await db.execute(select(Subject).where(Subject.is_active == True).order_by(Subject.name))
                return [s.name for s in result.scalars().all()]
            return subjs
    return []

@router.put("/{subject_id}")
async def update_subject(subject_id: uuid.UUID, name: str = None, category: str = None, is_active: bool = None, current_user=Depends(require_role("SYS_ADMIN")), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Subject).where(Subject.id == subject_id))
    s = r.scalar_one_or_none()
    if not s: raise HTTPException(404, detail="学科不存在")
    if name and name != s.name:
        dup = await db.execute(select(Subject).where(Subject.name == name))
        if dup.scalar_one_or_none():
            raise HTTPException(400, detail=f"学科「{name}」已存在，不能重复添加")
    if name: s.name = name
    if category is not None: s.category = category
    if is_active is not None: s.is_active = is_active
    await db.commit()
    return {"id": str(s.id), "name": s.name, "category": s.category, "is_active": s.is_active}


@router.delete("/{subject_id}")
async def delete_subject(subject_id: uuid.UUID, current_user=Depends(require_role("SYS_ADMIN")), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Subject).where(Subject.id == subject_id))
    s = r.scalar_one_or_none()
    if not s: raise HTTPException(404, detail="学科不存在")
    s.is_active = False  # soft delete
    await db.commit()
    return {"message": "已停用"}


