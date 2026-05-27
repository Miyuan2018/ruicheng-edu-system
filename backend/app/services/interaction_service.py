"""Interaction service — auto-create celebrations and update reward goals after grading."""
import logging
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.answer_submission import AnswerSubmission
from app.models.error_notebook import ErrorNotebook
from app.models.celebration_event import CelebrationEvent
from app.models.reward_goal import RewardGoal
from app.models.parent_student_link import ParentStudentLink
from app.models.student import Student
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


async def process_post_grading_interactions(
    db: AsyncSession,
    student_id: str,
    exam_paper_id: str,
    percentage: float,
) -> None:
    """After grading, check for celebration milestones and update reward goals."""
    try:
        await _check_celebrations(db, student_id, percentage)
    except Exception:
        logger.exception("Celebration check failed")

    try:
        await _update_reward_goals(db, student_id)
    except Exception:
        logger.exception("Reward goal update failed")


async def _check_celebrations(
    db: AsyncSession,
    student_id: str,
    percentage: float,
) -> None:
    """Check if grading result triggers any celebration events."""
    # 1. Paper completed celebration
    completed_r = await db.execute(
        select(func.count(func.distinct(AnswerSubmission.exam_paper_id))).where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
        )
    )
    total_papers = completed_r.scalar() or 0

    # Create PAPER_COMPLETED celebration
    event = CelebrationEvent(
        student_id=student_id,
        event_type="PAPER_COMPLETED",
        title=f"完成了第{total_papers}套试卷",
        description=f"又完成了一套试卷，累计完成{total_papers}套！",
        metric_value=total_papers,
    )
    db.add(event)

    # 2. High accuracy celebration
    if percentage >= 90:
        event2 = CelebrationEvent(
            student_id=student_id,
            event_type="ACCURACY_IMPROVED",
            title="正确率优秀",
            description=f"本次答题正确率达到{percentage:.0f}%，非常出色！",
            metric_value=int(percentage),
        )
        db.add(event2)

    # 3. Check errors cleared milestones
    cleared_r = await db.execute(
        select(func.count()).select_from(ErrorNotebook).where(
            ErrorNotebook.student_id == student_id,
            ErrorNotebook.status == "MASTERED",
        )
    )
    errors_cleared = cleared_r.scalar() or 0
    milestones = [5, 10, 20, 50, 100]
    for m in milestones:
        if errors_cleared == m:
            event3 = CelebrationEvent(
                student_id=student_id,
                event_type="ERRORS_CLEARED",
                title=f"消灭了{m}道错题",
                description=f"累计消灭了{m}道错题，太厉害了！",
                metric_value=errors_cleared,
            )
            db.add(event3)
            break

    await db.commit()

    # Notify linked parents
    await _notify_parents_of_celebration(db, student_id, event.title)


async def _notify_parents_of_celebration(
    db: AsyncSession,
    student_id: str,
    event_title: str,
) -> None:
    """Send celebration notification to all linked parents."""
    # Get student name
    r = await db.execute(select(Student).where(Student.id == student_id))
    student = r.scalar_one_or_none()
    student_name = student.full_name if student else "学生"

    # Get linked parents
    r = await db.execute(
        select(ParentStudentLink.parent_id).where(
            ParentStudentLink.student_id == student_id,
            ParentStudentLink.is_active == True,
        )
    )
    parent_ids = [row[0] for row in r.all()]

    for parent_id in parent_ids:
        try:
            await NotificationService.create_celebration_notification(
                db, parent_id, student_name, event_title,
            )
        except Exception:
            logger.exception(f"Celebration notification to parent {parent_id} failed")


async def _update_reward_goals(db: AsyncSession, student_id: str) -> None:
    """Update active reward goals based on current student metrics."""
    r = await db.execute(
        select(RewardGoal).where(
            RewardGoal.student_id == student_id,
            RewardGoal.status == "ACTIVE",
        )
    )
    active_goals = r.scalars().all()
    if not active_goals:
        return

    # Compute current metrics
    papers_r = await db.execute(
        select(func.count(func.distinct(AnswerSubmission.exam_paper_id))).where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
        )
    )
    papers_completed = papers_r.scalar() or 0

    errors_r = await db.execute(
        select(func.count()).select_from(ErrorNotebook).where(
            ErrorNotebook.student_id == student_id,
            ErrorNotebook.status == "MASTERED",
        )
    )
    errors_cleared = errors_r.scalar() or 0

    metric_values = {
        "PAPERS_COMPLETED": papers_completed,
        "ERRORS_CLEARED": errors_cleared,
    }

    for goal in active_goals:
        new_value = metric_values.get(goal.metric_type)
        if new_value is None:
            continue

        old_value = goal.current_value
        if new_value == old_value:
            continue

        goal.current_value = new_value

        # Check if goal is completed
        if new_value >= goal.target_value and goal.status == "ACTIVE":
            from datetime import datetime, timezone
            goal.status = "COMPLETED"
            goal.completed_at = datetime.now(timezone.utc)

        # Notify student of progress
        if new_value != old_value:
            try:
                await NotificationService.create_reward_update_notification(
                    db, student_id, goal.title, new_value, goal.target_value,
                )
            except Exception:
                logger.exception("Reward update notification failed")

    await db.commit()
