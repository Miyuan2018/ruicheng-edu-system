import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, Numeric
from sqlalchemy import Uuid as UUID
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base


class OcrUpload(Base):
    __tablename__ = "ocr_uploads"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    exam_paper_id = Column(UUID, ForeignKey("exam_papers.id"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    ocr_engine = Column(String(50), nullable=True)
    confidence_score = Column(Numeric(precision=5, scale=4), nullable=True)
    processed_text = Column(Text, nullable=True)
    structured_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        CheckConstraint("file_size > 0", name='check_ocr_uploads_file_size_positive'),
        CheckConstraint("status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')", name='check_ocr_uploads_status'),
    )

    def __repr__(self):
        return f"<OcrUpload(id={self.id}, student_id={self.student_id}, exam_paper_id={self.exam_paper_id}, status='{self.status}')>"