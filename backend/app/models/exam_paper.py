import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ExamPaperUnit(Base):
    __tablename__ = "exam_paper_units"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_paper_id = Column(UUID(as_uuid=True), ForeignKey("exam_papers.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    time_limit_minutes = Column(Integer, nullable=True)
    question_config = Column(JSONB, nullable=False, default=list)  # [QuestionConfigItem, ...]
    total_score = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    exam_paper = relationship("ExamPaper", back_populates="units")
    questions = relationship("ExamPaperUnitQuestion", back_populates="unit",
                             cascade="all, delete-orphan",
                             order_by="ExamPaperUnitQuestion.position")


class ExamPaperUnitQuestion(Base):
    __tablename__ = "exam_paper_unit_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("exam_paper_units.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    question_type = Column(String(20), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    score = Column(Integer, nullable=False, default=0)

    unit = relationship("ExamPaperUnit", back_populates="questions")
    question = relationship("Question")

    __table_args__ = (
        UniqueConstraint("unit_id", "question_id", name="uq_exam_paper_unit_questions"),
    )


class ExamPaper(Base):
    __tablename__ = "exam_papers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String(50), nullable=True, index=True)
    grade_level = Column(JSONB, nullable=True)  # {scope, grades[], chapter?}
    status = Column(String(20), nullable=False, default='READY')  # READY, PUBLISHED, ARCHIVED
    total_score = Column(Integer, nullable=False, default=0)
    duration_minutes = Column(Integer, nullable=True)  # Total exam duration in minutes
    subtitle = Column(String(200), nullable=True)
    instructions = Column(Text, nullable=True)
    show_units = Column(Boolean, nullable=False, default=True)  # 预览/打印/导出时是否显示单元名
    per_unit_timer = Column(Boolean, nullable=False, default=False)  # 是否逐单元计时
    template_type = Column(String(30), nullable=False, default='generic', server_default='generic')  # 试卷语义模板: knowledge_block | question_type | difficulty_progression | volume | generic
    difficulty_ratio = Column(JSONB, nullable=True)  # {EASY: 20, MEDIUM: 50, HARD: 30}
    knowledge_node_ids = Column(JSONB, nullable=True)  # ["uuid1", "uuid2"]
    created_by = Column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    units = relationship("ExamPaperUnit", back_populates="exam_paper",
                         order_by="ExamPaperUnit.position",
                         cascade="all, delete-orphan")

    # Table constraints
    __table_args__ = (
        CheckConstraint("total_score >= 0", name='check_exam_papers_total_score_non_negative'),
        CheckConstraint("duration_minutes IS NULL OR duration_minutes >= 0", name='check_exam_papers_duration_non_negative'),
        CheckConstraint("status IN ('READY', 'PUBLISHED', 'ARCHIVED')", name='check_exam_papers_status'),
    )

    def __repr__(self):
        return f"<ExamPaper(id={self.id}, title='{self.title}', status='{self.status}', total_score={self.total_score})>"
