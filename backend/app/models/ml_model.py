import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint, BigInteger, UniqueConstraint
from sqlalchemy import Uuid as UUID
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base


class MlModel(Base):
    __tablename__ = "ml_models"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False)
    model_type = Column(String(30), nullable=False)
    framework = Column(String(30), nullable=False)
    storage_path = Column(String(500), nullable=False)
    hash_sha256 = Column(String(64), nullable=False)
    size_bytes = Column(BigInteger(), nullable=False)
    is_active = Column(Boolean, nullable=False, default=False)
    is_deprecated = Column(Boolean, nullable=False, default=False)
    performance_metrics = Column(JSON, nullable=True)
    created_by = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    deployed_at = Column(DateTime(timezone=True), nullable=True)

    # Table constraints
    __table_args__ = (
        CheckConstraint("model_type IN ('GRADING', 'OCR', 'QUESTION_GEN', 'KNOWLEDGE_EXT')", name='check_ml_models_model_type'),
        CheckConstraint("size_bytes > 0", name='check_ml_models_size_bytes_positive'),
        UniqueConstraint('name', 'version', name='uq_ml_models_name_version'),
    )

    def __repr__(self):
        return f"<MlModel(id={self.id}, name='{self.name}', version='{self.version}', model_type='{self.model_type}', framework='{self.framework}', is_active={self.is_active})>"