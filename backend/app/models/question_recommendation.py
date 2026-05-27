"""Question recommendation — teacher recommends questions for specific students."""
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.db.base import Base


class QuestionRecommendation(Base):
    __tablename__ = "question_recommendations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    recommended_by = Column(String(36), ForeignKey("admins.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("question_id", "student_id", name="uq_recommendation_question_student"),
    )
