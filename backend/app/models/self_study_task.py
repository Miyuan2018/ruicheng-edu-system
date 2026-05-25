import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint
from sqlalchemy import Uuid as UUID
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base


class SelfStudyTask(Base):
    __tablename__ = "self_study_tasks"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False)
    priority = Column(Integer, nullable=False)
    assigned_to = Column(UUID, ForeignKey("students.id"), nullable=True, index=True)
    parameters = Column(JSON, nullable=True)
    result_data = Column(JSON, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        CheckConstraint("task_type IN ('KNOWLEDGE_EXTRACTION', 'QUESTION_GENERATION', 'MODEL_TRAINING', 'DATA_SYNC')", name='check_self_study_tasks_task_type'),
        CheckConstraint("status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')", name='check_self_study_tasks_status'),
        CheckConstraint("priority >= 1 AND priority <= 10", name='check_self_study_tasks_priority'),
    )

    def __repr__(self):
        return f"<SelfStudyTask(id={self.id}, title='{self.title}', task_type='{self.task_type}', status='{self.status}', priority={self.priority})>"