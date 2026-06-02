"""Reference/lookup tables — seed data managed by SYS_ADMIN."""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class QuestionType(Base):
    __tablename__ = "question_types"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(30), nullable=False, unique=True)
    name = Column(String(50), nullable=False)
    color = Column(String(20), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0, server_default='0')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class DifficultyLevel(Base):
    __tablename__ = "difficulty_levels"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(30), nullable=False, unique=True)
    name = Column(String(50), nullable=False)
    color = Column(String(20), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0, server_default='0')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class GradeLevel(Base):
    __tablename__ = "grade_levels"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(30), nullable=False, unique=True)
    name = Column(String(50), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0, server_default='0')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PaperStatus(Base):
    __tablename__ = "paper_statuses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(30), nullable=False, unique=True)
    name = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ErrorType(Base):
    __tablename__ = "error_types"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(30), nullable=False, unique=True)
    name = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class QuestionSource(Base):
    __tablename__ = "question_sources"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(30), nullable=False, unique=True)
    name = Column(String(50), nullable=False)
    color = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Province(Base):
    __tablename__ = "provinces"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(30), nullable=False, unique=True)
    name = Column(String(50), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0, server_default='0')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
