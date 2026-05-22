"""System administrator — built-in account, not deletable."""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.db.base import Base


class SysAdmin(Base):
    __tablename__ = "sys_admins"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    username = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
