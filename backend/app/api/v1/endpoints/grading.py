import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.grading_record import GradingRecord
from app.models.answer_submission import AnswerSubmission
from app.models.exam_paper import ExamPaper
from app.models.ml_model import MlModel
from app.schemas.grading import GradingRecordCreate, GradingRecordResponse
from typing import List
from app.core.security import get_current_user
from app.api.v1.endpoints.answers import _grade_submission

router = APIRouter()


@router.post("/start", response_model=GradingRecordResponse)
async def start_grading(
    grading_in: GradingRecordCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(
        select(AnswerSubmission).where(AnswerSubmission.id == grading_in.answer_submission_id)
    )
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="答案提交不存在")

    if current_user.role not in ["TEACHER", "ADMIN"] and str(submission.student_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")

    # Mark as grading
    submission.status = "GRADING"
    await db.commit()

    record = GradingRecord(
        answer_submission_id=grading_in.answer_submission_id,
        model_used="rule-engine",
        model_version="1.0.0",
        status="PROCESSING",
        started_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.commit()

    await _grade_submission(grading_in.answer_submission_id, db)

    record.status = "COMPLETED"
    record.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/status/{grading_id}", response_model=GradingRecordResponse)
async def get_grading_status(
    grading_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GradingRecord).where(GradingRecord.id == grading_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="判卷记录不存在")
    return record


@router.get("/result/{grading_id}", response_model=GradingRecordResponse)
async def get_grading_result(
    grading_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GradingRecord).where(GradingRecord.id == grading_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="判卷记录不存在")
    return record


@router.get("/history/student/{student_id}", response_model=List[GradingRecordResponse])
async def get_grading_history_student(
    student_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if str(student_id) != str(current_user.id) and current_user.role not in ["TEACHER", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")

    result = await db.execute(
        select(GradingRecord)
        .join(AnswerSubmission, GradingRecord.answer_submission_id == AnswerSubmission.id)
        .where(AnswerSubmission.student_id == student_id)
        .offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/history/exam/{exam_paper_id}", response_model=List[GradingRecordResponse])
async def get_grading_history_exam(
    exam_paper_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ["TEACHER", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")

    result = await db.execute(
        select(GradingRecord)
        .join(AnswerSubmission, GradingRecord.answer_submission_id == AnswerSubmission.id)
        .where(AnswerSubmission.exam_paper_id == exam_paper_id)
        .offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/models")
async def get_grading_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MlModel))
    models = result.scalars().all()
    return [{"id": str(m.id), "name": m.name, "version": m.version, "is_active": m.is_active} for m in models]


@router.post("/models/switch")
async def switch_grading_model(model_id: uuid.UUID, current_user = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")
    return {"message": "模型切换成功"}


@router.get("/models/current")
async def get_current_grading_model():
    return {"name": "rule-engine", "version": "1.0.0", "type": "RULE_MATCHING"}
