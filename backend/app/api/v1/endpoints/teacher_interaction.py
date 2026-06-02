"""Teacher interaction endpoints — student feedback + class announcements to parents."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from app.db.session import get_db
from app.core.security import require_role
from app.models.admin import Admin
from app.models.student import Student
from app.models.parent_student_link import ParentStudentLink
from app.services.notification_service import NotificationService

router = APIRouter()


class TeacherFeedbackRequest(BaseModel):
    student_id: str
    feedback: str = Field(..., min_length=1, max_length=500)


class ClassAnnouncementRequest(BaseModel):
    class_id: str
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=1000)


@router.post("/feedback")
async def send_teacher_feedback(
    req: TeacherFeedbackRequest,
    current_user=Depends(require_role("TEACHER", "QUESTION_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Teacher sends feedback/评语 to a student."""
    # Get teacher name
    r = await db.execute(select(Admin).where(Admin.id == current_user.id))
    teacher = r.scalar_one_or_none()
    teacher_name = teacher.full_name if teacher else "老师"

    # Verify student exists
    r = await db.execute(select(Student).where(Student.id == req.student_id))
    student = r.scalar_one_or_none()
    if not student:
        raise HTTPException(404, detail="学生不存在")

    await NotificationService.create_teacher_feedback_notification(
        db, req.student_id, teacher_name, req.feedback,
    )
    return {"message": f"已向{student.full_name}发送评语"}


@router.post("/class-announcement")
async def send_class_announcement(
    req: ClassAnnouncementRequest,
    current_user=Depends(require_role("TEACHER", "QUESTION_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Teacher sends announcement to all parents of students in a class."""
    from app.models.school_class import SchoolClass, class_students

    # Verify teacher owns the class
    r = await db.execute(
        select(SchoolClass).where(
            SchoolClass.id == req.class_id,
            SchoolClass.teacher_id == current_user.id,
        )
    )
    cls = r.scalar_one_or_none()
    if not cls:
        raise HTTPException(404, detail="班级不存在或无权操作")

    # Get teacher name
    r = await db.execute(select(Admin).where(Admin.id == current_user.id))
    teacher = r.scalar_one_or_none()
    teacher_name = teacher.full_name if teacher else "老师"

    # Get all students in the class
    r = await db.execute(
        select(class_students.c.student_id).where(class_students.c.class_id == req.class_id)
    )
    student_ids = [row[0] for row in r.all()]
    if not student_ids:
        raise HTTPException(400, detail="该班级没有学生")

    # Send to all linked parents of class students + students themselves
    count = 0
    for sid in student_ids:
        # Notify student
        try:
            await NotificationService.create_class_announcement_notification(
                db, sid, teacher_name, cls.name, req.title, req.content,
            )
            count += 1
        except Exception:
            pass

        # Notify linked parents
        r = await db.execute(
            select(ParentStudentLink.parent_id).where(
                ParentStudentLink.student_id == sid,
                ParentStudentLink.is_active == True,
            )
        )
        for row in r.all():
            try:
                await NotificationService.create_class_announcement_notification(
                    db, row[0], teacher_name, cls.name, req.title, req.content,
                )
                count += 1
            except Exception:
                pass

    return {"message": f"已向{count}人发送班级通知", "count": count}
