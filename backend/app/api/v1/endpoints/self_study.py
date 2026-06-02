import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.session import get_db
from app.models.self_study_task import SelfStudyTask
from app.schemas.self_study import SelfStudyTaskCreate, SelfStudyTaskResponse, SelfStudyTaskUpdate
from typing import List, Optional
from app.core.security import get_current_user

router = APIRouter()


@router.post("/tasks", response_model=SelfStudyTaskResponse)
async def create_self_study_task(
    task_in: SelfStudyTaskCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Students can only create tasks for themselves
    if str(task_in.student_id) != current_user.id and current_user.user_type not in ("TEACHER", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    data = task_in.dict()
    data['student_id'] = str(data['student_id'])
    self_study_task = SelfStudyTask(**data)
    db.add(self_study_task)
    await db.commit()
    await db.refresh(self_study_task)
    return self_study_task


@router.get("/tasks/{task_id}", response_model=SelfStudyTaskResponse)
async def get_self_study_task(
    task_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SelfStudyTask).where(SelfStudyTask.id == task_id))
    self_study_task = result.scalar_one_or_none()
    if not self_study_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Self-study task not found",
        )

    # Check if user is the owner of the self-study task or is a teacher/admin
    if self_study_task.student_id != current_user.id and current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    return self_study_task


@router.put("/tasks/{task_id}", response_model=SelfStudyTaskResponse)
async def update_self_study_task(
    task_id: uuid.UUID,
    task_in: SelfStudyTaskUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SelfStudyTask).where(SelfStudyTask.id == task_id))
    self_study_task = result.scalar_one_or_none()
    if not self_study_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Self-study task not found",
        )

    # Students can only update their own tasks; teachers/admins can update any
    if current_user.user_type == "STUDENT" and self_study_task.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    if current_user.user_type not in ("STUDENT", "TEACHER", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    update_data = task_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(self_study_task, field, value)

    await db.commit()
    await db.refresh(self_study_task)
    return self_study_task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_self_study_task(
    task_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SelfStudyTask).where(SelfStudyTask.id == task_id))
    self_study_task = result.scalar_one_or_none()
    if not self_study_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Self-study task not found",
        )

    # Students can only delete their own tasks; teachers/admins can delete any
    if current_user.user_type == "STUDENT" and self_study_task.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    if current_user.user_type not in ("STUDENT", "TEACHER", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    await db.execute(delete(SelfStudyTask).where(SelfStudyTask.id == task_id))
    await db.commit()
    return None


@router.get("/tasks", response_model=List[SelfStudyTaskResponse])
async def get_self_study_tasks(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    subject: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 200)
    query = select(SelfStudyTask)

    # Students see only their own tasks; teachers/admins see all
    if current_user.user_type == "STUDENT":
        query = query.where(SelfStudyTask.student_id == current_user.id)
    elif current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    if status:
        query = query.where(SelfStudyTask.status == status)
    if subject:
        query = query.where(SelfStudyTask.subject == subject)

    query = query.offset(skip).limit(limit).order_by(SelfStudyTask.created_at.desc())
    result = await db.execute(query)
    self_study_tasks = result.scalars().all()
    return self_study_tasks


