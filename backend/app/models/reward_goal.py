"""Reward goals set by parents for students."""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, CheckConstraint, Index
from sqlalchemy.sql import func
from app.db.base import Base


class RewardGoal(Base):
    __tablename__ = "reward_goals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    parent_id = Column(String(36), ForeignKey("parents.id"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    reward_description = Column(String(500), nullable=False)
    metric_type = Column(String(30), nullable=False)
    target_value = Column(Integer, nullable=False)
    current_value = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="ACTIVE")
    deadline = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_reward_claimed = Column(Boolean, nullable=False, default=False)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("metric_type IN ('PAPERS_COMPLETED','PRACTICE_SESSIONS','STREAK_DAYS','ERRORS_CLEARED','ACCURACY_IMPROVEMENT')", name="check_reward_metric_type"),
        CheckConstraint("status IN ('ACTIVE','COMPLETED','CANCELLED','EXPIRED')", name="check_reward_status"),
        CheckConstraint("target_value > 0", name="check_reward_target_positive"),
        CheckConstraint("current_value >= 0", name="check_reward_current_nonneg"),
        Index("ix_reward_goals_student_status", "student_id", "status"),
    )
