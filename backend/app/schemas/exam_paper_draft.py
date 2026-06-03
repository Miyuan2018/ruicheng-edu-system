import uuid
from pydantic import BaseModel, field_validator
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

    model_config = {"from_attributes": True}

    @field_validator("id", "user_id", "paper_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        if v is None:
            return None
        return str(v)
