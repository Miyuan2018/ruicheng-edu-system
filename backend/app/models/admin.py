"""Admin users (QUESTION_ADMIN, TEACHER) — created by SysAdmin."""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    qualification = Column(String(50), nullable=True)  # 教师资格证号
    admin_type = Column(Integer, nullable=False, default=0)  # 0=TEACHER,1=QUESTION_ADMIN,2=PRINCIPAL,3=DEAN,4=ACADEMIC_MGR,5=HEAD_TEACHER
    subjects = Column(JSONB, nullable=True)  # ["数学","语文"] or ["ALL"]
    grade_level = Column(JSONB, nullable=True)  # ["G7","G8","G9"]
    created_by = Column(String(36), ForeignKey("sys_admins.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
