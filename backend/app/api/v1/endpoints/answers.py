import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.answer_submission import AnswerSubmission
from app.models.answer_detail import AnswerDetail
from app.models.question import Question
from app.models.exam_paper import ExamPaper
from app.schemas.answer import AnswerSubmissionCreate, AnswerSubmissionResponse, AnswerDetailCreate, AnswerDetailResponse
from typing import List, Optional
from app.core.security import get_current_user
from app.services.judge_engine import grade_answer
from app.services.mistake_service import generate_mistake_book
from app.services.notification_service import NotificationService
import logging
logger = logging.getLogger(__name__)

router = APIRouter()


async def _grade_submission(submission_id: uuid.UUID, db: AsyncSession):
    """Grade all answers in a submission, update totals, and create audit record."""
    from app.models.grading_record import GradingRecord

    started_at = datetime.now(timezone.utc)

    result = await db.execute(
        select(AnswerSubmission).where(AnswerSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()
    if not submission:
        return

    # Fetch answer details
    detail_result = await db.execute(
        select(AnswerDetail).where(AnswerDetail.answer_submission_id == submission_id)
    )
    details = detail_result.scalars().all()

    # Build question score map from exam_paper_questions (per-paper score takes priority)
    from app.models.exam_paper import exam_paper_questions
    score_map = {}
    epq_result = await db.execute(
        select(exam_paper_questions.c.question_id, exam_paper_questions.c.score)
        .where(exam_paper_questions.c.exam_paper_id == submission.exam_paper_id)
    )
    for row in epq_result.all():
        score_map[str(row[0])] = float(row[1])

    total_score = 0.0
    max_score = 0.0
    all_correct = 0
    grading_details = []  # audit trail per question

    for detail in details:
        q_result = await db.execute(select(Question).where(Question.id == detail.question_id))
        question = q_result.scalar_one_or_none()
        if not question:
            continue

        # Use exam_paper_questions score if available, otherwise question.score
        q_max_score = score_map.get(str(detail.question_id), float(question.score or 5))

        gr = grade_answer(
            question_type=question.question_type,
            student_answer=detail.student_answer,
            correct_answer=question.correct_answer,
            max_score=q_max_score,
        )

        detail.is_correct = gr.is_correct
        detail.score_obtained = gr.score_obtained
        detail.feedback = gr.feedback
        detail.updated_at = datetime.now(timezone.utc)

        total_score += gr.score_obtained
        max_score += gr.max_score
        if gr.is_correct:
            all_correct += 1

        grading_details.append({
            "question_id": str(detail.question_id),
            "is_correct": gr.is_correct,
            "score_obtained": gr.score_obtained,
            "max_score": gr.max_score,
        })

    # Update submission totals
    pct = (total_score / max_score * 100) if max_score > 0 else 0.0
    submission.status = "GRADED"
    submission.total_score = total_score
    submission.percentage = pct
    submission.graded_at = datetime.now(timezone.utc)

    # Create grading audit record
    record = GradingRecord(
        answer_submission_id=str(submission_id),
        model_used="rule_engine",
        model_version="1.0.0",
        status="COMPLETED",
        started_at=started_at,
        completed_at=datetime.now(timezone.utc),
        total_score=round(total_score, 2),
        percentage=round(pct, 2),
        details={"questions": grading_details, "total_questions": len(details), "correct_count": all_correct},
    )
    db.add(record)

    await db.commit()


@router.post("", response_model=AnswerSubmissionResponse)
async def submit_answer(
    answer_in: AnswerSubmissionCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        if current_user.user_type != "STUDENT":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅学生可提交答案")

        result = await db.execute(select(ExamPaper).where(ExamPaper.id == answer_in.exam_paper_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="试卷不存在")

        now = datetime.now(timezone.utc)
        answer_submission = AnswerSubmission(
            exam_paper_id=answer_in.exam_paper_id,
            student_id=uuid.UUID(current_user.id),
            submission_type=answer_in.submission_type,
            status="GRADED",
            submitted_at=now,
        )
        db.add(answer_submission)
        await db.flush()

        for ad_in in answer_in.answers:
            qr = await db.execute(select(Question).where(Question.id == ad_in.question_id))
            if not qr.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"题目不存在: {ad_in.question_id}")

            detail = AnswerDetail(
                answer_submission_id=answer_submission.id,
                question_id=ad_in.question_id,
                student_answer=ad_in.student_answer,
            )
            db.add(detail)

        # Commit submission + answer details as one atomic transaction
        await db.commit()

        # Auto-grade immediately (separate transaction to preserve submission)
        paper_title = None
        try:
            async with db.begin():
                await _grade_submission(answer_submission.id, db)
            # Fetch paper title for notification
            paper_result = await db.execute(select(ExamPaper).where(ExamPaper.id == answer_in.exam_paper_id))
            paper = paper_result.scalar_one_or_none()
            paper_title = paper.title if paper else "未知试卷"
        except Exception as e:
            logger.exception("Grading failed")

        # Send grading complete notification
        if paper_title:
            try:
                await db.refresh(answer_submission)
                await NotificationService.create_grading_complete_notification(
                    db,
                    recipient_id=current_user.id,
                    exam_paper_title=paper_title,
                    score=float(answer_submission.total_score or 0),
                    max_score=float(paper.total_score or 0) if paper else 0,
                )
            except Exception:
                logger.exception("Notification creation failed")

        # Auto-generate mistake book if there are wrong answers
        try:
            await db.refresh(answer_submission)
            pct = answer_submission.percentage
            if pct is not None and float(pct) < 100:
                await generate_mistake_book(current_user.id, db, exam_paper_id=answer_in.exam_paper_id)
        except Exception as e:
            logger.exception("Mistake book generation failed")

        # Post-grading interactions: celebrations + reward progress
        try:
            await db.refresh(answer_submission)
            pct = float(answer_submission.percentage or 0)
            from app.services.interaction_service import process_post_grading_interactions
            await process_post_grading_interactions(
                db, current_user.id, str(answer_in.exam_paper_id), pct,
            )
        except Exception:
            logger.exception("Post-grading interactions failed")

        await db.refresh(answer_submission)
        return answer_submission
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Submit answer failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{answer_id}", response_model=AnswerSubmissionResponse)
async def get_answer(
    answer_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AnswerSubmission).where(AnswerSubmission.id == answer_id))
    answer_submission = result.scalar_one_or_none()
    if not answer_submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer submission not found",
        )

    # Check if user is the owner of the answer or is a teacher/admin
    if str(answer_submission.student_id) != current_user.id and current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    return answer_submission


@router.put("/{answer_id}", response_model=AnswerSubmissionResponse)
async def update_answer(
    answer_id: uuid.UUID,
    answer_in: AnswerSubmissionCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only students can update their own answers before submission
    if current_user.user_type != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(select(AnswerSubmission).where(AnswerSubmission.id == answer_id))
    answer_submission = result.scalar_one_or_none()
    if not answer_submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer submission not found",
        )

    # Check if user is the owner of the answer
    if str(answer_submission.student_id) != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Only allow updates if not yet locked (GENERATED or RE_GRADED)
    if answer_submission.status == "GENERATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="错题本已生成，无法修改答案",
        )

    # Update answer submission
    answer_submission.submission_type = answer_in.submission_type
    answer_submission.status = answer_in.status or answer_submission.status

    # Update answer details
    # First, delete existing answer details
    await db.execute(delete(AnswerDetail).where(AnswerDetail.answer_submission_id == answer_id))

    # Then create new answer details
    for answer_detail_in in answer_in.answers:
        # Check if question exists
        result = await db.execute(select(Question).where(Question.id == answer_detail_in.question_id))
        question = result.scalar_one_or_none()
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Question not found: {answer_detail_in.question_id}",
            )

        answer_detail = AnswerDetail(
            answer_submission_id=answer_submission.id,
            question_id=answer_detail_in.question_id,
            answer_content=answer_detail_in.answer_content,
            is_correct=answer_detail_in.is_correct,
            points_earned=answer_detail_in.points_earned,
        )
        db.add(answer_detail)

    await db.commit()
    await db.refresh(answer_submission)
    return answer_submission


@router.get("/student/{student_id}/exam/{exam_paper_id}", response_model=AnswerSubmissionResponse)
async def get_student_answer_for_exam(
    student_id: uuid.UUID,
    exam_paper_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Users can only access their own answers unless they are teachers/admins
    if str(student_id) != current_user.id and current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(
        select(AnswerSubmission)
        .where(
            and_(
                AnswerSubmission.student_id == student_id,
                AnswerSubmission.exam_paper_id == exam_paper_id,
            )
        )
    )
    answer_submission = result.scalar_one_or_none()
    if not answer_submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer submission not found",
        )
    return answer_submission


@router.get("/student/{student_id}", response_model=List[AnswerSubmissionResponse])
async def get_student_answers(
    student_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 200)
    # Users can only access their own answers unless they are teachers/admins
    if str(student_id) != current_user.id and current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(
        select(AnswerSubmission)
        .where(AnswerSubmission.student_id == student_id)
        .offset(skip)
        .limit(limit)
    )
    answer_submissions = result.scalars().all()
    return answer_submissions


@router.get("/exam/{exam_paper_id}", response_model=List[AnswerSubmissionResponse])
async def get_exam_answers(
    exam_paper_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 200)
    # Only teachers and admins can access all answers for an exam
    if current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(
        select(AnswerSubmission)
        .where(AnswerSubmission.exam_paper_id == exam_paper_id)
        .offset(skip)
        .limit(limit)
    )
    answer_submissions = result.scalars().all()
    return answer_submissions


@router.delete("/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_answer(
    answer_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only students can delete their own answers before submission
    if current_user.user_type != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(select(AnswerSubmission).where(AnswerSubmission.id == answer_id))
    answer_submission = result.scalar_one_or_none()
    if not answer_submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer submission not found",
        )

    # Check if user is the owner of the answer
    if str(answer_submission.student_id) != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Only allow deletion if not yet locked
    if answer_submission.status == "GENERATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="错题本已生成，无法删除答案",
        )

    # Delete answer details first
    await db.execute(delete(AnswerDetail).where(AnswerDetail.answer_submission_id == answer_id))

    # Delete answer submission
    await db.execute(delete(AnswerSubmission).where(AnswerSubmission.id == answer_id))
    await db.commit()
    return None


# OCR answer upload endpoints would go here
# For brevity, I'm skipping them for now but they would follow a similar pattern