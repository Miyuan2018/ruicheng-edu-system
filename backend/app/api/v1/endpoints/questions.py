import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
from app.db.session import get_db
from app.models.question import Question

from app.schemas.question import QuestionCreate, QuestionResponse, QuestionUpdate
from typing import List, Optional
from app.core.security import get_current_user
import json as _json
from app.services.config_service import load_config

router = APIRouter()


@router.post("", response_model=QuestionResponse)
async def create_question(
    question_in: QuestionCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅教师和题库管理员可创建试题")

    data = question_in.model_dump(exclude={"content", "knowledge_points"}, exclude_none=True)
    if question_in.knowledge_points:
        data["meta_data"] = {"knowledge_points": question_in.knowledge_points}
    data["source"] = data.get("source") or "MANUAL"
    data["review_status"] = data.get("review_status") or "APPROVED"
    data["created_by"] = uuid.UUID(current_user.id)
    question = Question(**data)
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


@router.get("/search")
async def search_questions(
    subject: Optional[str] = None,
    grade_level: Optional[str] = None,
    grade: Optional[str] = None,
    scope: Optional[str] = None,
    source: Optional[str] = None,
    question_type: Optional[str] = None,
    difficulty: Optional[str] = None,
    keyword: Optional[str] = None,
    knowledge_point: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 200)
    query = select(Question)

    # Filter by user's subjects (teachers only see their subjects)
    if current_user.user_type == "TEACHER":
        from app.models.admin import Admin
        ar = await db.execute(select(Admin).where(Admin.id == uuid.UUID(current_user.id)))
        admin = ar.scalar_one_or_none()
        if admin and admin.subjects:
            subjs = admin.subjects if isinstance(admin.subjects, list) else _json.loads(admin.subjects) if isinstance(admin.subjects, str) else []
            if "ALL" not in subjs and subjs:
                query = query.where(Question.subject.in_(subjs))

    # Apply filters
    if subject:
        query = query.where(Question.subject == subject)
    if grade:
        query = query.where(Question.grade_level['grades'].contains([grade]))
    if grade_level:
        query = query.where(Question.grade_level['grades'].contains([grade_level]))
    if scope:
        query = query.where(Question.grade_level['scope'].astext == scope)
    if source:
        query = query.where(Question.source == source)
    if question_type:
        query = query.where(Question.question_type == question_type)
    if difficulty:
        query = query.where(Question.difficulty == difficulty)
    if review_status:
        query = query.where(Question.review_status == review_status)
    if keyword:
        from sqlalchemy import or_, String
        query = query.where(or_(
            Question.title.ilike(f"%{keyword}%"),
            Question.grade_level['chapter'].astext.ilike(f"%{keyword}%"),
            Question.grade_level['knowledge_points'].cast(String).ilike(f"%{keyword}%")
        ))

    # Get total count
    from sqlalchemy import func as _func
    count_query = select(_func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    questions = result.scalars().all()
    return {"items": questions, "total": total}


@router.get("/tags", response_model=List[str])
async def get_question_tags(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # This would require a more complex query to extract distinct tags from questions
    # For now, returning an empty list as a placeholder
    return []


@router.get("/knowledge-points", response_model=List[str])
async def get_question_knowledge_points(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # This would require a more complex query to extract distinct knowledge points from questions
    # For now, returning an empty list as a placeholder
    return []


@router.post("/batch-import")
async def batch_import_questions(
    questions: List[dict],
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import questions from JSON array. Each dict maps to QuestionCreate fields."""
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")
    count = 0
    for item in questions[:200]:  # max 200 per import
        q = Question(
            title=item.get("title", ""),
            question_type=item.get("question_type", "SINGLE_CHOICE"),
            difficulty=item.get("difficulty", "MEDIUM"),
            subject=item.get("subject", "数学"),
            grade_level=item.get("grade_level"),
            score=item.get("score", 5),
            correct_answer=item.get("correct_answer"),  # JSON string
            explanation=item.get("explanation"),
            meta_data=item.get("meta_data"),
            source="MANUAL",
            review_status="APPROVED",
            created_by=uuid.UUID(current_user.id),
        )
        db.add(q)
        count += 1
    await db.commit()
    return {"imported": count, "message": f"成功导入 {count} 道试题"}


@router.post("/export")
async def export_selected(question_ids: List[str], db: AsyncSession = Depends(get_db)):
    """Export specific questions by IDs."""
    ids = [uuid.UUID(i) for i in question_ids[:200]]
    result = await db.execute(select(Question).where(Question.id.in_(ids)))
    questions = result.scalars().all()
    return [{"id": str(q.id), "title": q.title, "question_type": q.question_type,
             "difficulty": q.difficulty, "subject": q.subject, "grade_level": q.grade_level,
             "score": q.score, "correct_answer": q.correct_answer,
             "explanation": q.explanation, "meta_data": q.meta_data,
             "source": q.source, "review_status": q.review_status} for q in questions]


@router.get("/export")
async def export_questions(
    subject: Optional[str] = None, grade_level: Optional[str] = None,
    question_type: Optional[str] = None, difficulty: Optional[str] = None,
    keyword: Optional[str] = None, knowledge_point: Optional[str] = None,
    limit: int = 20,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export questions filtered by criteria, max 200."""
    limit = min(limit, 200)
    import json as _json
    from app.services.config_service import load_config
    cfg = load_config()
    export_max = cfg.get("export_max", 200)
    limit = min(limit, export_max) if export_max > 0 else 0
    if limit == 0:
        return []
    query = select(Question)
    if subject: query = query.where(Question.subject == subject)
    if grade_level: query = query.where(Question.grade_level == grade_level)
    if question_type: query = query.where(Question.question_type == question_type)
    if difficulty: query = query.where(Question.difficulty == difficulty)
    if keyword: query = query.where(Question.title.ilike(f"%{keyword}%"))
    if knowledge_point:
        query = query.where(Question.meta_data != None)
    query = query.order_by(Question.created_at.desc()).limit(limit)
    result = await db.execute(query)
    questions = result.scalars().all()
    # Filter knowledge_point in Python (more reliable on SQLite)
    output = []
    for q in questions:
        meta = q.meta_data or {}
        kps = meta.get("knowledge_points", [])
        if knowledge_point and knowledge_point not in str(kps):
            continue
        output.append({
            "id": str(q.id), "title": q.title, "question_type": q.question_type,
            "difficulty": q.difficulty, "subject": q.subject, "grade_level": q.grade_level,
            "score": q.score, "correct_answer": q.correct_answer,
            "explanation": q.explanation, "meta_data": meta,
            "source": q.source, "review_status": q.review_status,
        })
    return output


@router.post("/deduplicate")
async def deduplicate_questions(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: Implement deduplication functionality
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Deduplication functionality not yet implemented",
    )
@router.get("/typical")
async def get_typical_questions(
    skip: int = 0,
    limit: int = 20,
    subject: Optional[str] = None,
    grade: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List typical questions (marked by teachers) — accessible by all authenticated users."""
    limit = min(limit, 200)
    query = select(Question).where(
        Question.is_typical == True,
        Question.is_active == True,
        Question.review_status == "APPROVED",
    )
    if subject:
        query = query.where(Question.subject == subject)
    if grade:
        query = query.where(Question.grade_level['grades'].contains([grade]))
    query = query.offset(skip).limit(limit).order_by(Question.updated_at.desc())
    result = await db.execute(query)
    questions = result.scalars().all()

    # Check which questions have active explanation sessions
    from app.models.explanation_session import ExplanationSession
    q_ids = [str(q.id) for q in questions]
    if q_ids:
        sess_result = await db.execute(
            select(ExplanationSession.question_id).where(
                ExplanationSession.question_id.in_(q_ids),
                ExplanationSession.is_active == True,
            )
        )
        has_explanation_set = set(row[0] for row in sess_result.all())
    else:
        has_explanation_set = set()

    result_list = []
    for q in questions:
        q_dict = {
            "id": str(q.id),
            "title": q.title,
            "question_type": q.question_type,
            "difficulty": q.difficulty,
            "subject": q.subject,
            "score": q.score,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "has_explanation": str(q.id) in has_explanation_set,
        }
        result_list.append(q_dict)
    return result_list


@router.post("/generate-explanation")
async def generate_explanation_endpoint(
    question_id: str = Body(..., embed=True),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Call LLM to generate explanation steps for a question. Does NOT save."""
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, detail="试题不存在")

    from app.services.llm_service import generate_explanation
    resp = await generate_explanation(
        title=q.title,
        question_type=q.question_type,
        difficulty=q.difficulty,
        subject=q.subject,
        correct_answer=q.correct_answer or "",
        explanation=q.explanation or "",
    )
    if not resp.get("ok"):
        raise HTTPException(500, detail=resp.get("error", "LLM生成失败"))

    return {"steps": resp["steps"], "model": resp.get("model", "")}


@router.put("/{question_id}/typical")
async def toggle_typical(
    question_id: uuid.UUID,
    is_typical: bool = Body(..., embed=True),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the is_typical flag — TEACHER / QUESTION_ADMIN / SYS_ADMIN only."""
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, detail="试题不存在")
    q.is_typical = is_typical
    if not is_typical:
        # Clean up existing explanation session for this question
        from app.models.explanation_session import ExplanationSession
        sess_result = await db.execute(
            select(ExplanationSession).where(
                ExplanationSession.question_id == str(question_id)
            )
        )
        old_session = sess_result.scalar_one_or_none()
        if old_session:
            await db.delete(old_session)
    await db.commit()
    return {"id": str(q.id), "is_typical": q.is_typical, "message": "已标记为典型题" if is_typical else "已取消典型题标记"}


@router.get("/has-explanations")
async def has_explanations(
    ids: str = Query(..., description="Comma-separated question IDs"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Batch check which questions have active explanation sessions."""
    from app.models.explanation_session import ExplanationSession
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        return {}

    result = await db.execute(
        select(ExplanationSession.question_id).where(
            ExplanationSession.question_id.in_(id_list),
            ExplanationSession.is_active == True,
        )
    )
    has_set = set(row[0] for row in result.all())
    return {qid: (qid in has_set) for qid in id_list}


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    return question


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: uuid.UUID,
    question_in: QuestionUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only teachers and admins can update questions
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    # Check if user is the creator or is an admin
    if question.created_by != uuid.UUID(current_user.id) and current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Update question
    update_data = question_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(question, field, value)

    await db.commit()
    await db.refresh(question)
    return question


@router.delete("/{question_id}")
async def delete_question(
    question_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")

    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="试题不存在")

    await db.delete(question)
    await db.commit()
    return {"message": "已删除", "id": str(question_id)}


@router.post("/batch-delete")
async def batch_delete_questions(
    question_ids: List[str],
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")
    ids = [uuid.UUID(i) for i in question_ids[:200]]
    result = await db.execute(select(Question).where(Question.id.in_(ids)))
    for q in result.scalars().all():
        await db.delete(q)
    await db.commit()
    return {"deleted": len(ids), "message": f"已删除 {len(ids)} 道试题"}


@router.get("")
async def get_questions(
    skip: int = 0,
    limit: int = 20,
    subject: Optional[str] = None,
    grade_level: Optional[str] = None,
    grade: Optional[str] = None,
    scope: Optional[str] = None,
    source: Optional[str] = None,
    question_type: Optional[str] = None,
    difficulty: Optional[str] = None,
    review_status: Optional[str] = None,
    is_typical: Optional[bool] = None,
    keyword: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 200)
    query = select(Question)

    # Filter by user's subjects (teachers only see their subjects)
    if current_user.user_type == "TEACHER":
        from app.models.admin import Admin
        ar = await db.execute(select(Admin).where(Admin.id == uuid.UUID(current_user.id)))
        admin = ar.scalar_one_or_none()
        if admin and admin.subjects:
            subjs = admin.subjects if isinstance(admin.subjects, list) else _json.loads(admin.subjects) if isinstance(admin.subjects, str) else []
            if "ALL" not in subjs and subjs:
                query = query.where(Question.subject.in_(subjs))

    # Apply filters
    if subject:
        query = query.where(Question.subject == subject)
    if grade:
        query = query.where(Question.grade_level['grades'].contains([grade]))
    if grade_level:
        query = query.where(Question.grade_level['grades'].contains([grade_level]))
    if scope:
        query = query.where(Question.grade_level['scope'].astext == scope)
    if source:
        query = query.where(Question.source == source)
    if question_type:
        query = query.where(Question.question_type == question_type)
    if difficulty:
        query = query.where(Question.difficulty == difficulty)
    if review_status:
        query = query.where(Question.review_status == review_status)
    if is_typical is not None:
        query = query.where(Question.is_typical == is_typical)
    if keyword:
        from sqlalchemy import or_, String
        query = query.where(or_(
            Question.title.ilike(f"%{keyword}%"),
            Question.grade_level['chapter'].astext.ilike(f"%{keyword}%"),
            Question.grade_level['knowledge_points'].cast(String).ilike(f"%{keyword}%")
        ))

    # Get total count
    from sqlalchemy import func as _func
    count_query = select(_func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    questions = result.scalars().all()
    return {"items": questions, "total": total}