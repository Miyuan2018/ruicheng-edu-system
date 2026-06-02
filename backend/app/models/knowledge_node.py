"""Versioned knowledge tree nodes and question-knowledge associations."""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    syllabus_id = Column(UUID(as_uuid=True), ForeignKey("syllabi.id"), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_nodes.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    node_type = Column(String(20), nullable=False, default="POINT")  # AREA / POINT
    sort_order = Column(Integer, default=0)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    invalid_reason = Column(String(30), nullable=True)  # PARENT_MODIFIED / MANUAL / VERSION_CUT
    is_modified = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class QuestionKnowledgeNode(Base):
    """Structured association between questions and knowledge node POINTs."""
    __tablename__ = "question_knowledge_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    knowledge_node_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False, index=True)

    question = relationship("Question")
    knowledge_node = relationship("KnowledgeNode")

    __table_args__ = (
        UniqueConstraint("question_id", "knowledge_node_id", name="uq_question_knowledge_node"),
    )
