import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, Numeric, UniqueConstraint
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base


class KnowledgePointModel(Base):
    __tablename__ = "knowledge_point_models"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_url = Column(String(500), nullable=False)
    source_title = Column(String(200), nullable=True)
    content_hash = Column(String(64), nullable=False)
    extracted_knowledge_points = Column(JSON, nullable=False)
    confidence_score = Column(Numeric(precision=5, scale=4), nullable=True)
    subject = Column(String(50), nullable=False, index=True)
    grade_level = Column(String(20), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        CheckConstraint("confidence_score >= 0 AND confidence_score <= 1", name='check_knowledge_point_models_confidence_score_range'),
        UniqueConstraint('content_hash', name='uq_knowledge_point_models_content_hash'),
    )

    def __repr__(self):
        return f"<KnowledgePointModel(id={self.id}, source_url='{self.source_url}', subject='{self.subject}', confidence_score={self.confidence_score})>"