"""Versioned knowledge tree nodes."""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy import Uuid as UUID
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    syllabus_id = Column(UUID, ForeignKey("syllabi.id"), nullable=False, index=True)
    parent_id = Column(UUID, ForeignKey("knowledge_nodes.id"), nullable=True, index=True)
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
