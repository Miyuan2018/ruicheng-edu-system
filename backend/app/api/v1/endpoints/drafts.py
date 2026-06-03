import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import get_current_user

logger = logging.getLogger(__name__)
from app.models.exam_paper_draft import ExamPaperDraft
from app.schemas.exam_paper_draft import DraftCreate, DraftResponse

router = APIRouter()


def _check_teacher_or_admin(user):
    if user.user_type not in ("TEACHER", "QUESTION_ADMIN"):
        raise HTTPException(403, detail="权限不足")


@router.post("", response_model=DraftResponse)
async def save_draft(
    body: DraftCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建或覆盖草稿"""
    _check_teacher_or_admin(current_user)
    if body.paper_id:
        existing = await db.execute(
            select(ExamPaperDraft).where(
                ExamPaperDraft.user_id == current_user.id,
                ExamPaperDraft.paper_id == body.paper_id,
            )
        )
    else:
        existing = await db.execute(
            select(ExamPaperDraft).where(
                ExamPaperDraft.user_id == current_user.id,
                ExamPaperDraft.paper_id.is_(None),
            ).order_by(ExamPaperDraft.updated_at.desc()).limit(1)
        )
    draft = existing.scalar()
    if draft:
        draft.data = body.data
    else:
        draft = ExamPaperDraft(
            user_id=current_user.id,
            paper_id=body.paper_id,
            data=body.data,
        )
        db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


@router.get("", response_model=list[DraftResponse])
async def list_drafts(
    paper_id: str | None = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取草稿列表"""
    _check_teacher_or_admin(current_user)
    q = select(ExamPaperDraft).where(
        ExamPaperDraft.user_id == current_user.id
    )
    if paper_id:
        q = q.where(ExamPaperDraft.paper_id == paper_id)
    result = await db.execute(
        q.order_by(ExamPaperDraft.updated_at.desc())
    )
    return result.scalars().all()


@router.delete("/{draft_id}")
async def delete_draft(
    draft_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除草稿"""
    _check_teacher_or_admin(current_user)
    try:
        # 先验证所有权
        result = await db.execute(
            select(ExamPaperDraft).where(
                ExamPaperDraft.id == draft_id,
                ExamPaperDraft.user_id == current_user.id,
            )
        )
        draft = result.scalar_one_or_none()
        if not draft:
            raise HTTPException(404, detail="草稿不存在")
        # 直接 SQL 删除，避免 ORM session 状态问题
        from sqlalchemy import delete as sa_delete
        await db.execute(sa_delete(ExamPaperDraft).where(ExamPaperDraft.id == draft_id))
        await db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f'delete_draft failed: draft_id={draft_id}')
        await db.rollback()
        raise HTTPException(500, detail=f'{type(e).__name__}: {e}')
