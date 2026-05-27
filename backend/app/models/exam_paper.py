import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, Table
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


# Association table for many-to-many relationship between ExamPaper and Question
exam_paper_questions = Table(
    'exam_paper_questions',
    Base.metadata,
    Column('id', String(36), primary_key=True, default=lambda: str(uuid.uuid4())),
    Column('exam_paper_id', String(36), ForeignKey('exam_papers.id'), nullable=False, index=True),
    Column('question_id', String(36), ForeignKey('questions.id'), nullable=False, index=True),
    Column('position', Integer, nullable=False, default=0),  # For ordering questions in the exam
    Column('score', Integer, nullable=False, default=0),     # Points for this question in the exam
    CheckConstraint('position >= 0', name='check_exam_paper_questions_position_non_negative'),
    CheckConstraint('score >= 0', name='check_exam_paper_questions_score_non_negative'),
)


class ExamPaper(Base):
    __tablename__ = "exam_papers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String(50), nullable=True, index=True)
    grade_level = Column(JSONB, nullable=True)  # {scope, grades[], chapter?}
    status = Column(String(20), nullable=False, default='DRAFT')  # DRAFT, PUBLISHED, ARCHIVED
    total_score = Column(Integer, nullable=False, default=0)
    duration_minutes = Column(Integer, nullable=True)  # Total exam duration in minutes
    subtitle = Column(String(200), nullable=True)
    instructions = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("admins.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    questions = relationship("Question", secondary="exam_paper_questions", back_populates="exam_papers")

    # Table constraints
    __table_args__ = (
        CheckConstraint("total_score >= 0", name='check_exam_papers_total_score_non_negative'),
        CheckConstraint("duration_minutes IS NULL OR duration_minutes >= 0", name='check_exam_papers_duration_non_negative'),
        CheckConstraint("status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')", name='check_exam_papers_status'),
    )

    def __repr__(self):
        return f"<ExamPaper(id={self.id}, title='{self.title}', status='{self.status}', total_score={self.total_score})>"