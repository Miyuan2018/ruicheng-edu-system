import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base


class QuestionTask(Base):
    __tablename__ = "question_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_type = Column(String(20), nullable=False)       # LLM_GENERATE / WEB_SCRAPE / DEDUP
    status = Column(String(20), default="PENDING")       # PENDING / RUNNING / COMPLETED / FAILED / CANCELLED
    progress = Column(Integer, default=0)
    total_items = Column(Integer, default=0)
    completed_items = Column(Integer, default=0)
    parameters = Column(JSON, nullable=True)
    result_summary = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    model_used = Column(String(100), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(36), ForeignKey("admins.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
