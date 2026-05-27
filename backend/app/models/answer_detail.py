import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, Numeric, UniqueConstraint
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class AnswerDetail(Base):
    __tablename__ = "answer_details"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    answer_submission_id = Column(String(36), ForeignKey("answer_submissions.id"), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False, index=True)
    student_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    score_obtained = Column(Numeric(precision=5, scale=2), nullable=True)
    feedback = Column(Text, nullable=True)
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        CheckConstraint("score_obtained >= 0", name='check_answer_details_score_obtained_non_negative'),
        UniqueConstraint('answer_submission_id', 'question_id', name='uq_answer_details_answer_submission_id_question_id')
    )

    # Relationships
    submission = relationship("AnswerSubmission", back_populates="answers")

    def __repr__(self):
        return f"<AnswerDetail(id={self.id}, answer_submission_id={self.answer_submission_id}, question_id={self.question_id}, is_correct={self.is_correct})>"