import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, Numeric
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class AnswerSubmission(Base):
    __tablename__ = "answer_submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    exam_paper_id = Column(String(36), ForeignKey("exam_papers.id"), nullable=False, index=True)
    submission_type = Column(String(20), nullable=False)
    ocr_upload_id = Column(String(36), ForeignKey("ocr_uploads.id"), nullable=True, index=True)
    status = Column(String(20), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=False)
    graded_at = Column(DateTime(timezone=True), nullable=True)
    total_score = Column(Numeric(precision=5, scale=2), nullable=True)
    percentage = Column(Numeric(precision=5, scale=2), nullable=True)
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        CheckConstraint("submission_type IN ('ONLINE', 'OCR')", name='check_answer_submissions_submission_type'),
        CheckConstraint("status IN ('GRADED', 'GENERATED', 'RE_GRADED')", name='check_answer_submissions_status'),
    )

    # Relationships
    answers = relationship("AnswerDetail", back_populates="submission", lazy="selectin")

    def __repr__(self):
        return f"<AnswerSubmission(id={self.id}, student_id={self.student_id}, exam_paper_id={self.exam_paper_id}, status='{self.status}')>"