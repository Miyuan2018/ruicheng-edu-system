import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy import Uuid as UUID
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base
from sqlalchemy import Boolean, Integer


class Syllabus(Base):
    __tablename__ = "syllabi"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    grade_level = Column(String(20), nullable=True)
    province = Column(String(50), nullable=True)
    subject = Column(String(50), nullable=True)
    content = Column(JSON, nullable=True)
    knowledge_tree = Column(JSON, nullable=True)
    status = Column(String(20), default="DRAFT")
    version = Column(Integer, default=1)
    is_current = Column(Boolean, default=True)
    parent_syllabus_id = Column(UUID, nullable=True)
    created_by = Column(UUID, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
