import uuid
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ExamPaperBase(BaseModel):
    title: str = Field(..., max_length=200)
    subtitle: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    status: str = Field(default="DRAFT", pattern="^(DRAFT|PUBLISHED|ARCHIVED)$")
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[str] = Field(None, max_length=20)
    total_score: int = Field(default=0, ge=0)
    duration_minutes: Optional[int] = Field(None, ge=0)
    instructions: Optional[str] = None


class ExamPaperCreate(ExamPaperBase):
    questions: Optional[List[dict]] = None  # for import


class ExamPaperUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(DRAFT|PUBLISHED|ARCHIVED)$")
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[str] = Field(None, max_length=20)
    total_score: Optional[int] = Field(None, ge=0)
    duration_minutes: Optional[int] = Field(None, ge=0)
    instructions: Optional[str] = None


class ExamPaperResponse(ExamPaperBase):
    id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
