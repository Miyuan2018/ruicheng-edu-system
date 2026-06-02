import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class ExplanationSession(Base):
    __tablename__ = "explanation_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=True, index=True)
    title = Column(String(500), nullable=False)
    topic = Column(String(100), nullable=True)
    difficulty_label = Column(String(50), nullable=True)
    problem_statement = Column(Text, nullable=True)
    graph_config = Column(JSONB, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    steps = relationship(
        "ExplanationStep",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ExplanationStep.step_order",
    )

    __table_args__ = (
        UniqueConstraint("question_id", name="uq_explanation_sessions_question_id"),
    )

    def __repr__(self):
        return f"<ExplanationSession(id={self.id}, title='{self.title[:30]}')>"
