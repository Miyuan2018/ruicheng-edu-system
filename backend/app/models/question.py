import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False)
    question_type = Column(String(20), nullable=False)
    difficulty = Column(String(10), nullable=False)
    subject = Column(String(50), nullable=False, index=True)
    grade_level = Column(JSONB, nullable=True)  # {scope, grades[], chapter?, knowledge_points?}
    score = Column(Integer, nullable=False)
    correct_answer = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)
    meta_data = Column(JSON, nullable=True)
    source = Column(String(20), nullable=False, default="MANUAL")
    review_status = Column(String(20), nullable=False, default="APPROVED")
    reviewed_by = Column(String(36), ForeignKey("admins.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    source_task_id = Column(String(36), nullable=True)
    created_by = Column(String(36), ForeignKey("admins.id"), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_typical = Column(Boolean, nullable=False, default=False, index=True)
    content_hash = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    exam_papers = relationship("ExamPaper", secondary="exam_paper_questions", back_populates="questions")

    # Table constraints
    __table_args__ = (
        CheckConstraint("question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'FILL_BLANK', 'SUBJECTIVE')", name='check_question_type'),
        CheckConstraint("difficulty IN ('EASY', 'MEDIUM', 'HARD')", name='check_difficulty'),
        CheckConstraint("score > 0", name='check_score_positive'),
    )

    def __repr__(self):
        return f"<Question(id={self.id}, title='{self.title[:50]}...', type='{self.question_type}', difficulty='{self.difficulty}', subject='{self.subject}')>"