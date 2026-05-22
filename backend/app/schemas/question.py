import uuid
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class QuestionBase(BaseModel):
    title: str = Field(..., max_length=200)
    content: Optional[str] = None
    subject: str = Field(..., max_length=50)
    grade_level: Optional[str] = Field(None, max_length=20)
    question_type: str = Field(..., pattern="^(SINGLE_CHOICE|MULTIPLE_CHOICE|FILL_BLANK|SUBJECTIVE)$")
    difficulty: str = Field(..., pattern="^(EASY|MEDIUM|HARD)$")
    knowledge_points: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    score: int = Field(default=5, ge=1)


class QuestionCreate(QuestionBase):
    source: Optional[str] = "MANUAL"
    review_status: Optional[str] = "APPROVED"


class QuestionUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[str] = Field(None, max_length=20)
    question_type: Optional[str] = Field(None, pattern="^(SINGLE_CHOICE|MULTIPLE_CHOICE|FILL_BLANK|SUBJECTIVE)$")
    difficulty: Optional[str] = Field(None, pattern="^(EASY|MEDIUM|HARD)$")
    knowledge_points: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    score: Optional[int] = Field(None, ge=1)
    source: Optional[str] = None
    review_status: Optional[str] = None
    is_active: Optional[bool] = None


class QuestionResponse(QuestionBase):
    id: uuid.UUID
    created_by: uuid.UUID
    source: Optional[str] = "MANUAL"
    review_status: Optional[str] = "APPROVED"
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
