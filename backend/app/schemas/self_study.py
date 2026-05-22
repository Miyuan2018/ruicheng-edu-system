import uuid
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SelfStudyTaskBase(BaseModel):
    student_id: uuid.UUID
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[str] = Field(None, max_length=20)
    status: str = Field(default="PENDING", pattern="^(PENDING|IN_PROGRESS|COMPLETED|FAILED|CANCELLED)$")
    priority: int = Field(default=1, ge=1, le=5)
    scheduled_time: Optional[datetime] = None
    completed_time: Optional[datetime] = None


class SelfStudyTaskCreate(SelfStudyTaskBase):
    pass


class SelfStudyTaskUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=50)
    grade_level: Optional[str] = Field(None, max_length=20)
    status: Optional[str] = Field(None, pattern="^(PENDING|IN_PROGRESS|COMPLETED|FAILED|CANCELLED)$")
    priority: Optional[int] = Field(None, ge=1, le=5)
    scheduled_time: Optional[datetime] = None
    completed_time: Optional[datetime] = None


class SelfStudyTaskResponse(SelfStudyTaskBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
