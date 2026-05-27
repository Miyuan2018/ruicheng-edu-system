"""Pre-defined encouragement message templates."""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, CheckConstraint
from sqlalchemy.sql import func
from app.db.base import Base


class EncouragementTemplate(Base):
    __tablename__ = "encouragement_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    category = Column(String(30), nullable=False)
    title = Column(String(100), nullable=False)
    message_template = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    usage_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("category IN ('EFFORT','PROGRESS','PERSISTENCE','COMPLETION','GENERAL')", name="check_template_category"),
    )
