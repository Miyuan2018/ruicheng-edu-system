"""Student statistics endpoints — real data for student dashboard."""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text as sa_text
from app.db.session import get_db
from app.models.answer_submission import AnswerSubmission
from app.models.answer_detail import AnswerDetail
from app.models.error_notebook import ErrorNotebook
from app.models.exam_paper import ExamPaper
from app.core.security import get_current_user

router = APIRouter()


@router.get("/stats")
async def student_stats(
    current_user=Depends(get_current_user),
    db: AsyncSession=Depends(get_db),
):
    """Return real statistics for the current student's dashboard."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(403, detail="仅学生可访问")

    student_id = current_user.id

    # Completed papers count
    completed_result = await db.execute(
        select(func.count(func.distinct(AnswerSubmission.exam_paper_id))).where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
        )
    )
    completed_papers = completed_result.scalar() or 0

    # Average accuracy across all submissions
    accuracy_result = await db.execute(
        select(func.avg(AnswerSubmission.percentage)).where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
            AnswerSubmission.percentage.isnot(None),
        )
    )
    accuracy_rate = accuracy_result.scalar()
    accuracy_rate = round(float(accuracy_rate), 1) if accuracy_rate else 0.0

    # Error count from error notebooks
    error_result = await db.execute(
        select(func.sum(ErrorNotebook.question_count)).where(
            ErrorNotebook.student_id == student_id,
        )
    )
    error_count = error_result.scalar() or 0

    # Highest score
    highest_result = await db.execute(
        select(func.max(AnswerSubmission.percentage)).where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
            AnswerSubmission.percentage.isnot(None),
        )
    )
    highest_pct = highest_result.scalar()
    highest_score = round(float(highest_pct), 1) if highest_pct else 0.0

    # Recent 5 completed papers
    recent_result = await db.execute(
        select(AnswerSubmission, ExamPaper)
        .join(ExamPaper, AnswerSubmission.exam_paper_id == ExamPaper.id)
        .where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
        )
        .order_by(AnswerSubmission.submitted_at.desc())
        .limit(5)
    )
    recent_rows = recent_result.all()
    recent_papers = []
    for sub, paper in recent_rows:
        recent_papers.append({
            "id": str(paper.id),
            "title": paper.title,
            "subject": paper.subject,
            "total_score": float(sub.total_score) if sub.total_score else 0,
            "percentage": float(sub.percentage) if sub.percentage else 0,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
        })

    # Subject distribution
    sub_dist_result = await db.execute(
        select(ExamPaper.subject, func.count(func.distinct(AnswerSubmission.exam_paper_id)))
        .join(ExamPaper, AnswerSubmission.exam_paper_id == ExamPaper.id)
        .where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
        )
        .group_by(ExamPaper.subject)
    )
    subject_distribution = [
        {"subject": row[0] or "未分类", "count": row[1]}
        for row in sub_dist_result.all()
    ]

    return {
        "completed_papers": completed_papers,
        "accuracy_rate": accuracy_rate,
        "error_count": error_count,
        "highest_score": highest_score,
        "recent_papers": recent_papers,
        "subject_distribution": subject_distribution,
    }


@router.get("/progress")
async def student_progress(
    days: int = Query(30, ge=1, le=90),
    current_user=Depends(get_current_user),
    db: AsyncSession=Depends(get_db),
):
    """Return time-series progress data for the current student."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(403, detail="仅学生可访问")

    student_id = current_user.id
    since = datetime.now(timezone.utc) - timedelta(days=days)
    status_filter = ["GRADED", "GENERATED", "RE_GRADED"]

    # 1. Accuracy trend — one data point per submission
    trend_result = await db.execute(
        select(AnswerSubmission, ExamPaper)
        .join(ExamPaper, AnswerSubmission.exam_paper_id == ExamPaper.id)
        .where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(status_filter),
            AnswerSubmission.percentage.isnot(None),
            AnswerSubmission.submitted_at >= since,
        )
        .order_by(AnswerSubmission.submitted_at.asc())
    )
    trend_rows = trend_result.all()
    accuracy_trend = []
    for sub, paper in trend_rows:
        accuracy_trend.append({
            "date": sub.submitted_at.strftime("%Y-%m-%d"),
            "accuracy": round(float(sub.percentage), 1),
            "paper_title": paper.title,
        })

    # 2. Completion activity — submissions per day
    activity_result = await db.execute(
        select(
            func.date_trunc("day", AnswerSubmission.submitted_at).label("day"),
            func.count().label("cnt"),
        )
        .where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(status_filter),
            AnswerSubmission.submitted_at >= since,
        )
        .group_by(sa_text("day"))
        .order_by(sa_text("day"))
    )
    activity_rows = activity_result.all()
    completion_activity = [
        {"date": row[0].strftime("%Y-%m-%d"), "count": row[1]}
        for row in activity_rows
    ]

    # 3. Subject performance — aggregated by subject
    perf_result = await db.execute(
        select(
            ExamPaper.subject,
            func.avg(AnswerSubmission.percentage).label("avg_acc"),
            func.count(func.distinct(AnswerSubmission.exam_paper_id)).label("total_papers"),
        )
        .join(ExamPaper, AnswerSubmission.exam_paper_id == ExamPaper.id)
        .where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(status_filter),
            AnswerSubmission.percentage.isnot(None),
        )
        .group_by(ExamPaper.subject)
    )
    perf_rows = perf_result.all()

    # Get per-question correctness per subject
    subject_performance = []
    for row in perf_rows:
        subject = row[0] or "未分类"
        avg_acc = round(float(row[1]), 1) if row[1] else 0.0
        total_papers = row[2] or 0

        # Count total questions and correct questions for this subject
        detail_result = await db.execute(
            select(
                func.count(AnswerDetail.id).label("total_q"),
                func.sum(
                    sa_text("CASE WHEN answer_details.is_correct THEN 1 ELSE 0 END")
                ).label("correct_q"),
            )
            .join(
                AnswerSubmission,
                AnswerDetail.answer_submission_id == AnswerSubmission.id,
            )
            .join(
                ExamPaper,
                AnswerSubmission.exam_paper_id == ExamPaper.id,
            )
            .where(
                AnswerSubmission.student_id == student_id,
                AnswerSubmission.status.in_(status_filter),
                ExamPaper.subject == subject,
            )
        )
        detail_row = detail_result.one()
        total_questions = detail_row[0] or 0
        correct_questions = int(detail_row[1]) if detail_row[1] else 0

        subject_performance.append({
            "subject": subject,
            "avg_accuracy": avg_acc,
            "total_papers": total_papers,
            "total_questions": total_questions,
            "correct_questions": correct_questions,
        })

    return {
        "accuracy_trend": accuracy_trend,
        "completion_activity": completion_activity,
        "subject_performance": subject_performance,
    }
