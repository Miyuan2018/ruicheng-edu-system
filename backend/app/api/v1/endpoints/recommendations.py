"""Question recommendations — teacher recommends questions for specific students."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from app.db.session import get_db
from app.core.security import get_current_user, require_role
from app.models.question_recommendation import QuestionRecommendation
from app.models.question import Question
from app.models.student import Student
from app.models.explanation_session import ExplanationSession

router = APIRouter()


class CreateRecommendationRequest(BaseModel):
    question_id: str
    student_ids: List[str]


@router.post("")
async def create_recommendation(
    req: CreateRecommendationRequest,
    current_user = Depends(require_role("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Teacher recommends a question for specific students."""
    # Verify question exists
    r = await db.execute(select(Question).where(Question.id == req.question_id))
    if not r.scalar_one_or_none():
        raise HTTPException(404, detail="试题不存在")
    
    created = []
    for student_id in req.student_ids:
        # Check if already recommended
        existing = await db.execute(
            select(QuestionRecommendation).where(
                QuestionRecommendation.question_id == req.question_id,
                QuestionRecommendation.student_id == student_id,
            )
        )
        if existing.scalar_one_or_none():
            continue
        
        rec = QuestionRecommendation(
            id=str(uuid.uuid4()),
            question_id=req.question_id,
            student_id=student_id,
            recommended_by=current_user.id,
        )
        db.add(rec)
        created.append(student_id)
    
    await db.commit()
    return {"message": f"已推荐给{len(created)}名学生", "created_count": len(created)}


@router.delete("/{recommendation_id}")
async def delete_recommendation(
    recommendation_id: str,
    current_user = Depends(require_role("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a recommendation."""
    r = await db.execute(
        select(QuestionRecommendation).where(QuestionRecommendation.id == recommendation_id)
    )
    rec = r.scalar_one_or_none()
    if not rec:
        raise HTTPException(404, detail="推荐不存在")
    await db.delete(rec)
    await db.commit()
    return {"message": "已取消推荐"}


@router.get("/my")
async def get_my_recommendations(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Student gets questions recommended to them, with has_explanation flag."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(403, detail="仅学生可查看推荐")
    
    r = await db.execute(
        select(QuestionRecommendation, Question)
        .join(Question, QuestionRecommendation.question_id == Question.id)
        .where(QuestionRecommendation.student_id == current_user.id)
        .order_by(QuestionRecommendation.created_at.desc())
    )
    rows = r.all()
    
    if not rows:
        return []
    
    # Batch check explanations
    q_ids = [str(row.Question.id) for row in rows]
    sess_r = await db.execute(
        select(ExplanationSession.question_id).where(
            ExplanationSession.question_id.in_(q_ids),
            ExplanationSession.is_active == True,
        )
    )
    has_exp_set = set(row[0] for row in sess_r.all())
    
    result = []
    for row in rows:
        q = row.Question
        result.append({
            "recommendation_id": row.QuestionRecommendation.id,
            "question_id": str(q.id),
            "title": q.title,
            "question_type": q.question_type,
            "difficulty": q.difficulty,
            "subject": q.subject,
            "score": q.score,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "has_explanation": str(q.id) in has_exp_set,
            "created_at": row.QuestionRecommendation.created_at.isoformat() if row.QuestionRecommendation.created_at else None,
        })
    return result


@router.get("/by-question/{question_id}")
async def get_recommendations_by_question(
    question_id: str,
    current_user = Depends(require_role("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Teacher sees which students a question is recommended to."""
    r = await db.execute(
        select(QuestionRecommendation, Student.full_name)
        .join(Student, QuestionRecommendation.student_id == Student.id)
        .where(QuestionRecommendation.question_id == question_id)
    )
    rows = r.all()
    return [
        {
            "id": row.QuestionRecommendation.id,
            "student_id": row.QuestionRecommendation.student_id,
            "student_name": row.full_name,
            "created_at": row.QuestionRecommendation.created_at.isoformat() if row.QuestionRecommendation.created_at else None,
        }
        for row in rows
    ]


@router.get("/teacher")
async def get_teacher_recommendations(
    subject: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    current_user = Depends(require_role("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Teacher lists all recommendations they have made."""
    query = (
        select(QuestionRecommendation, Question, Student.full_name)
        .join(Question, QuestionRecommendation.question_id == Question.id)
        .join(Student, QuestionRecommendation.student_id == Student.id)
        .where(QuestionRecommendation.recommended_by == current_user.id)
    )
    if subject:
        query = query.where(Question.subject == subject)
    if keyword:
        query = query.where(Question.title.ilike(f"%{keyword}%"))
    query = query.order_by(QuestionRecommendation.created_at.desc()).offset(skip).limit(limit)

    r = await db.execute(query)
    rows = r.all()
    return [
        {
            "id": row.QuestionRecommendation.id,
            "question_id": str(row.Question.id),
            "question_title": row.Question.title,
            "question_type": row.Question.question_type,
            "subject": row.Question.subject,
            "student_id": row.QuestionRecommendation.student_id,
            "student_name": row.full_name,
            "created_at": row.QuestionRecommendation.created_at.isoformat() if row.QuestionRecommendation.created_at else None,
        }
        for row in rows
    ]
