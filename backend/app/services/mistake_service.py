"""Mistake book service."""
import uuid as _uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.answer_submission import AnswerSubmission
from app.models.answer_detail import AnswerDetail
from app.models.question import Question
from app.models.error_notebook import ErrorNotebook
from app.models.error_notebook_question import ErrorNotebookQuestion


async def generate_mistake_book(
    student_id,
    db: AsyncSession,
    exam_paper_id = None,
    title: str = None,
):
    sid = _uuid.UUID(str(student_id))
    query = (
        select(AnswerDetail)
        .join(AnswerSubmission, AnswerDetail.answer_submission_id == AnswerSubmission.id)
        .where(
            AnswerSubmission.student_id == sid,
            AnswerDetail.is_correct == False,  # noqa: E712
        )
    )
    if exam_paper_id:
        eid = _uuid.UUID(str(exam_paper_id))
        query = query.where(AnswerSubmission.exam_paper_id == eid)
    query = query.order_by(AnswerDetail.created_at.desc())

    result = await db.execute(query)
    wrong_details = result.scalars().all()
    if not wrong_details:
        return None

    question_ids = [d.question_id for d in wrong_details]
    q_result = await db.execute(select(Question).where(Question.id.in_(question_ids)))
    questions = {q.id: q for q in q_result.scalars().all()}

    now = datetime.now(timezone.utc)
    book = ErrorNotebook(
        student_id=sid,
        title=title or f"错题本 - {now.strftime('%Y年%m月%d日')}",
        exam_paper_id=_uuid.UUID(str(exam_paper_id)) if exam_paper_id else None,
        generated_at=now,
        question_count=len(wrong_details),
        status="GENERATED",
    )
    db.add(book)
    await db.flush()

    for detail in wrong_details:
        question = questions.get(detail.question_id)
        entry = ErrorNotebookQuestion(
            error_notebook_id=book.id,
            original_question_id=detail.question_id,
            error_type=_classify_error(detail, question),
            explanation=detail.feedback or "请参考标准答案",
            created_at=now,
        )
        db.add(entry)
        practice = await _find_practice_question(question, db)
        if practice:
            entry.practice_question_id = practice.id

    await db.commit()
    await db.refresh(book)
    return book


def _classify_error(detail, question):
    if not detail.student_answer:
        return "未作答"
    if question and question.question_type in ("SINGLE_CHOICE", "MULTIPLE_CHOICE"):
        return "概念错误" if (detail.score_obtained or 0) == 0 else "部分正确"
    if question and question.question_type == "FILL_BLANK":
        return "记忆错误"
    return "理解偏差"


async def _find_practice_question(question, db):
    if not question:
        return None
    result = await db.execute(
        select(Question)
        .where(
            Question.subject == question.subject,
            Question.difficulty == question.difficulty,
            Question.id != question.id,
            Question.is_active == True,  # noqa: E712
        )
        .limit(1)
    )
    match = result.scalar_one_or_none()
    if match:
        return match
    result = await db.execute(
        select(Question)
        .where(
            Question.subject == question.subject,
            Question.id != question.id,
            Question.is_active == True,  # noqa: E712
        )
        .limit(1)
    )
    return result.scalar_one_or_none()
