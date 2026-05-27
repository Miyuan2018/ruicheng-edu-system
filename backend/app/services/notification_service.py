from datetime import datetime
from typing import Optional, List
import logging
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification
from app.schemas.notification import NotificationCreate, NotificationUpdate
from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)


class NotificationService:
    @staticmethod
    async def create_notification(db: AsyncSession, data: NotificationCreate) -> Notification:
        notification = Notification(
            recipient_id=data.recipient_id,
            sender_id=data.sender_id,
            notification_type=data.notification_type,
            title=data.title,
            content=data.content,
            channel=data.channel,
            status="PENDING",
            related_entity_type=data.related_entity_type,
            related_entity_id=data.related_entity_id,
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)

        # Push real-time notification to the recipient's active WebSocket connections
        try:
            await ws_manager.send_to_user(str(notification.recipient_id), {
                "type": "notification",
                "data": {
                    "id": str(notification.id),
                    "title": notification.title,
                    "content": notification.content,
                    "notification_type": notification.notification_type,
                    "status": notification.status,
                    "created_at": notification.created_at.isoformat() if notification.created_at else None,
                },
            })
        except Exception:
            # WebSocket push is best-effort; never block notification creation.
            logger.warning("WebSocket push failed for notification %s", notification.id, exc_info=True)

        return notification

    @staticmethod
    async def get_user_notifications(
        db: AsyncSession,
        recipient_id: str,
        unread_only: bool = False,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[Notification], int, int]:
        base_query = select(Notification).where(Notification.recipient_id == recipient_id)
        if unread_only:
            base_query = base_query.where(Notification.status != "READ")

        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        unread_count_query = select(func.count()).select_from(
            select(Notification).where(
                Notification.recipient_id == recipient_id,
                Notification.status != "READ",
            ).subquery()
        )
        unread_result = await db.execute(unread_count_query)
        unread_count = unread_result.scalar() or 0

        query = base_query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        items = result.scalars().all()
        return items, total, unread_count

    @staticmethod
    async def mark_as_read(db: AsyncSession, notification_id: str, recipient_id: str) -> Optional[Notification]:
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.recipient_id == recipient_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            return None
        notification.status = "READ"
        notification.read_at = datetime.utcnow()
        await db.commit()
        await db.refresh(notification)
        return notification

    @staticmethod
    async def mark_all_as_read(db: AsyncSession, recipient_id: str) -> int:
        result = await db.execute(
            update(Notification)
            .where(
                Notification.recipient_id == recipient_id,
                Notification.status != "READ",
            )
            .values(status="READ", read_at=datetime.utcnow())
        )
        await db.commit()
        return result.rowcount or 0

    @staticmethod
    async def delete_notification(db: AsyncSession, notification_id: str, recipient_id: str) -> bool:
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.recipient_id == recipient_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            return False
        await db.delete(notification)
        await db.commit()
        return True

    @staticmethod
    async def create_grading_complete_notification(
        db: AsyncSession,
        recipient_id: str,
        exam_paper_title: str,
        score: float,
        max_score: float,
    ) -> Notification:
        data = NotificationCreate(
            recipient_id=recipient_id,
            notification_type="GRADING_COMPLETE",
            title=f"试卷「{exam_paper_title}」已判分完成",
            content=f"您的试卷「{exam_paper_title}」已自动判分完成，得分 {score}/{max_score}。",
            channel="IN_APP",
            related_entity_type="exam_paper",
        )
        return await NotificationService.create_notification(db, data)

    @staticmethod
    async def create_error_notebook_ready_notification(
        db: AsyncSession,
        recipient_id: str,
        notebook_title: str,
    ) -> Notification:
        data = NotificationCreate(
            recipient_id=recipient_id,
            notification_type="ERROR_NOTEBOOK_READY",
            title=f"错题本「{notebook_title}」已生成",
            content=f"您的纸质错题练习本「{notebook_title}」已生成，可以前往消灭错题页面查看。",
            channel="IN_APP",
            related_entity_type="error_notebook",
        )
        return await NotificationService.create_notification(db, data)

    @staticmethod
    async def create_encouragement_notification(
        db: AsyncSession,
        student_id: str,
        parent_name: str,
        message: str,
    ) -> Notification:
        data = NotificationCreate(
            recipient_id=student_id,
            notification_type="ENCOURAGEMENT_RECEIVED",
            title=f"收到来自{parent_name}的鼓励",
            content=message[:200],
            channel="IN_APP",
            related_entity_type="encouragement",
        )
        return await NotificationService.create_notification(db, data)

    @staticmethod
    async def create_celebration_notification(
        db: AsyncSession,
        parent_id: str,
        student_name: str,
        event_title: str,
    ) -> Notification:
        data = NotificationCreate(
            recipient_id=parent_id,
            notification_type="CELEBRATION_EVENT",
            title=f"{student_name}: {event_title}",
            content=f"{student_name}取得了新的成就: {event_title}",
            channel="IN_APP",
            related_entity_type="celebration",
        )
        return await NotificationService.create_notification(db, data)

    @staticmethod
    async def create_reward_update_notification(
        db: AsyncSession,
        student_id: str,
        goal_title: str,
        current: int,
        target: int,
    ) -> Notification:
        pct = round(current / target * 100) if target > 0 else 0
        data = NotificationCreate(
            recipient_id=student_id,
            notification_type="REWARD_GOAL_UPDATE",
            title=f"奖励目标进度更新: {goal_title}",
            content=f"「{goal_title}」已完成 {current}/{target} ({pct}%)，继续加油！",
            channel="IN_APP",
            related_entity_type="reward_goal",
        )
        return await NotificationService.create_notification(db, data)

    @staticmethod
    async def create_teacher_feedback_notification(
        db: AsyncSession,
        student_id: str,
        teacher_name: str,
        feedback: str,
    ) -> Notification:
        data = NotificationCreate(
            recipient_id=student_id,
            notification_type="TEACHER_FEEDBACK",
            title=f"收到{teacher_name}老师的评语",
            content=feedback[:200],
            channel="IN_APP",
            related_entity_type="teacher_feedback",
        )
        return await NotificationService.create_notification(db, data)

    @staticmethod
    async def create_class_announcement_notification(
        db: AsyncSession,
        recipient_id: str,
        teacher_name: str,
        class_name: str,
        title: str,
        content: str,
    ) -> Notification:
        data = NotificationCreate(
            recipient_id=recipient_id,
            notification_type="CLASS_ANNOUNCEMENT",
            title=f"班级通知「{class_name}」: {title}",
            content=f"{teacher_name}老师发布了一条通知: {content[:150]}",
            channel="IN_APP",
            related_entity_type="class_announcement",
        )
        return await NotificationService.create_notification(db, data)
