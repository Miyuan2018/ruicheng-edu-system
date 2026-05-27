import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class ErrorNotebookQuestion(Base):
    __tablename__ = "error_notebook_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    error_notebook_id = Column(String(36), ForeignKey("error_notebooks.id"), nullable=False, index=True)
    original_question_id = Column(String(36), ForeignKey("questions.id"), nullable=False, index=True)
    practice_question_id = Column(String(36), ForeignKey("questions.id"), nullable=True, index=True)
    error_type = Column(String(50), nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Table constraints
    __table_args__ = (
        CheckConstraint("explanation IS NOT NULL", name='check_error_notebook_questions_explanation_not_null'),
        UniqueConstraint('error_notebook_id', 'original_question_id', name='uq_enq_notebook_orig_qid')
    )

    # Relationships
    notebook = relationship("ErrorNotebook", back_populates="questions")

    def __repr__(self):
        return f"<ErrorNotebookQuestion(id={self.id}, error_notebook_id={self.error_notebook_id}, original_question_id={self.original_question_id})>"