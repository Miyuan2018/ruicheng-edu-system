"""Subject/Course model — managed by SYS_ADMIN."""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.db.base import Base


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(30), nullable=True, unique=True)
    name = Column(String(50), nullable=False, unique=True)
    category = Column(String(30), nullable=True)  # 理科/文科/其他
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
