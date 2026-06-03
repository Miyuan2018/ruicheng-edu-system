import json
import uuid
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Union
from datetime import datetime

from app.schemas.common import GradeLevel, CorrectAnswerUnion


class QuestionBase(BaseModel):
    title: str = Field(..., max_length=200)
    content: Optional[str] = None
    subject: str = Field(..., max_length=50)
    grade_level: Optional[GradeLevel] = None
    question_type: str = Field(..., pattern="^(SINGLE_CHOICE|MULTIPLE_CHOICE|FILL_BLANK|SUBJECTIVE)$")
    difficulty: str = Field(..., pattern="^(EASY|MEDIUM|HARD)$")
    correct_answer: Optional[Union[str, CorrectAnswerUnion]] = None
    explanation: Optional[str] = None
    score: int = Field(default=5, ge=1)

    @field_validator("correct_answer", mode="before")
    @classmethod
    def parse_correct_answer(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("correct_answer 必须是合法 JSON 字符串")
        return v


class QuestionCreate(QuestionBase):
    source: Optional[str] = "MANUAL"
    review_status: Optional[str] = "APPROVED"


class QuestionUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[GradeLevel] = None
    question_type: Optional[str] = Field(None, pattern="^(SINGLE_CHOICE|MULTIPLE_CHOICE|FILL_BLANK|SUBJECTIVE)$")
    difficulty: Optional[str] = Field(None, pattern="^(EASY|MEDIUM|HARD)$")
    correct_answer: Optional[Union[str, CorrectAnswerUnion]] = None
    explanation: Optional[str] = None
    score: Optional[int] = Field(None, ge=1)
    source: Optional[str] = None
    review_status: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("correct_answer", mode="before")
    @classmethod
    def parse_correct_answer(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("correct_answer 必须是合法 JSON 字符串")
        return v


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
