import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.db.base import Base


class ErrorNotebook(Base):
    __tablename__ = "error_notebooks"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    exam_paper_id = Column(UUID, ForeignKey("exam_papers.id"), nullable=True, index=True)
    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    question_count = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        CheckConstraint("question_count >= 0", name='check_error_notebooks_question_count_non_negative'),
        CheckConstraint("status IN ('DRAFT', 'GENERATED', 'EXPORTED')", name='check_error_notebooks_status'),
    )

    def __repr__(self):
        return f"<ErrorNotebook(id={self.id}, student_id={self.student_id}, title='{self.title}', status='{self.status}')>"