"""Answer statistics endpoints for teachers."""
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.models.answer_submission import AnswerSubmission
from app.models.answer_detail import AnswerDetail
from app.models.exam_paper import ExamPaper, exam_paper_questions
from app.models.question import Question
from app.core.security import get_current_user

router = APIRouter()


@router.get("/papers")
async def list_papers_for_stats(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List papers available for statistics (teacher's own + filterable)."""
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    query = select(ExamPaper)
    if current_user.user_type == "TEACHER":
        query = query.where(ExamPaper.created_by == uuid.UUID(current_user.id))
    query = query.order_by(ExamPaper.created_at.desc()).limit(50)
    result = await db.execute(query)
    papers = result.scalars().all()
    return [{"id": str(p.id), "title": p.title, "subject": p.subject,
             "grade_level": p.grade_level, "total_score": p.total_score,
             "status": p.status} for p in papers]


@router.get("/paper/{paper_id}")
async def paper_question_stats(
    paper_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Statistics per question in a specific paper."""
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    # Verify paper exists
    r = await db.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = r.scalar_one_or_none()
    if not paper:
        raise HTTPException(404, detail="试卷不存在")

    # Get all questions in this paper with positions
    from sqlalchemy import text as sa_text
    qresult = await db.execute(
        sa_text("SELECT q.id, q.title, q.question_type, q.difficulty, q.correct_answer, "
                "q.score, epq.position FROM questions q "
                "JOIN exam_paper_questions epq ON q.id = epq.question_id "
                "WHERE epq.exam_paper_id = :pid ORDER BY epq.position"),
        {"pid": paper_id.hex}
    )
    questions = qresult.fetchall()

    # Get all submissions for this paper
    subs_result = await db.execute(
        select(AnswerSubmission).where(
            AnswerSubmission.exam_paper_id == paper_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
        )
    )
    submissions = subs_result.scalars().all()
    total_students = len(submissions)
    sub_ids = [s.id for s in submissions]

    stats = []
    for q in questions:
        qid = q[0]
        qtype = q[2]
        correct_answer_raw = q[4] or ""

        # Get all answer details for this question
        if sub_ids:
            det_result = await db.execute(
                select(AnswerDetail).where(
                    AnswerDetail.question_id == qid,
                    AnswerDetail.answer_submission_id.in_(sub_ids),
                )
            )
            details = det_result.scalars().all()
        else:
            details = []

        attempted = len(details)
        correct_count = sum(1 for d in details if d.is_correct)
        correct_rate = round(correct_count / attempted * 100, 1) if attempted > 0 else 0

        # For choice questions, compute answer distribution
        choice_distribution = None
        if qtype in ("SINGLE_CHOICE", "MULTIPLE_CHOICE"):
            # Parse correct answer to get option labels
            try:
                answer_data = json.loads(correct_answer_raw)
                options = answer_data.get("options", [])
            except (json.JSONDecodeError, TypeError):
                options = []

            # Count each answer choice
            distribution = {}
            for d in details:
                ans = (d.student_answer or "").strip().upper()
                distribution[ans] = distribution.get(ans, 0) + 1

            choice_distribution = {
                "options": [{"label": o["label"], "text": o["text"]} for o in options],
                "distribution": distribution,
                "total_responses": attempted,
            }

        stats.append({
            "question_id": str(qid),
            "title": q[1] or "",
            "question_type": qtype,
            "difficulty": q[3],
            "score": q[6],
            "position": q[5],
            "total_students": total_students,
            "attempted": attempted,
            "correct_count": correct_count,
            "correct_rate": correct_rate,
            "choice_distribution": choice_distribution,
        })

    return {
        "paper": {"id": str(paper.id), "title": paper.title, "subject": paper.subject},
        "total_students": total_students,
        "questions": stats,
    }


@router.get("/questions")
async def question_overall_stats(
    subject: str = Query(None),
    question_type: str = Query(None),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Overall statistics per question across all papers."""
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    # Get all graded submissions
    subs_query = select(AnswerSubmission).where(
        AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"])
    )
    if current_user.user_type == "TEACHER":
        # Teacher only sees stats for their papers
        teacher_papers = await db.execute(
            select(ExamPaper.id).where(ExamPaper.created_by == uuid.UUID(current_user.id))
        )
        paper_ids = [r[0] for r in teacher_papers.fetchall()]
        if paper_ids:
            subs_query = subs_query.where(AnswerSubmission.exam_paper_id.in_(paper_ids))
        else:
            return {"questions": [], "total_submissions": 0}

    subs_result = await db.execute(subs_query)
    submissions = subs_result.scalars().all()
    sub_ids = [s.id for s in submissions]

    if not sub_ids:
        return {"questions": [], "total_submissions": 0}

    # Get all answer details with question info, filtered
    from sqlalchemy import text as sa_text
    q_filter = ""
    params = {}
    if subject:
        q_filter += " AND q.subject = :subject"
        params["subject"] = subject
    if question_type:
        q_filter += " AND q.question_type = :qtype"
        params["qtype"] = question_type

    # Build sub_id list for IN clause
    id_list = ",".join(f"'{s.hex}'" for s in sub_ids)
    sql = f"""
        SELECT q.id, q.title, q.question_type, q.difficulty, q.correct_answer, q.score,
               COUNT(ad.id) as attempted,
               SUM(CASE WHEN ad.is_correct THEN 1 ELSE 0 END) as correct_count
        FROM questions q
        JOIN answer_details ad ON q.id = ad.question_id
        WHERE ad.answer_submission_id IN ({id_list})
        {q_filter}
        GROUP BY q.id
        ORDER BY attempted DESC
        LIMIT 100
    """
    result = await db.execute(sa_text(sql), params)
    rows = result.fetchall()

    stats = []
    for row in rows:
        qid = str(row[0])
        qtype = row[2]
        correct_answer_raw = row[4] or ""
        attempted = row[6]
        correct_count = row[7]
        correct_rate = round(correct_count / attempted * 100, 1) if attempted > 0 else 0

        # Choice distribution
        choice_distribution = None
        if qtype in ("SINGLE_CHOICE", "MULTIPLE_CHOICE"):
            try:
                answer_data = json.loads(correct_answer_raw)
                options = answer_data.get("options", [])
            except (json.JSONDecodeError, TypeError):
                options = []

            det_result = await db.execute(
                select(AnswerDetail.student_answer, func.count(AnswerDetail.id))
                .where(
                    AnswerDetail.question_id == uuid.UUID(qid),
                    AnswerDetail.answer_submission_id.in_(sub_ids),
                )
                .group_by(AnswerDetail.student_answer)
            )
            distribution = {}
            for d in det_result.fetchall():
                ans = (d[0] or "").strip().upper()
                distribution[ans] = d[1]

            choice_distribution = {
                "options": [{"label": o["label"], "text": o["text"]} for o in options],
                "distribution": distribution,
                "total_responses": attempted,
            }

        stats.append({
            "question_id": qid,
            "title": row[1] or "",
            "question_type": qtype,
            "difficulty": row[3],
            "score": row[5],
            "attempted": attempted,
            "correct_count": correct_count,
            "correct_rate": correct_rate,
            "choice_distribution": choice_distribution,
        })

    return {"questions": stats, "total_submissions": len(sub_ids)}
