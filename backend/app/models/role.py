"""Role reference table."""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.db.base import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    code = Column(String(30), nullable=False, unique=True)
    name = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
