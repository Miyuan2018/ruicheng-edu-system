import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Date, Table as SATable
from sqlalchemy.sql import func
from app.db.base import Base


class SchoolClass(Base):
    __tablename__ = "classes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    teacher_id = Column(String(36), ForeignKey("admins.id"), nullable=False, index=True)
    grade_level = Column(String(20), nullable=True)
    subject = Column(String(50), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        # Indexes will be created in migration
    )

    def __repr__(self):
        return f"<SchoolClass(id={self.id}, name='{self.name}', subject='{self.subject}', grade_level='{self.grade_level}')>"


# Student-Class association table
class_students = SATable(
    'class_students',
    Base.metadata,
    Column('id', String(36), primary_key=True, default=lambda: str(uuid.uuid4())),
    Column('class_id', String(36), ForeignKey('classes.id'), nullable=False, index=True),
    Column('student_id', String(36), ForeignKey('students.id'), nullable=False, index=True),
    Column('joined_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
)