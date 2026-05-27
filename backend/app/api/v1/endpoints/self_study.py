import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.session import get_db
from app.models.self_study_task import SelfStudyTask
from app.models.knowledge_point_model import KnowledgePointModel
from app.models.ml_model import MlModel
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


@router.post("/knowledge-points/extract")
async def extract_knowledge_points(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only teachers and admins can extract knowledge points
    if current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Implement knowledge point extraction functionality
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Knowledge point extraction functionality not yet implemented",
    )


@router.get("/knowledge-points", response_model=List[dict])
async def get_knowledge_points(
    skip: int = 0,
    limit: int = 20,
    subject: Optional[str] = None,
    grade_level: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 200)
    # Only teachers and admins can access knowledge points
    if current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    query = select(KnowledgePointModel)

    # Apply filters
    if subject:
        query = query.where(KnowledgePointModel.subject == subject)
    if grade_level:
        query = query.where(KnowledgePointModel.grade_level == grade_level)

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    knowledge_points = result.scalars().all()
    return [
        {
            "id": str(kp.id),
            "source_url": kp.source_url,
            "source_title": kp.source_title,
            "content_hash": kp.content_hash,
            "extracted_knowledge_points": kp.extracted_knowledge_points,
            "confidence_score": float(kp.confidence_score) if kp.confidence_score else None,
            "subject": kp.subject,
            "grade_level": kp.grade_level,
            "created_at": kp.created_at,
            "updated_at": kp.updated_at,
        }
        for kp in knowledge_points
    ]


@router.get("/knowledge-points/{kp_id}", response_model=dict)
async def get_knowledge_point(
    kp_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only teachers and admins can access knowledge points
    if current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(select(KnowledgePointModel).where(KnowledgePointModel.id == kp_id))
    knowledge_point = result.scalar_one_or_none()
    if not knowledge_point:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge point not found",
        )

    return {
        "id": str(knowledge_point.id),
        "source_url": knowledge_point.source_url,
        "source_title": knowledge_point.source_title,
        "content_hash": knowledge_point.content_hash,
        "extracted_knowledge_points": knowledge_point.extracted_knowledge_points,
        "confidence_score": float(knowledge_point.confidence_score) if knowledge_point.confidence_score else None,
        "subject": knowledge_point.subject,
        "grade_level": knowledge_point.grade_level,
        "created_at": knowledge_point.created_at,
        "updated_at": knowledge_point.updated_at,
    }


@router.post("/questions/generate")
async def generate_questions(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only teachers and admins can generate questions
    if current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Implement question generation functionality
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Question generation functionality not yet implemented",
    )


@router.get("/questions/generate-status/{generation_id}")
async def get_question_generation_status(
    generation_id: uuid.UUID,
    current_user = Depends(get_current_user),
):
    # Only teachers and admins can access question generation status
    if current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Implement question generation status retrieval
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Question generation status functionality not yet implemented",
    )


@router.post("/model/train")
async def train_model(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only admins can trigger model training
    if current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Implement model training functionality
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Model training functionality not yet implemented",
    )


@router.get("/model/train-status/{train_id}")
async def get_model_train_status(
    train_id: uuid.UUID,
    current_user = Depends(get_current_user),
):
    # Only admins can access model training status
    if current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Implement model training status retrieval
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Model training status functionality not yet implemented",
    )


@router.get("/model/train-history")
async def get_model_train_history(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only admins can access model training history
    if current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Implement model training history retrieval
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Model training history functionality not yet implemented",
    )


@router.post("/data/sync")
async def sync_data(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only admins can trigger data synchronization
    if current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Implement data synchronization functionality
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Data synchronization functionality not yet implemented",
    )


@router.get("/data/sync-status/{sync_id}")
async def get_data_sync_status(
    sync_id: uuid.UUID,
    current_user = Depends(get_current_user),
):
    # Only admins can access data synchronization status
    if current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Implement data synchronization status retrieval
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Data synchronization status functionality not yet implemented",
    )