import uuid
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ErrorNotebookBase(BaseModel):
    student_id: uuid.UUID
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[str] = Field(None, max_length=20)


class ErrorNotebookCreate(ErrorNotebookBase):
    pass


class ErrorNotebookUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[str] = Field(None, max_length=20)


class ErrorNotebookResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    title: str
    description: Optional[str] = None
    exam_paper_id: Optional[uuid.UUID] = None
    question_count: int = 0
    status: str = "DRAFT"
    generated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
