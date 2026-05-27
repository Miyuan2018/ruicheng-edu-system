from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class NotificationBase(BaseModel):
    notification_type: str = Field(..., pattern=r"^(EXAM_REMINDER|GRADING_COMPLETE|ERROR_NOTEBOOK_READY|SYSTEM_UPDATE|WELCOME|PASSWORD_RESET|ENCOURAGEMENT_RECEIVED|CELEBRATION_EVENT|REWARD_GOAL_UPDATE|TEACHER_FEEDBACK|CLASS_ANNOUNCEMENT)$")
    title: str = Field(..., max_length=200)
    content: str
    channel: str = Field(default="IN_APP", pattern=r"^(EMAIL|WECHAT|DINGTALK|IN_APP)$")
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None


class NotificationCreate(NotificationBase):
    recipient_id: str
    sender_id: Optional[str] = None


class NotificationUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern=r"^(PENDING|SENT|FAILED|READ)$")
    read_at: Optional[datetime] = None


class NotificationResponse(BaseModel):
    id: str
    recipient_id: str
    sender_id: Optional[str]
    notification_type: str
    title: str
    content: str
    channel: str
    status: str
    related_entity_type: Optional[str]
    related_entity_id: Optional[str]
    sent_at: Optional[datetime]
    read_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    items: List[NotificationResponse]
