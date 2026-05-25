import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.db.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    recipient_id = Column(UUID, nullable=False, index=True)
    sender_id = Column(UUID, nullable=True, index=True)
    notification_type = Column(String(30), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    channel = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    related_entity_type = Column(String(30), nullable=True)
    related_entity_id = Column(UUID, nullable=True, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Table constraints
    __table_args__ = (
        CheckConstraint("notification_type IN ('EXAM_REMINDER', 'GRADING_COMPLETE', 'ERROR_NOTEBOOK_READY', 'SYSTEM_UPDATE', 'WELCOME', 'PASSWORD_RESET')", name='check_notifications_notification_type'),
        CheckConstraint("channel IN ('EMAIL', 'WECHAT', 'DINGTALK', 'IN_APP')", name='check_notifications_channel'),
        CheckConstraint("status IN ('PENDING', 'SENT', 'FAILED', 'READ')", name='check_notifications_status'),
    )

    def __repr__(self):
        return f"<Notification(id={self.id}, recipient_id={self.recipient_id}, notification_type='{self.notification_type}', channel='{self.channel}', status='{self.status}')>"