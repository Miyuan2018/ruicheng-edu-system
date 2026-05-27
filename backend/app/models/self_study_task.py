import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, CheckConstraint
from sqlalchemy.sql import func
from app.db.base import Base


class SelfStudyTask(Base):
    __tablename__ = "self_study_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String(50), nullable=True)
    grade_level = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="PENDING")
    priority = Column(Integer, nullable=False, default=1)
    scheduled_time = Column(DateTime(timezone=True), nullable=True)
    completed_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')", name='check_self_study_tasks_status'),
        CheckConstraint("priority >= 1 AND priority <= 5", name='check_self_study_tasks_priority'),
    )

    def __repr__(self):
        return f"<SelfStudyTask(id={self.id}, title='{self.title}', status='{self.status}', priority={self.priority})>"