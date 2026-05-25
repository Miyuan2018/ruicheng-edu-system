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


class NotebookQuestionItem(BaseModel):
    id: uuid.UUID
    error_notebook_id: uuid.UUID
    original_question_id: uuid.UUID
    practice_question_id: Optional[uuid.UUID] = None
    error_type: Optional[str] = None
    explanation: Optional[str] = None
    question_title: Optional[str] = None
    correct_answer: Optional[str] = None
    student_answer: Optional[str] = None
    practice_question: Optional[str] = None

    class Config:
        from_attributes = True


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
    questions: List[NotebookQuestionItem] = []

    class Config:
        from_attributes = True
