import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.base import Base


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(String(36), ForeignKey("knowledge_points.id"), nullable=True, index=True)
    subject = Column(String(50), nullable=False, index=True)
    grade_level = Column(String(20), nullable=True, index=True)
    difficulty_level = Column(String(10), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        # Check constraint for difficulty level will be handled in migration or application logic
    )

    def __repr__(self):
        return f"<KnowledgePoint(id={self.id}, code='{self.code}', name='{self.name}', subject='{self.subject}')>"