"""Parent-student linkage — many-to-many relationship."""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.db.base import Base


class ParentStudentLink(Base):
    __tablename__ = "parent_student_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    parent_id = Column(String(36), ForeignKey("parents.id"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    relationship = Column(String(20), nullable=True)  # 父亲/母亲/爷爷/奶奶/其他
    invite_code_used = Column(String(6), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    linked_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    unlinked_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("parent_id", "student_id", name="uq_parent_student_link"),
    )
