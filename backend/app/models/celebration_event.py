"""Celebration events triggered by student achievements."""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
from app.db.base import Base


class CelebrationEvent(Base):
    __tablename__ = "celebration_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    event_type = Column(String(30), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    metric_value = Column(Integer, nullable=True)
    parent_notified = Column(Boolean, nullable=False, default=False)
    parent_acknowledged = Column(Boolean, nullable=False, default=False)
    encouragement_sent = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("event_type IN ('PAPER_COMPLETED','STREAK_MILESTONE','ACCURACY_IMPROVED','ERRORS_CLEARED','SUBJECT_MASTERY')", name="check_celebration_event_type"),
    )
