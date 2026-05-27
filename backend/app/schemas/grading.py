import uuid
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime


class GradingRecordBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    answer_submission_id: uuid.UUID
    model_id: Optional[str] = None
    status: str = Field(default="PENDING", pattern="^(PENDING|PROCESSING|COMPLETED|FAILED)$")
    total_score: Optional[float] = Field(None, ge=0, le=100)
    feedback: Optional[str] = None
    details: Optional[dict] = None


class GradingRecordCreate(GradingRecordBase):
    pass


class GradingRecordUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    answer_submission_id: Optional[str] = None
    model_id: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(PENDING|PROCESSING|COMPLETED|FAILED)$")
    total_score: Optional[float] = Field(None, ge=0, le=100)
    feedback: Optional[str] = None
    details: Optional[dict] = None


class GradingRecordResponse(GradingRecordBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
