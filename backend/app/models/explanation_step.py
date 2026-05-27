import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, CheckConstraint, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class ExplanationStep(Base):
    __tablename__ = "explanation_steps"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("explanation_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    step_order = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    panda_emotion = Column(String(20), nullable=False, default="explaining")
    board_line = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    session = relationship("ExplanationSession", back_populates="steps")

    __table_args__ = (
        CheckConstraint("panda_emotion IN ('idle','thinking','explaining','satisfied')", name="check_steps_emotion"),
        UniqueConstraint("session_id", "step_order", name="uq_steps_session_order"),
    )

    def __repr__(self):
        return f"<ExplanationStep(id={self.id}, order={self.step_order}, emotion='{self.panda_emotion}')>"
