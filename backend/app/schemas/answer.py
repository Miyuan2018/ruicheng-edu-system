import uuid
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class AnswerDetailBase(BaseModel):
    question_id: uuid.UUID
    student_answer: Optional[str] = None
    is_correct: Optional[bool] = None
    score_obtained: Optional[float] = Field(None, ge=0)
    feedback: Optional[str] = None


class AnswerDetailCreate(AnswerDetailBase):
    pass


class AnswerDetailResponse(AnswerDetailBase):
    id: uuid.UUID
    answer_submission_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnswerSubmissionBase(BaseModel):
    exam_paper_id: uuid.UUID
    submission_type: str = Field(..., pattern="^(ONLINE|OCR)$")
    status: Optional[str] = Field(None, pattern="^(GRADED|GENERATED|RE_GRADED)$")


class AnswerSubmissionCreate(AnswerSubmissionBase):
    answers: List[AnswerDetailCreate]


class AnswerSubmissionResponse(AnswerSubmissionBase):
    id: uuid.UUID
    student_id: uuid.UUID
    submitted_at: datetime
    graded_at: Optional[datetime] = None
    total_score: Optional[float] = None
    percentage: Optional[float] = None
    answers: List[AnswerDetailResponse] = []

    class Config:
        from_attributes = True
