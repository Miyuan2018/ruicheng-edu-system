"""Parent endpoints — invite code linking, encouragement, rewards, celebrations, stats."""
import uuid
import secrets
import string
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update
from pydantic import BaseModel, Field
from app.db.session import get_db
from app.core.security import get_current_user, require_role
from app.models.parent import Parent
from app.models.parent_student_link import ParentStudentLink
from app.models.student import Student
from app.models.encouragement import Encouragement
from app.models.encouragement_template import EncouragementTemplate
from app.models.reward_goal import RewardGoal
from app.models.celebration_event import CelebrationEvent
from app.models.answer_submission import AnswerSubmission
from app.models.error_notebook import ErrorNotebook

router = APIRouter()

# ─── Helpers ──────────────────────────────────────────────

_INVITE_CHARS = string.ascii_uppercase.replace("O", "").replace("I", "").replace("L", "") + string.digits.replace("0", "").replace("1", "")


def _generate_invite_code() -> str:
    return "".join(secrets.choice(_INVITE_CHARS) for _ in range(6))


# ─── Schemas ──────────────────────────────────────────────

class LinkStudentRequest(BaseModel):
    invite_code: str = Field(..., min_length=6, max_length=6)
    relationship: str = "其他"

class SendEncouragementRequest(BaseModel):
    student_id: str
    encouragement_type: str = "CUSTOM"
    title: str | None = None
    message: str
    template_id: str | None = None

class CreateRewardGoalRequest(BaseModel):
    student_id: str
    title: str
    description: str | None = None
    reward_description: str
    metric_type: str
    target_value: int = Field(..., gt=0)
    deadline: str | None = None


# ─── Student: Invite Code ────────────────────────────────

@router.post("/students/generate-invite-code")
async def generate_invite_code(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Student generates an invite code for parent linking."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(403, detail="仅学生可生成邀请码")

    student_id = current_user.id
    code = _generate_invite_code()
    expires = datetime.now(timezone.utc) + timedelta(days=7)

    await db.execute(
        update(Student).where(Student.id == student_id).values(
            invite_code=code,
            invite_code_expires_at=expires,
        )
    )
    await db.commit()
    return {"invite_code": code, "expires_at": expires.isoformat()}


@router.get("/students/invite-code")
async def get_invite_code(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current invite code for the student."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(403, detail="仅学生可查看邀请码")

    r = await db.execute(select(Student).where(Student.id == current_user.id))
    student = r.scalar_one_or_none()
    if not student:
        raise HTTPException(404, detail="学生不存在")

    now = datetime.now(timezone.utc)
    if student.invite_code and student.invite_code_expires_at and student.invite_code_expires_at > now:
        return {"invite_code": student.invite_code, "expires_at": student.invite_code_expires_at.isoformat()}
    return {"invite_code": None, "expires_at": None}


# ─── Parent: Link / Unlink ───────────────────────────────

@router.post("/link-student")
async def link_student(
    req: LinkStudentRequest,
    current_user=Depends(require_role("PARENT")),
    db: AsyncSession = Depends(get_db),
):
    """Parent links to a student using invite code."""
    code = req.invite_code.upper()
    now = datetime.now(timezone.utc)

    # Find student by invite code
    r = await db.execute(
        select(Student).where(
            Student.invite_code == code,
            Student.invite_code_expires_at > now,
        )
    )
    student = r.scalar_one_or_none()
    if not student:
        raise HTTPException(400, detail="邀请码无效或已过期")

    # Check duplicate
    r = await db.execute(
        select(ParentStudentLink).where(
            ParentStudentLink.parent_id == current_user.id,
            ParentStudentLink.student_id == student.id,
            ParentStudentLink.is_active == True,
        )
    )
    if r.scalar_one_or_none():
        raise HTTPException(400, detail="您已关联该学生")

    link = ParentStudentLink(
        parent_id=current_user.id,
        student_id=student.id,
        relationship=req.relationship,
        invite_code_used=code,
    )
    db.add(link)

    # Update parent's student_ids array
    r = await db.execute(select(Parent).where(Parent.id == current_user.id))
    parent = r.scalar_one_or_none()
    ids = list(parent.student_ids or [])
    if student.id not in ids:
        ids.append(student.id)
        parent.student_ids = ids

    # Clear invite code
    student.invite_code = None
    student.invite_code_expires_at = None

    await db.commit()
    return {"message": "关联成功", "student_name": student.full_name, "student_id": str(student.id)}


@router.post("/unlink-student")
async def unlink_student(
    student_id: str,
    current_user=Depends(require_role("PARENT")),
    db: AsyncSession = Depends(get_db),
):
    """Parent unlinks from a student."""
    r = await db.execute(
        select(ParentStudentLink).where(
            ParentStudentLink.parent_id == current_user.id,
            ParentStudentLink.student_id == student_id,
            ParentStudentLink.is_active == True,
        )
    )
    link = r.scalar_one_or_none()
    if not link:
        raise HTTPException(404, detail="未找到该关联")

    link.is_active = False
    link.unlinked_at = datetime.now(timezone.utc)

    # Update parent's student_ids
    r = await db.execute(select(Parent).where(Parent.id == current_user.id))
    parent = r.scalar_one_or_none()
    ids = list(parent.student_ids or [])
    if student_id in ids:
        ids.remove(student_id)
        parent.student_ids = ids

    await db.commit()
    return {"message": "已解除关联"}


@router.get("/linked-students")
async def get_linked_students(
    current_user=Depends(require_role("PARENT")),
    db: AsyncSession = Depends(get_db),
):
    """Get all students linked to this parent."""
    r = await db.execute(
        select(ParentStudentLink, Student)
        .join(Student, ParentStudentLink.student_id == Student.id)
        .where(
            ParentStudentLink.parent_id == current_user.id,
            ParentStudentLink.is_active == True,
        )
    )
    rows = r.all()
    return [
        {
            "link_id": str(link.id),
            "student_id": str(student.id),
            "student_name": student.full_name,
            "relationship": link.relationship,
            "linked_at": link.linked_at.isoformat() if link.linked_at else None,
        }
        for link, student in rows
    ]


# ─── Parent: Encouragement ───────────────────────────────

@router.post("/encouragement")
async def send_encouragement(
    req: SendEncouragementRequest,
    current_user=Depends(require_role("PARENT")),
    db: AsyncSession = Depends(get_db),
):
    """Parent sends encouragement to a student."""
    # Verify link
    r = await db.execute(
        select(ParentStudentLink).where(
            ParentStudentLink.parent_id == current_user.id,
            ParentStudentLink.student_id == req.student_id,
            ParentStudentLink.is_active == True,
        )
    )
    if not r.scalar_one_or_none():
        raise HTTPException(403, detail="未关联该学生")

    enc = Encouragement(
        parent_id=current_user.id,
        student_id=req.student_id,
        encouragement_type=req.encouragement_type,
        title=req.title,
        message=req.message,
        template_id=req.template_id,
    )
    db.add(enc)

    # Increment template usage
    if req.template_id:
        await db.execute(
            update(EncouragementTemplate)
            .where(EncouragementTemplate.id == req.template_id)
            .values(usage_count=EncouragementTemplate.usage_count + 1)
        )

    await db.commit()
    await db.refresh(enc)

    # Send notification to student
    try:
        from app.services.notification_service import NotificationService
        r = await db.execute(select(Parent).where(Parent.id == current_user.id))
        parent = r.scalar_one_or_none()
        parent_name = parent.full_name if parent else "家长"
        await NotificationService.create_encouragement_notification(
            db, req.student_id, parent_name, req.message,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Encouragement notification failed")

    return {"id": str(enc.id), "message": "鼓励消息已发送"}


@router.get("/encouragement/sent")
async def get_sent_encouragements(
    student_id: str | None = None,
    current_user=Depends(require_role("PARENT")),
    db: AsyncSession = Depends(get_db),
):
    """Get encouragements sent by this parent."""
    query = select(Encouragement).where(Encouragement.parent_id == current_user.id)
    if student_id:
        query = query.where(Encouragement.student_id == student_id)
    query = query.order_by(Encouragement.created_at.desc()).limit(50)

    r = await db.execute(query)
    encs = r.scalars().all()
    return [
        {
            "id": str(e.id),
            "student_id": str(e.student_id),
            "encouragement_type": e.encouragement_type,
            "title": e.title,
            "message": e.message,
            "is_read": e.is_read,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in encs
    ]


# ─── Student: Received Encouragements ────────────────────

@router.get("/encouragement/received")
async def get_received_encouragements(
    unread_only: bool = False,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Student gets encouragements received."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(403, detail="仅学生可查看")

    query = select(Encouragement).where(Encouragement.student_id == current_user.id)
    if unread_only:
        query = query.where(Encouragement.is_read == False)
    query = query.order_by(Encouragement.created_at.desc()).limit(50)

    r = await db.execute(query)
    encs = r.scalars().all()
    return [
        {
            "id": str(e.id),
            "encouragement_type": e.encouragement_type,
            "title": e.title,
            "message": e.message,
            "is_read": e.is_read,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in encs
    ]


@router.put("/encouragement/{enc_id}/read")
async def mark_encouragement_read(
    enc_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Student marks encouragement as read."""
    r = await db.execute(
        select(Encouragement).where(
            Encouragement.id == enc_id,
            Encouragement.student_id == current_user.id,
        )
    )
    enc = r.scalar_one_or_none()
    if not enc:
        raise HTTPException(404, detail="未找到该消息")
    enc.is_read = True
    enc.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "已标记为已读"}


# ─── Templates ───────────────────────────────────────────

@router.get("/templates")
async def get_templates(
    category: str | None = None,
    current_user=Depends(require_role("PARENT")),
    db: AsyncSession = Depends(get_db),
):
    """Get encouragement templates."""
    query = select(EncouragementTemplate).where(EncouragementTemplate.is_active == True)
    if category:
        query = query.where(EncouragementTemplate.category == category)
    query = query.order_by(EncouragementTemplate.category, EncouragementTemplate.title)

    r = await db.execute(query)
    templates = r.scalars().all()
    return [
        {
            "id": str(t.id),
            "category": t.category,
            "title": t.title,
            "message_template": t.message_template,
            "usage_count": t.usage_count,
        }
        for t in templates
    ]


# ─── Reward Goals ────────────────────────────────────────

@router.post("/reward-goals")
async def create_reward_goal(
    req: CreateRewardGoalRequest,
    current_user=Depends(require_role("PARENT")),
    db: AsyncSession = Depends(get_db),
):
    """Parent creates a reward goal for a student."""
    # Verify link
    r = await db.execute(
        select(ParentStudentLink).where(
            ParentStudentLink.parent_id == current_user.id,
            ParentStudentLink.student_id == req.student_id,
            ParentStudentLink.is_active == True,
        )
    )
    if not r.scalar_one_or_none():
        raise HTTPException(403, detail="未关联该学生")

    deadline = None
    if req.deadline:
        deadline = datetime.fromisoformat(req.deadline)

    goal = RewardGoal(
        parent_id=current_user.id,
        student_id=req.student_id,
        title=req.title,
        description=req.description,
        reward_description=req.reward_description,
        metric_type=req.metric_type,
        target_value=req.target_value,
        deadline=deadline,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return {"id": str(goal.id), "message": "奖励目标已创建"}


@router.get("/reward-goals")
async def get_reward_goals(
    student_id: str | None = None,
    status: str | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get reward goals (parent sees own, student sees own)."""
    if current_user.user_type == "PARENT":
        query = select(RewardGoal).where(RewardGoal.parent_id == current_user.id)
    elif current_user.user_type == "STUDENT":
        query = select(RewardGoal).where(RewardGoal.student_id == current_user.id)
    else:
        raise HTTPException(403, detail="仅家长和同学可访问")

    if student_id:
        query = query.where(RewardGoal.student_id == student_id)
    if status:
        query = query.where(RewardGoal.status == status)
    query = query.order_by(RewardGoal.created_at.desc()).limit(50)

    r = await db.execute(query)
    goals = r.scalars().all()
    return [
        {
            "id": str(g.id),
            "student_id": str(g.student_id),
            "title": g.title,
            "description": g.description,
            "reward_description": g.reward_description,
            "metric_type": g.metric_type,
            "target_value": g.target_value,
            "current_value": g.current_value,
            "status": g.status,
            "deadline": g.deadline.isoformat() if g.deadline else None,
            "completed_at": g.completed_at.isoformat() if g.completed_at else None,
            "is_reward_claimed": g.is_reward_claimed,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        }
        for g in goals
    ]


@router.put("/reward-goals/{goal_id}/claim")
async def claim_reward(
    goal_id: str,
    current_user=Depends(require_role("PARENT")),
    db: AsyncSession = Depends(get_db),
):
    """Parent marks reward as claimed."""
    r = await db.execute(
        select(RewardGoal).where(
            RewardGoal.id == goal_id,
            RewardGoal.parent_id == current_user.id,
        )
    )
    goal = r.scalar_one_or_none()
    if not goal:
        raise HTTPException(404, detail="未找到该目标")
    if goal.status != "COMPLETED":
        raise HTTPException(400, detail="目标尚未完成")

    goal.is_reward_claimed = True
    goal.claimed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "奖励已确认领取"}


# ─── Celebrations ────────────────────────────────────────

@router.get("/celebrations")
async def get_celebrations(
    student_id: str | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get celebration events."""
    if current_user.user_type == "PARENT":
        # Parent sees celebrations for linked students
        r = await db.execute(
            select(ParentStudentLink.student_id).where(
                ParentStudentLink.parent_id == current_user.id,
                ParentStudentLink.is_active == True,
            )
        )
        linked_ids = [row[0] for row in r.all()]
        if not linked_ids:
            return []
        query = select(CelebrationEvent).where(CelebrationEvent.student_id.in_(linked_ids))
    elif current_user.user_type == "STUDENT":
        query = select(CelebrationEvent).where(CelebrationEvent.student_id == current_user.id)
    else:
        raise HTTPException(403, detail="仅家长和同学可访问")

    if student_id:
        query = query.where(CelebrationEvent.student_id == student_id)
    query = query.order_by(CelebrationEvent.created_at.desc()).limit(50)

    r = await db.execute(query)
    events = r.scalars().all()
    return [
        {
            "id": str(e.id),
            "student_id": str(e.student_id),
            "event_type": e.event_type,
            "title": e.title,
            "description": e.description,
            "metric_value": e.metric_value,
            "parent_notified": e.parent_notified,
            "parent_acknowledged": e.parent_acknowledged,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]


# ─── Positive Stats (Parent View) ────────────────────────

@router.get("/positive-stats/{student_id}")
async def get_positive_stats(
    student_id: str,
    current_user=Depends(require_role("PARENT")),
    db: AsyncSession = Depends(get_db),
):
    """Get positive-only stats for a linked student. No scores or mistake details."""
    # Verify link
    r = await db.execute(
        select(ParentStudentLink).where(
            ParentStudentLink.parent_id == current_user.id,
            ParentStudentLink.student_id == student_id,
            ParentStudentLink.is_active == True,
        )
    )
    if not r.scalar_one_or_none():
        raise HTTPException(403, detail="未关联该学生")

    # Total completed papers (effort metric)
    completed_r = await db.execute(
        select(func.count(func.distinct(AnswerSubmission.exam_paper_id))).where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
        )
    )
    completed_papers = completed_r.scalar() or 0

    # Accuracy trend (last 5 submissions)
    trend_r = await db.execute(
        select(AnswerSubmission.percentage).where(
            AnswerSubmission.student_id == student_id,
            AnswerSubmission.status.in_(["GRADED", "GENERATED", "RE_GRADED"]),
            AnswerSubmission.percentage.isnot(None),
        ).order_by(AnswerSubmission.submitted_at.desc()).limit(5)
    )
    recent_scores = [float(row[0]) for row in trend_r.all()]
    accuracy_trend = list(reversed(recent_scores))  # oldest first

    # Errors cleared count
    cleared_r = await db.execute(
        select(func.count()).select_from(ErrorNotebook).where(
            ErrorNotebook.student_id == student_id,
            ErrorNotebook.status == "MASTERED",
        )
    )
    errors_cleared = cleared_r.scalar() or 0

    # Active reward goals
    active_goals_r = await db.execute(
        select(func.count()).select_from(RewardGoal).where(
            RewardGoal.student_id == student_id,
            RewardGoal.status == "ACTIVE",
        )
    )
    active_goals = active_goals_r.scalar() or 0

    # Unread encouragements count
    unread_r = await db.execute(
        select(func.count()).select_from(Encouragement).where(
            Encouragement.student_id == student_id,
            Encouragement.is_read == False,
        )
    )
    unread_encouragements = unread_r.scalar() or 0

    # Celebration count
    celeb_r = await db.execute(
        select(func.count()).select_from(CelebrationEvent).where(
            CelebrationEvent.student_id == student_id,
        )
    )
    celebration_count = celeb_r.scalar() or 0

    return {
        "completed_papers": completed_papers,
        "accuracy_trend": accuracy_trend,
        "errors_cleared": errors_cleared,
        "active_reward_goals": active_goals,
        "unread_encouragements": unread_encouragements,
        "celebration_count": celebration_count,
    }
