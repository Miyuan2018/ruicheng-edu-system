"""Encouragement messages from parents to students."""
import uuid
from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey, CheckConstraint, Index
from sqlalchemy.sql import func
from app.db.base import Base


class Encouragement(Base):
    __tablename__ = "encouragements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    parent_id = Column(String(36), ForeignKey("parents.id"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    encouragement_type = Column(String(20), nullable=False)  # TEMPLATE/CUSTOM/CELEBRATION/REWARD_COMPLETE
    title = Column(String(200), nullable=True)
    message = Column(Text, nullable=False)
    template_id = Column(String(36), ForeignKey("encouragement_templates.id"), nullable=True)
    celebration_event_id = Column(String(36), ForeignKey("celebration_events.id"), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("encouragement_type IN ('TEMPLATE','CUSTOM','CELEBRATION','REWARD_COMPLETE')", name="check_encouragement_type"),
        Index("ix_encouragements_student_read", "student_id", "is_read"),
    )
