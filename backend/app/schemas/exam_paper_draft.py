from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DraftCreate(BaseModel):
    paper_id: Optional[str] = None
    data: dict


class DraftResponse(BaseModel):
    id: str
    user_id: str
    paper_id: Optional[str] = None
    data: dict
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
