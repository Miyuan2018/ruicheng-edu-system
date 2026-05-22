import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy import Uuid as UUID
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.base import Base


class LlmConfig(Base):
    __tablename__ = "llm_configs"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False)       # ollama / vllm / openai
    endpoint = Column(String(500), nullable=False)
    model_name = Column(String(100), nullable=False)
    is_local = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    config = Column(JSON, nullable=True)  # temperature, top_p, etc.
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
