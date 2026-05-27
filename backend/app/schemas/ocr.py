import uuid
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class OcrUploadBase(BaseModel):
    file_name: str = Field(..., max_length=255)
    file_path: str = Field(..., max_length=500)
    file_size: int = Field(..., gt=0)
    file_type: str = Field(..., max_length=50)
    ocr_engine: Optional[str] = Field(None, max_length=50)
    confidence_score: Optional[float] = Field(None, ge=0, le=1)
    processed_text: Optional[str] = None
    structured_data: Optional[dict] = None
    error_message: Optional[str] = None


class OcrUploadCreate(OcrUploadBase):
    pass


class OcrUploadUpdate(BaseModel):
    file_name: Optional[str] = Field(None, max_length=255)
    file_path: Optional[str] = Field(None, max_length=500)
    file_size: Optional[int] = Field(None, gt=0)
    file_type: Optional[str] = Field(None, max_length=50)
    ocr_engine: Optional[str] = Field(None, max_length=50)
    confidence_score: Optional[float] = Field(None, ge=0, le=1)
    processed_text: Optional[str] = None
    structured_data: Optional[dict] = None
    error_message: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(PENDING|PROCESSING|COMPLETED|FAILED|NEEDS_REVIEW)$")


class OcrUploadResponse(OcrUploadBase):
    id: uuid.UUID
    student_id: uuid.UUID
    exam_paper_id: uuid.UUID
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
