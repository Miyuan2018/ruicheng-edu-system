import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, Numeric
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base


class GradingRecord(Base):
    __tablename__ = "grading_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    answer_submission_id = Column(String(36), ForeignKey("answer_submissions.id"), nullable=False, index=True)
    model_used = Column(String(100), nullable=True)
    model_version = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    total_score = Column(Numeric(precision=5, scale=2), nullable=True)
    percentage = Column(Numeric(precision=5, scale=2), nullable=True)
    details = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')", name='check_grading_records_status'),
    )

    def __repr__(self):
        return f"<GradingRecord(id={self.id}, answer_submission_id={self.answer_submission_id}, status='{self.status}')>"