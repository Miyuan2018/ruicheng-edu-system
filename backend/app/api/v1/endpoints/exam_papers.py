"""
V3.5.1: Unit-based exam paper management endpoints.

Replaces the old exam_paper_questions association table with
ExamPaperUnit + ExamPaperUnitQuestion.
"""
import uuid
import json
import random
import traceback
import logging
from typing import Optional

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, cast, String, or_
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.exam_paper import ExamPaper, ExamPaperUnit, ExamPaperUnitQuestion
from app.models.question import Question
from app.models.answer_submission import AnswerSubmission
from app.models.error_notebook import ErrorNotebook
from app.models.ocr_upload import OcrUpload
from app.schemas.exam_paper import (
    ExamPaperCreate,
    ExamPaperUpdate,
    ExamPaperUnitCreate,
    ExamPaperUnitUpdate,
    UnitQuestionCreate,
    ExamPaperFullSave,
    QuestionConfigItem,
    AutoGenerateRequest,
)
from app.services.notification_service import NotificationService
from app.services.exam_paper_export import export_word, export_pdf, _normalize_options
from app.services.recommendation_engine import distribute_quotas, score_question, select_for_targets

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────

def _check_teacher_or_admin(user) -> None:
    """Raise 403 if the user is not a teacher, question admin, or sys admin."""
    if user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")


def _check_owner_or_admin(paper, user) -> None:
    """Raise 403 if the user is neither the paper creator nor an admin."""
    allowed = (
        paper.created_by == user.id
        or user.user_type in ("SYS_ADMIN", "TEACHER", "QUESTION_ADMIN")
        or user.user_type == "STUDENT"
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")


def _paper_to_dict(
    paper,
    unit_count: int = 0,
    question_count: int = 0,
    extra: Optional[dict] = None,
) -> dict:
    """Convert an ExamPaper ORM object to a response dict."""
    d = {
        "id": str(paper.id),
        "title": paper.title,
        "subtitle": paper.subtitle,
        "description": paper.description,
        "subject": paper.subject,
        "grade_level": paper.grade_level,
        "status": paper.status,
        "total_score": paper.total_score,
        "duration_minutes": paper.duration_minutes,
        "instructions": paper.instructions,
        "unit_count": unit_count,
        "question_count": question_count,
        "created_by": str(paper.created_by),
        "created_at": paper.created_at,
        "updated_at": paper.updated_at,
    }
    if extra:
        d.update(extra)
    return d


def _unit_to_dict(unit, questions: Optional[list] = None) -> dict:
    return {
        "id": str(unit.id),
        "exam_paper_id": str(unit.exam_paper_id),
        "name": unit.name,
        "description": unit.description,
        "position": unit.position,
        "time_limit_minutes": unit.time_limit_minutes,
        "question_config": unit.question_config or [],
        "total_score": unit.total_score or 0,
        "questions": questions or [],
        "created_at": unit.created_at,
        "updated_at": unit.updated_at,
    }


def _unit_question_to_dict(uq, question_data: Optional[dict] = None) -> dict:
    d = {
        "id": str(uq.id),
        "unit_id": str(uq.unit_id),
        "question_id": str(uq.question_id),
        "question_type": uq.question_type,
        "position": uq.position,
        "score": uq.score,
    }
    if question_data:
        d["question"] = question_data
    return d


async def _count_units_and_questions(db: AsyncSession, paper_ids: list) -> tuple:
    """Return (unit_count_map, question_count_map) for the given paper IDs."""
    if not paper_ids:
        return {}, {}
    # Unit counts
    uc_rows = await db.execute(
        select(
            ExamPaperUnit.exam_paper_id,
            func.count(ExamPaperUnit.id).label("cnt"),
        )
        .where(ExamPaperUnit.exam_paper_id.in_(paper_ids))
        .group_by(ExamPaperUnit.exam_paper_id)
    )
    unit_counts = {str(row[0]): row[1] for row in uc_rows.all()}

    # Question counts
    qc_rows = await db.execute(
        select(
            ExamPaperUnit.exam_paper_id,
            func.count(ExamPaperUnitQuestion.id).label("cnt"),
        )
        .select_from(ExamPaperUnitQuestion)
        .join(ExamPaperUnit, ExamPaperUnitQuestion.unit_id == ExamPaperUnit.id)
        .where(ExamPaperUnit.exam_paper_id.in_(paper_ids))
        .group_by(ExamPaperUnit.exam_paper_id)
    )
    question_counts = {str(row[0]): row[1] for row in qc_rows.all()}
    return unit_counts, question_counts


async def _auto_select_for_config(
    db: AsyncSession,
    unit_id,
    config: QuestionConfigItem,
    paper_subject: Optional[str],
    paper_grade_level: Optional[dict],
) -> list[dict]:
    """Auto-select questions for a single QuestionConfigItem.

    Returns a list of ``UnitQuestionCreate``-compatible dicts.
    """
    conditions = [
        Question.is_active == True,  # noqa: E712
        Question.review_status == "APPROVED",
        Question.question_type == config.question_type,
    ]
    if paper_subject:
        conditions.append(Question.subject == paper_subject)

    # Knowledge-point filter via structured join (soft: fall back if too restrictive)
    base_conditions = list(conditions)
    all_questions: list = []
    if config.knowledge_points:
        try:
            from app.models.knowledge_node import QuestionKnowledgeNode, KnowledgeNode

            kp_query = (
                select(Question.id)
                .join(QuestionKnowledgeNode, QuestionKnowledgeNode.question_id == Question.id)
                .join(KnowledgeNode, KnowledgeNode.id == QuestionKnowledgeNode.knowledge_node_id)
                .where(KnowledgeNode.name.in_(config.knowledge_points))
                .where(*conditions)
            )
            result = await db.execute(kp_query)
            kp_question_ids = {row[0] for row in result.fetchall()}

            if kp_question_ids:
                result = await db.execute(
                    select(Question).where(Question.id.in_(kp_question_ids))
                )
                all_questions = list(result.scalars().all())
        except ProgrammingError:
            # question_knowledge_nodes 表可能不存在，降级到基础条件
            await db.rollback()

    # Fall back to base conditions (without KP) if KP filter yields nothing
    if not config.knowledge_points or not all_questions:
        result = await db.execute(select(Question).where(*base_conditions))
        all_questions = result.scalars().all()

    if not all_questions:
        return []

    # Group by difficulty
    by_difficulty: dict[str, list] = {"EASY": [], "MEDIUM": [], "HARD": []}
    for q in all_questions:
        d = q.difficulty or "MEDIUM"
        if d in by_difficulty:
            by_difficulty[d].append(q)

    # Allocate counts per difficulty
    needed = config.count
    diff_counts: dict[str, int] = {}
    if config.difficulty_ratio:
        for diff, ratio in config.difficulty_ratio.items():
            if diff in by_difficulty:
                diff_counts[diff] = max(1, int(needed * ratio))
        total = sum(diff_counts.values())
        if total < needed:
            diff_counts["MEDIUM"] = diff_counts.get("MEDIUM", 0) + (needed - total)
        elif total > needed:
            largest = max(diff_counts, key=diff_counts.get)
            diff_counts[largest] -= total - needed
    else:
        # Even distribution
        each = max(1, needed // len(by_difficulty))
        for diff in by_difficulty:
            diff_counts[diff] = each
        # Distribute remainder
        remainder = needed - sum(diff_counts.values())
        for diff in by_difficulty:
            if remainder <= 0:
                break
            diff_counts[diff] = diff_counts.get(diff, 0) + 1
            remainder -= 1

    selected: list[dict] = []
    for diff, count_needed in diff_counts.items():
        pool = by_difficulty.get(diff, [])
        random.shuffle(pool)
        for q in pool[:count_needed]:
            selected.append(
                {
                    "question_id": q.id,
                    "question_type": q.question_type,
                    "score": config.score_per_question,
                    "difficulty": q.difficulty,
                }
            )

    return selected


# ═══════════════════════════════════════════════════════════════
#  Paper CRUD
# ═══════════════════════════════════════════════════════════════

@router.post("")
async def create_exam_paper(
    exam_paper_in: ExamPaperCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new exam paper (metadata only; add units via unit endpoints)."""
    _check_teacher_or_admin(current_user)

    data = exam_paper_in.model_dump(exclude_none=True)
    data.pop("questions", None)  # old import field — not supported in V3.5.1
    data["created_by"] = current_user.id

    exam_paper = ExamPaper(**data)
    db.add(exam_paper)
    await db.commit()
    await db.refresh(exam_paper)

    return _paper_to_dict(exam_paper)


@router.get("")
async def list_exam_papers(
    skip: int = 0,
    limit: int = 20,
    title: Optional[str] = None,
    status: Optional[str] = None,
    scope: Optional[str] = None,
    grade: Optional[str] = None,
    grades: Optional[str] = None,
    subject: Optional[str] = None,
    keyword: Optional[str] = None,
    created_by: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List exam papers with filtering. Returns unit_count and question_count."""
    limit = min(limit, 200)
    query = select(ExamPaper)

    if title:
        query = query.where(ExamPaper.title.ilike(f"%{title}%"))
    if subject:
        query = query.where(ExamPaper.subject == subject)
    if status:
        query = query.where(ExamPaper.status == status)
    if scope:
        query = query.where(ExamPaper.grade_level["scope"].astext == scope)
    if grades:
        grade_list = [g.strip() for g in grades.split(",") if g.strip()]
        if len(grade_list) == 1:
            query = query.where(
                ExamPaper.grade_level["grades"].contains([grade_list[0]])
            )
        elif len(grade_list) > 1:
            query = query.where(
                ExamPaper.grade_level["grades"].op("?|")(grade_list)
            )
    elif grade:
        query = query.where(
            ExamPaper.grade_level["grades"].contains([grade])
        )
    if keyword:
        from sqlalchemy import or_

        query = query.where(
            or_(
                ExamPaper.grade_level["chapter"].astext.ilike(f"%{keyword}%"),
                ExamPaper.grade_level["knowledge_points"]
                .astext.ilike(f"%{keyword}%"),
            )
        )
    if created_by == "me":
        query = query.where(ExamPaper.created_by == current_user.id)

    query = (
        query.offset(skip)
        .limit(limit)
        .order_by(ExamPaper.updated_at.desc())
    )
    result = await db.execute(query)
    papers = result.scalars().all()

    paper_ids = [p.id for p in papers]
    unit_counts, question_counts = await _count_units_and_questions(db, paper_ids)

    # 检查哪些试卷有草稿（正在修改中）
    draft_paper_ids: set[str] = set()
    if paper_ids and hasattr(current_user, 'id'):
        try:
            from app.models.exam_paper_draft import ExamPaperDraft
            draft_rows = await db.execute(
                select(ExamPaperDraft.paper_id).where(
                    ExamPaperDraft.user_id == current_user.id,
                    ExamPaperDraft.paper_id.in_(paper_ids),
                )
            )
            draft_paper_ids = {str(r[0]) for r in draft_rows.fetchall() if r[0]}
        except Exception:
            pass

    return [
        {
            **_paper_to_dict(
                p,
                unit_count=unit_counts.get(str(p.id), 0),
                question_count=question_counts.get(str(p.id), 0),
            ),
            "has_draft": str(p.id) in draft_paper_ids,
        }
        for p in papers
    ]


@router.get("/my")
async def list_my_papers(
    skip: int = 0,
    limit: int = 20,
    title: Optional[str] = None,
    status: Optional[str] = None,
    grade: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Student's exam papers (those they have submitted answers for)."""
    limit = min(limit, 200)
    if current_user.user_type != "STUDENT":
        raise HTTPException(403, detail="仅学生可访问")

    from sqlalchemy import distinct

    subq = (
        select(distinct(AnswerSubmission.exam_paper_id))
        .where(AnswerSubmission.student_id == current_user.id)
        .subquery()
    )
    query = select(ExamPaper).where(ExamPaper.id.in_(subq))
    if title:
        query = query.where(ExamPaper.title.ilike(f"%{title}%"))
    if status:
        query = query.where(ExamPaper.status == status)
    if grade:
        query = query.where(
            ExamPaper.grade_level["grades"].contains([grade])
        )
    query = (
        query.offset(skip)
        .limit(limit)
        .order_by(ExamPaper.updated_at.desc())
    )
    result = await db.execute(query)
    papers = result.scalars().all()

    paper_ids = [p.id for p in papers]
    unit_counts, question_counts = await _count_units_and_questions(db, paper_ids)

    # Build submission status map
    sub_status_map: dict[str, object] = {}
    if paper_ids:
        sub_result = await db.execute(
            select(AnswerSubmission)
            .where(
                AnswerSubmission.student_id == current_user.id,
                AnswerSubmission.exam_paper_id.in_(paper_ids),
            )
            .order_by(AnswerSubmission.submitted_at.desc())
        )
        for sub in sub_result.scalars().all():
            pid = str(sub.exam_paper_id)
            if pid not in sub_status_map:
                sub_status_map[pid] = sub

    output = []
    for p in papers:
        pid = str(p.id)
        ssub = sub_status_map.get(pid)
        extra = {
            "submission_status": ssub.status if ssub else None,
            "submission_score": (
                float(ssub.total_score)
                if ssub and ssub.total_score is not None
                else None
            ),
            "submission_percentage": (
                float(ssub.percentage)
                if ssub and ssub.percentage is not None
                else None
            ),
            "submission_id": str(ssub.id) if ssub else None,
        }
        output.append(
            _paper_to_dict(
                p,
                unit_count=unit_counts.get(pid, 0),
                question_count=question_counts.get(pid, 0),
                extra=extra,
            )
        )
    return output


@router.get("/{paper_id}")
async def get_exam_paper(
    paper_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get exam paper details including units and questions."""
    result = await db.execute(
        select(ExamPaper)
        .where(ExamPaper.id == paper_id)
        .options(
            selectinload(ExamPaper.units)
            .selectinload(ExamPaperUnit.questions)
            .selectinload(ExamPaperUnitQuestion.question),
        )
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="试卷不存在",
        )

    # Build unit response
    unit_list = []
    q_total = 0
    for unit in paper.units:
        uq_list = []
        for uq in unit.questions:
            q_total += 1
            q_data = None
            if uq.question:
                q_data = {
                    "id": str(uq.question.id),
                    "title": uq.question.title,
                    "question_type": uq.question.question_type,
                    "difficulty": uq.question.difficulty,
                    "score": uq.question.score,
                }
            uq_list.append(_unit_question_to_dict(uq, q_data))
        unit_list.append(_unit_to_dict(unit, uq_list))

    paper_dict = _paper_to_dict(
        paper,
        unit_count=len(paper.units),
        question_count=q_total,
    )
    paper_dict["units"] = unit_list
    return paper_dict


@router.put("/{paper_id}")
async def update_exam_paper(
    paper_id,
    exam_paper_in: ExamPaperUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update exam paper metadata."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="试卷不存在",
        )
    _check_owner_or_admin(paper, current_user)

    update_data = exam_paper_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(paper, field, value)

    await db.commit()
    await db.refresh(paper)
    return _paper_to_dict(paper)


@router.delete("/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam_paper(
    paper_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete exam paper with manual cascade for non-CASCADE FKs."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="试卷不存在",
        )
    _check_owner_or_admin(paper, current_user)

    # Unit questions (FK has ondelete=CASCADE, but explicit is safer)
    unit_ids_subq = (
        select(ExamPaperUnit.id)
        .where(ExamPaperUnit.exam_paper_id == paper_id)
        .subquery()
    )
    await db.execute(
        delete(ExamPaperUnitQuestion).where(
            ExamPaperUnitQuestion.unit_id.in_(unit_ids_subq)
        )
    )
    # Units
    await db.execute(
        delete(ExamPaperUnit).where(
            ExamPaperUnit.exam_paper_id == paper_id
        )
    )
    # Other child records without CASCADE
    await db.execute(
        delete(AnswerSubmission).where(
            AnswerSubmission.exam_paper_id == paper_id
        )
    )
    await db.execute(
        delete(ErrorNotebook).where(
            ErrorNotebook.exam_paper_id == paper_id
        )
    )
    await db.execute(
        delete(OcrUpload).where(
            OcrUpload.exam_paper_id == paper_id
        )
    )
    # Paper itself
    await db.execute(delete(ExamPaper).where(ExamPaper.id == paper_id))
    await db.commit()


# ═══════════════════════════════════════════════════════════════
#  Batch Save (atomic replace-all)
# ═══════════════════════════════════════════════════════════════

@router.post("/{paper_id}/save-all")
async def save_paper_all(
    paper_id,
    data: ExamPaperFullSave,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Atomically save paper metadata + all units + question associations."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="试卷不存在",
        )

    # Update paper metadata
    for field in (
        "title",
        "subtitle",
        "description",
        "subject",
        "grade_level",
        "total_score",
        "duration_minutes",
        "status",
        "instructions",
        "show_units",
        "per_unit_timer",
        "difficulty_ratio",
        "knowledge_node_ids",
    ):
        val = getattr(data, field, None)
        if val is not None:
            # Pydantic 对象需转为 dict，SQLAlchemy JSONB 列不接受 Pydantic model
            if field == "grade_level" and hasattr(val, "model_dump"):
                val = val.model_dump()
            setattr(paper, field, val)

    try:
        # 删除已有单元（ORM delete 确保 session 级联和唯一约束正确处理）
        old_units = await db.execute(
            select(ExamPaperUnit).where(ExamPaperUnit.exam_paper_id == paper_id)
        )
        for old_unit in old_units.scalars().all():
            await db.delete(old_unit)
        await db.flush()

        # Create new units
        for i, unit_in in enumerate(data.units):
            unit = ExamPaperUnit(
                exam_paper_id=paper.id,
                name=unit_in.name,
                description=unit_in.description,
                position=unit_in.position if unit_in.position else i + 1,
                time_limit_minutes=unit_in.time_limit_minutes,
                question_config=[q.model_dump() for q in unit_in.question_config],
                total_score=sum(
                    q.score for q in unit_in.questions
                ),
            )
            db.add(unit)
            await db.flush()

            # Create unit-question links
            for j, q_in in enumerate(unit_in.questions):
                uq = ExamPaperUnitQuestion(
                    unit_id=unit.id,
                    question_id=q_in.question_id,
                    question_type=q_in.question_type,
                    position=q_in.position if q_in.position else j + 1,
                    score=q_in.score,
                )
                db.add(uq)

        await db.commit()
        await db.refresh(paper)
    except Exception as e:
        logger.exception(f'save-all failed for paper {paper_id}')
        await db.rollback()
        raise HTTPException(status_code=500, detail=f'{type(e).__name__}: {e}')

    # Build response
    unit_rows = await db.execute(
        select(ExamPaperUnit)
        .where(ExamPaperUnit.exam_paper_id == paper.id)
        .order_by(ExamPaperUnit.position)
        .options(
            selectinload(ExamPaperUnit.questions).selectinload(
                ExamPaperUnitQuestion.question
            )
        )
    )
    units = unit_rows.scalars().all()
    unit_list = []
    q_total = 0
    for unit in units:
        uq_list = []
        for uq in unit.questions:
            q_total += 1
            q_data = None
            if uq.question:
                q_data = {
                    "id": str(uq.question.id),
                    "title": uq.question.title,
                    "question_type": uq.question.question_type,
                    "difficulty": uq.question.difficulty,
                    "score": uq.question.score,
                }
            uq_list.append(_unit_question_to_dict(uq, q_data))
        unit_list.append(_unit_to_dict(unit, uq_list))

    paper_dict = _paper_to_dict(
        paper,
        unit_count=len(units),
        question_count=q_total,
    )
    paper_dict["units"] = unit_list
    return paper_dict


# ═══════════════════════════════════════════════════════════════
#  Unit CRUD
# ═══════════════════════════════════════════════════════════════

@router.post("/{paper_id}/units")
async def create_unit(
    paper_id,
    unit_in: ExamPaperUnitCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new unit to a paper."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="试卷不存在")

    unit = ExamPaperUnit(
        exam_paper_id=paper.id,
        name=unit_in.name,
        description=unit_in.description,
        position=unit_in.position,
        time_limit_minutes=unit_in.time_limit_minutes,
        question_config=[q.model_dump() for q in unit_in.question_config],
    )
    db.add(unit)
    await db.flush()

    # Add questions if provided
    for j, q_in in enumerate(unit_in.questions):
        uq = ExamPaperUnitQuestion(
            unit_id=unit.id,
            question_id=q_in.question_id,
            question_type=q_in.question_type,
            position=q_in.position if q_in.position else j + 1,
            score=q_in.score,
        )
        db.add(uq)

    # Update total_score
    unit.total_score = sum(
        q.score for q in unit_in.questions
    )
    await db.commit()
    await db.refresh(unit)
    return _unit_to_dict(unit)


@router.put("/{paper_id}/units/{unit_id}")
async def update_unit(
    paper_id,
    unit_id,
    unit_in: ExamPaperUnitUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update unit metadata."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(
        select(ExamPaperUnit).where(
            ExamPaperUnit.id == unit_id,
            ExamPaperUnit.exam_paper_id == paper_id,
        )
    )
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="单元不存在",
        )

    update_data = unit_in.model_dump(exclude_unset=True)
    if "question_config" in update_data and update_data["question_config"] is not None:
        update_data["question_config"] = [
            q.model_dump() if hasattr(q, "model_dump") else q
            for q in update_data["question_config"]
        ]
    for field, value in update_data.items():
        setattr(unit, field, value)

    await db.commit()
    await db.refresh(unit)
    return _unit_to_dict(unit)


@router.delete("/{paper_id}/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unit(
    paper_id,
    unit_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a unit (cascade deletes unit questions at DB level)."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(
        select(ExamPaperUnit).where(
            ExamPaperUnit.id == unit_id,
            ExamPaperUnit.exam_paper_id == paper_id,
        )
    )
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="单元不存在",
        )

    # Manually delete unit questions first
    await db.execute(
        delete(ExamPaperUnitQuestion).where(
            ExamPaperUnitQuestion.unit_id == unit_id
        )
    )
    await db.delete(unit)
    await db.commit()
    return None


@router.put("/{paper_id}/units/sort")
async def sort_units(
    paper_id,
    order: list[dict] = Body(...),  # [{"id": "uuid", "position": 1}, ...]
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Batch-update unit positions."""
    _check_teacher_or_admin(current_user)

    async with db.begin():
        for item in order:
            uid = item.get("id")
            pos = item.get("position", 0)
            await db.execute(
                select(ExamPaperUnit)
                .where(
                    ExamPaperUnit.id == uid,
                    ExamPaperUnit.exam_paper_id == paper_id,
                )
            )
            await db.execute(
                # Direct UPDATE via SQL expression
                ExamPaperUnit.__table__.update()
                .where(ExamPaperUnit.id == uid)
                .values(position=pos)
            )
    return {"message": "排序已更新"}


# ═══════════════════════════════════════════════════════════════
#  Unit Questions
# ═══════════════════════════════════════════════════════════════

@router.get("/{paper_id}/units/{unit_id}/questions")
async def list_unit_questions(
    paper_id,
    unit_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List questions in a unit with full question details."""
    result = await db.execute(
        select(ExamPaperUnitQuestion)
        .where(
            ExamPaperUnitQuestion.unit_id == unit_id,
        )
        .order_by(ExamPaperUnitQuestion.position)
        .options(selectinload(ExamPaperUnitQuestion.question))
    )
    uqs = result.scalars().all()

    return [
        _unit_question_to_dict(
            uq,
            {
                "id": str(uq.question.id),
                "title": uq.question.title,
                "question_type": uq.question.question_type,
                "difficulty": uq.question.difficulty,
                "score": uq.question.score,
            }
            if uq.question
            else None,
        )
        for uq in uqs
    ]


@router.post("/{paper_id}/units/{unit_id}/questions")
async def add_question_to_unit(
    paper_id,
    unit_id,
    q_in: UnitQuestionCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a question to a unit."""
    _check_teacher_or_admin(current_user)

    # Verify paper + unit exist
    result = await db.execute(
        select(ExamPaperUnit).where(
            ExamPaperUnit.id == unit_id,
            ExamPaperUnit.exam_paper_id == paper_id,
        )
    )
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="单元不存在",
        )

    # Verify question exists
    qr = await db.execute(
        select(Question).where(Question.id == q_in.question_id)
    )
    if not qr.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="题目不存在",
        )

    # Check for duplicate in same paper
    dup = await db.execute(
        select(ExamPaperUnitQuestion)
        .join(ExamPaperUnit, ExamPaperUnitQuestion.unit_id == ExamPaperUnit.id)
        .where(
            ExamPaperUnit.exam_paper_id == paper_id,
            ExamPaperUnitQuestion.question_id == q_in.question_id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该题目已在试卷中",
        )

    uq = ExamPaperUnitQuestion(
        unit_id=unit_id,
        question_id=q_in.question_id,
        question_type=q_in.question_type,
        position=q_in.position,
        score=q_in.score,
    )
    db.add(uq)
    await db.commit()
    await db.refresh(uq)

    return _unit_question_to_dict(uq)


@router.delete(
    "/{paper_id}/units/{unit_id}/questions/{qid}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_question_from_unit(
    paper_id,
    unit_id,
    qid,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a question from a unit."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(
        select(ExamPaperUnitQuestion).where(
            ExamPaperUnitQuestion.id == qid,
            ExamPaperUnitQuestion.unit_id == unit_id,
        )
    )
    uq = result.scalar_one_or_none()
    if not uq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="题目关联不存在",
        )

    await db.delete(uq)
    await db.commit()
    return None


@router.put("/{paper_id}/units/{unit_id}/questions/sort")
async def sort_questions_in_unit(
    paper_id,
    unit_id,
    order: list[dict] = Body(...),  # [{"id": "uuid", "position": 1}, ...]
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Batch-update question positions within a unit."""
    _check_teacher_or_admin(current_user)

    async with db.begin():
        for item in order:
            qid = item.get("id")
            pos = item.get("position", 0)
            await db.execute(
                ExamPaperUnitQuestion.__table__.update()
                .where(
                    ExamPaperUnitQuestion.id == qid,
                    ExamPaperUnitQuestion.unit_id == unit_id,
                )
                .values(position=pos)
            )
    return {"message": "排序已更新"}


@router.put("/{paper_id}/units/{unit_id}/questions/{qid}/move")
async def move_question_to_unit(
    paper_id,
    unit_id,
    qid,
    body: dict = Body(...),  # {"target_unit_id": "uuid"}
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move a question to another unit within the same paper."""
    _check_teacher_or_admin(current_user)

    target_unit_id = body.get("target_unit_id")
    if not target_unit_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少 target_unit_id",
        )

    # Verify source UQ exists
    result = await db.execute(
        select(ExamPaperUnitQuestion).where(
            ExamPaperUnitQuestion.id == qid,
            ExamPaperUnitQuestion.unit_id == unit_id,
        )
    )
    uq = result.scalar_one_or_none()
    if not uq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="题目关联不存在",
        )

    # Verify target unit belongs to same paper
    tgt = await db.execute(
        select(ExamPaperUnit).where(
            ExamPaperUnit.id == target_unit_id,
            ExamPaperUnit.exam_paper_id == paper_id,
        )
    )
    if not tgt.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="目标单元不属于同一试卷",
        )

    uq.unit_id = target_unit_id
    await db.commit()
    return {"message": "题目已移动", "new_unit_id": str(target_unit_id)}


# ═══════════════════════════════════════════════════════════════
#  Auto-Select
# ═══════════════════════════════════════════════════════════════

@router.post("/{paper_id}/units/{unit_id}/auto-select")
async def auto_select_unit(
    paper_id,
    unit_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-select questions for a unit based on its question_config."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(
        select(ExamPaperUnit)
        .where(
            ExamPaperUnit.id == unit_id,
            ExamPaperUnit.exam_paper_id == paper_id,
        )
        .options(selectinload(ExamPaperUnit.exam_paper))
    )
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="单元不存在",
        )

    paper = unit.exam_paper
    configs = unit.question_config or []
    if not configs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该单元未配置选题规则",
        )

    all_selected: list[dict] = []
    for cfg_dict in configs:
        cfg = QuestionConfigItem(**cfg_dict)
        selected = await _auto_select_for_config(
            db,
            unit.id,
            cfg,
            paper.subject,
            paper.grade_level,
        )
        all_selected.extend(selected)

    return {
        "unit_id": str(unit.id),
        "selected_count": len(all_selected),
        "candidates": all_selected,
    }


@router.post("/{paper_id}/auto-select-all")
async def auto_select_all(
    paper_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-select questions for every unit in the paper (incremental)."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(
        select(ExamPaper)
        .where(ExamPaper.id == paper_id)
        .options(selectinload(ExamPaper.units))
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="试卷不存在",
        )

    report: list[dict] = []
    for unit in paper.units:
        configs = unit.question_config or []
        unit_selected_count = 0
        for cfg_dict in configs:
            cfg = QuestionConfigItem(**cfg_dict)
            selected = await _auto_select_for_config(
                db,
                unit.id,
                cfg,
                paper.subject,
                paper.grade_level,
            )
            unit_selected_count += len(selected)

        report.append(
            {
                "unit_id": str(unit.id),
                "unit_name": unit.name,
                "selected_count": unit_selected_count,
            }
        )

    return {
        "paper_id": str(paper.id),
        "units": report,
        "total_selected": sum(r["selected_count"] for r in report),
    }


# ═══════════════════════════════════════════════════════════════
#  Auto-Generate (Recommendation Engine)
# ═══════════════════════════════════════════════════════════════

@router.post("/{paper_id}/auto-generate")
async def auto_generate_paper(
    paper_id: str,
    request: AutoGenerateRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """一键生成完整试卷推荐."""
    _check_teacher_or_admin(current_user)
    # 1. Get paper
    paper_result = await db.execute(
        select(ExamPaper).where(ExamPaper.id == paper_id)
    )
    paper = paper_result.scalar_one_or_none()
    if not paper:
        raise HTTPException(404, detail="试卷不存在")

    # 2. Get unit structure
    units_result = await db.execute(
        select(ExamPaperUnit).where(
            ExamPaperUnit.exam_paper_id == paper_id
        ).order_by(ExamPaperUnit.position)
    )
    units = units_result.scalars().all()
    if not units:
        raise HTTPException(400, detail="请先在试卷结构步骤设置题型")

    # Build type configs from units
    type_configs = []
    for unit in units:
        for cfg in (unit.question_config or []):
            if cfg.get("count", 0) > 0:
                type_configs.append({
                    "question_type": cfg["question_type"],
                    "count": cfg["count"],
                    "score_per_question": cfg.get("score_per_question", 5),
                })

    if not type_configs:
        raise HTTPException(400, detail="试卷结构中没有配置题型")

    # 3. Normalize difficulty ratio
    ratio = request.difficulty_ratio
    diffs = ["EASY", "MEDIUM", "HARD"]
    total_ratio = sum(ratio.get(d, 0) for d in diffs)
    if total_ratio <= 0:
        ratio = {"EASY": 0.3, "MEDIUM": 0.5, "HARD": 0.2}
    elif abs(total_ratio - 1.0) > 0.001:
        ratio = {d: ratio.get(d, 0) / total_ratio for d in diffs}

    # 4. Distribute quotas and select questions
    targets = distribute_quotas(type_configs, ratio)
    questions, dashboard = await select_for_targets(
        db, targets, set(request.knowledge_node_ids), paper.subject,
        pre_existing_ids=request.existing_question_ids,
    )

    return {"questions": questions, "constraint_dashboard": dashboard}


async def _query_swap_candidates(db, question_type, difficulty, used_ids, subject=None, grades=None, kn_ids=None):
    """查询换题候选，支持可选约束"""
    conditions = [Question.is_active == True, Question.review_status == "APPROVED", Question.question_type == question_type]
    if difficulty:
        conditions.append(Question.difficulty == difficulty)
    if subject:
        conditions.append(Question.subject == subject)
    if grades:
        grade_conditions = []
        for g in grades:
            grade_conditions.append(cast(Question.grade_level["grades"].astext, String).contains(g))
        if grade_conditions:
            conditions.append(or_(*grade_conditions))
    if kn_ids:
        try:
            from app.models.knowledge_node import QuestionKnowledgeNode
            kn_qids = await db.execute(select(QuestionKnowledgeNode.question_id).where(QuestionKnowledgeNode.knowledge_node_id.in_(kn_ids)))
            kn_qid_set = {str(r[0]) for r in kn_qids.fetchall()}
            if kn_qid_set:
                conditions.append(Question.id.in_(kn_qid_set))
        except Exception:
            pass  # 表不存在时跳过知识点过滤

    result = await db.execute(select(Question).where(*conditions))
    return [q for q in result.scalars().all() if str(q.id) not in used_ids]


@router.post("/{paper_id}/questions/{question_id}/swap")
async def swap_question(
    paper_id: str,
    question_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """换题：逐级放宽约束链，返回 top 3 备选题"""
    _check_teacher_or_admin(current_user)

    result = await db.execute(select(Question).where(Question.id == question_id))
    current = result.scalar_one_or_none()
    if not current:
        raise HTTPException(404, detail="题目不存在")

    paper_check = await db.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = paper_check.scalar_one_or_none()
    if not paper:
        raise HTTPException(404, detail="试卷不存在")

    # 获取已用题目ID
    used_result = await db.execute(
        select(ExamPaperUnitQuestion.question_id).join(ExamPaperUnit).where(ExamPaperUnit.exam_paper_id == paper_id)
    )
    used = {str(r[0]) for r in used_result.fetchall()}

    # 逐级放宽约束链
    subject = paper.subject
    grade_level = paper.grade_level
    grades = grade_level.get("grades", []) if isinstance(grade_level, dict) else []
    kn_ids = paper.knowledge_node_ids or []

    candidates = []
    # Level 1: 学科 + 年级 + 知识点
    if not candidates and subject and grades and kn_ids:
        candidates = await _query_swap_candidates(db, current.question_type, current.difficulty, used, subject=subject, grades=grades, kn_ids=kn_ids)
    # Level 2: 学科 + 年级
    if not candidates and subject and grades:
        candidates = await _query_swap_candidates(db, current.question_type, current.difficulty, used, subject=subject, grades=grades)
    # Level 3: 学科 + 题型 + 难度
    if not candidates:
        candidates = await _query_swap_candidates(db, current.question_type, current.difficulty, used, subject=subject)

    if not candidates:
        return {"alternatives": []}

    alternatives = []
    for q in candidates[:3]:
        alternatives.append({
            "question_id": str(q.id),
            "title": (q.title or "")[:120],
            "difficulty": q.difficulty or "",
            "question_type": q.question_type or "",
            "score": q.score or 0,
        })
    return {"alternatives": alternatives}


# ═══════════════════════════════════════════════════════════════
#  Publish / Copy
# ═══════════════════════════════════════════════════════════════

@router.post("/{paper_id}/publish")
async def publish_exam_paper(
    paper_id,
    body: dict = Body(default={}),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Publish an exam paper and notify students."""
    _check_teacher_or_admin(current_user)
    class_ids = body.get("class_ids", []) if isinstance(body, dict) else (body if isinstance(body, list) else [])

    result = await db.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="试卷不存在")

    if paper.status == "ARCHIVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已归档的试卷不可发布",
        )

    from app.models.admin import Admin
    from app.models.school_class import SchoolClass, class_students
    from app.models.student import Student

    # Teacher name
    admin_result = await db.execute(
        select(Admin).where(Admin.id == paper.created_by)
    )
    admin_row = admin_result.scalar_one_or_none()
    teacher_name = admin_row.full_name if admin_row else "老师"

    # Student list
    if class_ids:
        student_q = (
            select(Student.id)
            .join(class_students, class_students.c.student_id == Student.id)
            .where(class_students.c.class_id.in_(class_ids))
        )
    else:
        student_q = (
            select(Student.id)
            .join(class_students, class_students.c.student_id == Student.id)
            .join(SchoolClass, SchoolClass.id == class_students.c.class_id)
            .where(SchoolClass.teacher_id == paper.created_by)
        )
    student_result = await db.execute(student_q)
    student_ids = [row[0] for row in student_result.all()]

    # Class names
    if class_ids:
        class_name_q = select(SchoolClass.name).where(
            SchoolClass.id.in_(class_ids)
        )
    else:
        class_name_q = select(SchoolClass.name).where(
            SchoolClass.teacher_id == paper.created_by
        )
    class_name_result = await db.execute(class_name_q)
    class_names = [row[0] for row in class_name_result.all()]
    class_name_str = "、".join(class_names) if class_names else "班级"

    # Notifications
    notified_count = 0
    for student_id in student_ids:
        await NotificationService.create_class_announcement_notification(
            db=db,
            recipient_id=str(student_id),
            teacher_name=teacher_name,
            class_name=class_name_str,
            title=f"试卷发布: {paper.title}",
            content=f"「{paper.title}」已发布，请前往我的试卷查看并完成答题。",
        )
        notified_count += 1

    paper.status = "PUBLISHED"
    await db.commit()
    await db.refresh(paper)

    return {
        "id": str(paper.id),
        "title": paper.title,
        "status": paper.status,
        "notified_count": notified_count,
        "updated_at": paper.updated_at,
    }


@router.post("/{paper_id}/copy")
async def copy_exam_paper(
    paper_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deep-copy an exam paper with all units and questions."""
    _check_teacher_or_admin(current_user)

    result = await db.execute(
        select(ExamPaper)
        .where(ExamPaper.id == paper_id)
        .options(
            selectinload(ExamPaper.units)
            .selectinload(ExamPaperUnit.questions)
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="试卷不存在",
        )

    # Create new paper
    new_paper = ExamPaper(
        title=f"{original.title}(副本)",
        subtitle=original.subtitle,
        description=original.description,
        subject=original.subject,
        grade_level=original.grade_level,
        total_score=original.total_score,
        duration_minutes=original.duration_minutes,
        instructions=original.instructions,
        status="DRAFT",
        created_by=current_user.id,
    )
    db.add(new_paper)
    await db.flush()

    # Copy units and questions
    for unit in original.units:
        new_unit = ExamPaperUnit(
            exam_paper_id=new_paper.id,
            name=unit.name,
            description=unit.description,
            position=unit.position,
            time_limit_minutes=unit.time_limit_minutes,
            question_config=unit.question_config,
            total_score=unit.total_score,
        )
        db.add(new_unit)
        await db.flush()

        for uq in unit.questions:
            new_uq = ExamPaperUnitQuestion(
                unit_id=new_unit.id,
                question_id=uq.question_id,
                question_type=uq.question_type,
                position=uq.position,
                score=uq.score,
            )
            db.add(new_uq)

    await db.commit()
    await db.refresh(new_paper)
    return _paper_to_dict(new_paper)


# ═══════════════════════════════════════════════════════════════
#  Preview / Export
# ═══════════════════════════════════════════════════════════════

@router.get("/{paper_id}/preview")
async def preview_exam_paper(
    paper_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Preview exam paper with full unit structure and question details."""
    result = await db.execute(
        select(ExamPaper)
        .where(ExamPaper.id == paper_id)
        .options(
            selectinload(ExamPaper.units)
            .selectinload(ExamPaperUnit.questions)
            .selectinload(ExamPaperUnitQuestion.question),
        )
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="试卷不存在",
        )

    unit_list = []
    q_total = 0
    for unit in paper.units:
        uq_list = []
        for uq in unit.questions:
            q_total += 1
            q = uq.question
            if not q:
                continue

            # Parse correct_answer
            correct_answer = q.correct_answer or ""
            options = None
            answer_text = ""
            try:
                ad = json.loads(correct_answer)
                if isinstance(ad, dict):
                    options = ad.get("options")
                    answer_text = ad.get("correct_answer", "")
                    if isinstance(answer_text, list):
                        answer_text = ", ".join(str(x) for x in answer_text)
                    else:
                        answer_text = str(answer_text)
            except (json.JSONDecodeError, TypeError):
                answer_text = correct_answer

            # 规范化选项：字符串转对象，裁剪题干行内选项
            q_title, q_options = _normalize_options(q.title or "", options)

            uq_list.append(
                {
                    "index": len(uq_list) + 1,
                    "id": str(uq.id),
                    "question_id": str(q.id),
                    "question_type": q.question_type,
                    "position": uq.position,
                    "score": uq.score or q.score or 0,
                    "title": q_title,
                    "difficulty": q.difficulty or "",
                    "correct_answer": correct_answer,
                    "answer_text": answer_text,
                    "options": q_options,
                    "explanation": q.explanation or "",
                }
            )

        unit_list.append(
            {
                "id": str(unit.id),
                "name": unit.name,
                "description": unit.description,
                "position": unit.position,
                "time_limit_minutes": unit.time_limit_minutes,
                "question_config": unit.question_config or [],
                "total_score": unit.total_score or 0,
                "questions": uq_list,
            }
        )

    return {
        "paper": {
            "id": str(paper.id),
            "title": paper.title,
            "subtitle": paper.subtitle,
            "subject": paper.subject,
            "grade_level": paper.grade_level,
            "total_score": paper.total_score,
            "duration_minutes": paper.duration_minutes,
            "status": paper.status,
            "instructions": paper.instructions,
            "description": paper.description,
            "unit_count": len(paper.units),
            "question_count": q_total,
            "show_units": paper.show_units,
            "per_unit_timer": paper.per_unit_timer,
            "difficulty_ratio": paper.difficulty_ratio,
            "knowledge_node_ids": paper.knowledge_node_ids,
        },
        "units": unit_list,
    }


@router.get("/{paper_id}/export/word")
async def export_exam_paper_word(
    paper_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export exam paper as Word document."""
    return await export_word(paper_id, db)


@router.get("/{paper_id}/export/pdf")
async def export_exam_paper_pdf(
    paper_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export exam paper as PDF."""
    return await export_pdf(paper_id, db)


# ═══════════════════════════════════════════════════════════════
#  Student Review
# ═══════════════════════════════════════════════════════════════

@router.get("/{paper_id}/review")
async def review_exam_paper(
    paper_id,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full paper review: paper + student's latest submission + all questions."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(status_code=403, detail="仅学生可复盘")

    paper_result = await db.execute(
        select(ExamPaper).where(ExamPaper.id == paper_id)
    )
    paper = paper_result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="试卷不存在")

    # Latest submission
    sub_result = await db.execute(
        select(AnswerSubmission)
        .where(
            AnswerSubmission.student_id == current_user.id,
            AnswerSubmission.exam_paper_id == paper_id,
        )
        .order_by(AnswerSubmission.submitted_at.desc())
        .limit(1)
    )
    submission = sub_result.scalar_one_or_none()

    # Answer map
    answers_map: dict[str, object] = {}
    if submission:
        ad_result = await db.execute(
            select(AnswerSubmission.answers)  # lazy="selectin" on AnswerSubmission
        )
        # Use explicit query instead
        from app.models.answer_detail import AnswerDetail

        ad_result = await db.execute(
            select(AnswerDetail).where(
                AnswerDetail.answer_submission_id == submission.id
            )
        )
        for ad in ad_result.scalars().all():
            answers_map[str(ad.question_id)] = ad

    # Load questions via units
    units_result = await db.execute(
        select(ExamPaperUnit)
        .where(ExamPaperUnit.exam_paper_id == paper_id)
        .order_by(ExamPaperUnit.position)
        .options(
            selectinload(ExamPaperUnit.questions).selectinload(
                ExamPaperUnitQuestion.question
            )
        )
    )
    units = units_result.scalars().all()

    questions_data = []
    overall_index = 0
    for unit in units:
        for uq in unit.questions:
            q = uq.question
            if not q:
                continue
            overall_index += 1
            ad = answers_map.get(str(uq.question_id))

            # Parse correct_answer
            ca = None
            try:
                data = json.loads(q.correct_answer or "{}")
                if isinstance(data.get("correct_answer"), list):
                    ca = ", ".join(str(x) for x in data["correct_answer"])
                elif isinstance(data.get("correct_answer"), str):
                    ca = data["correct_answer"]
                elif isinstance(data.get("correct_answer"), dict):
                    ca = ", ".join(data["correct_answer"].get("keywords", []))
            except Exception:
                ca = q.correct_answer

            questions_data.append(
                {
                    "index": overall_index,
                    "unit_name": unit.name,
                    "question": {
                        "id": str(q.id),
                        "title": q.title,
                        "question_type": q.question_type,
                        "score": float(uq.score or q.score or 0),
                        "correct_answer": ca,
                    },
                    "student_answer": ad.student_answer if ad else None,
                    "is_correct": ad.is_correct if ad else None,
                    "score_obtained": (
                        float(ad.score_obtained)
                        if ad and ad.score_obtained is not None
                        else None
                    ),
                    "feedback": ad.feedback if ad else None,
                }
            )

    return {
        "paper": {
            "id": str(paper.id),
            "title": paper.title,
            "subject": paper.subject,
            "total_score": float(paper.total_score or 0),
            "duration_minutes": paper.duration_minutes,
        },
        "submission": {
            "id": str(submission.id) if submission else None,
            "status": submission.status if submission else None,
            "total_score": (
                float(submission.total_score)
                if submission and submission.total_score is not None
                else None
            ),
            "percentage": (
                float(submission.percentage)
                if submission and submission.percentage is not None
                else None
            ),
            "submitted_at": (
                submission.submitted_at.isoformat()
                if submission and submission.submitted_at
                else None
            ),
        }
        if submission
        else None,
        "questions": questions_data,
    }


@router.put("/{paper_id}/submission-status")
async def update_submission_status(
    paper_id,
    status_in: str = Body(..., embed=True),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change submission status: GENERATED -> RE_GRADED only."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(status_code=403, detail="仅学生可修改")

    sub_result = await db.execute(
        select(AnswerSubmission)
        .where(
            AnswerSubmission.student_id == current_user.id,
            AnswerSubmission.exam_paper_id == paper_id,
        )
        .order_by(AnswerSubmission.submitted_at.desc())
        .limit(1)
    )
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="未找到提交记录")
    if submission.status != "GENERATED":
        raise HTTPException(
            status_code=400, detail="仅已生成状态可修改为重新判"
        )
    if status_in != "RE_GRADED":
        raise HTTPException(
            status_code=400, detail="仅允许修改为RE_GRADED"
        )
    submission.status = "RE_GRADED"
    await db.commit()
    return {"message": "状态已修改为重新判", "status": "RE_GRADED"}
