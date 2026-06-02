import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.explanation_session import ExplanationSession
from app.models.explanation_step import ExplanationStep
from app.schemas.explanation import (
    ExplanationSessionResponse,
    ExplanationSessionSummary,
    ExplanationSessionCreate,
)
from typing import List, Optional
from app.core.security import get_current_user

router = APIRouter()


# ── GET /topic-board ─────────────────────────────────────────────────────────
@router.get("", response_model=List[ExplanationSessionSummary])
async def list_active_sessions(
    skip: int = 0,
    limit: int = 50,
    topic: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 200)
    query = select(ExplanationSession).where(ExplanationSession.is_active == True)

    if topic:
        query = query.where(ExplanationSession.topic == topic)

    query = query.order_by(ExplanationSession.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().all()
    return sessions


# ── GET /topic-board/by-question/{question_id} ────────────────────────────────
# NOTE: must be registered before /{session_id} to avoid route collision.
@router.get("/by-question/{question_id}", response_model=ExplanationSessionResponse)
async def get_session_by_question(
    question_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ExplanationSession)
        .options(selectinload(ExplanationSession.steps))
        .where(
            ExplanationSession.question_id == question_id,
            ExplanationSession.is_active == True,
        )
    )
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Explanation session not found for this question",
        )
    return session


# ── GET /topic-board/{session_id} ────────────────────────────────────────────
@router.get("/{session_id}", response_model=ExplanationSessionResponse)
async def get_session(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ExplanationSession)
        .options(selectinload(ExplanationSession.steps))
        .where(ExplanationSession.id == str(session_id))
    )
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Explanation session not found",
        )
    return session


# ── POST /topic-board ────────────────────────────────────────────────────────
@router.post("", response_model=ExplanationSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_in: ExplanationSessionCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    session_data = session_in.model_dump(exclude={"steps"}, exclude_unset=True)
    if current_user.user_type in ("TEACHER", "QUESTION_ADMIN"):
        session_data["created_by"] = current_user.id

    session = ExplanationSession(**session_data)
    db.add(session)
    await db.flush()  # populate session.id before creating steps

    for step_in in session_in.steps:
        step = ExplanationStep(
            session_id=session.id,
            step_order=step_in.step_order,
            text=step_in.text,
            panda_emotion=step_in.panda_emotion,
            board_line=step_in.board_line,
        )
        db.add(step)

    await db.commit()

    # Re-fetch with steps eagerly loaded for the response
    query = (
        select(ExplanationSession)
        .options(selectinload(ExplanationSession.steps))
        .where(ExplanationSession.id == session.id)
    )
    result = await db.execute(query)
    return result.scalar_one()


# ── PUT /topic-board/{session_id} ────────────────────────────────────────────
@router.put("/{session_id}", response_model=ExplanationSessionResponse)
async def update_session(
    session_id: uuid.UUID,
    session_in: ExplanationSessionCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing explanation session and its steps."""
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    result = await db.execute(
        select(ExplanationSession).where(ExplanationSession.id == str(session_id))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Explanation session not found")
    
    # Update session fields
    session.title = session_in.title
    session.topic = session_in.topic
    session.difficulty_label = session_in.difficulty_label
    session.problem_statement = session_in.problem_statement
    session.graph_config = session_in.graph_config
    session.question_id = session_in.question_id
    
    # Delete old steps (cascade would handle this, but we do it explicitly for clarity)
    old_steps = await db.execute(
        select(ExplanationStep).where(ExplanationStep.session_id == session.id)
    )
    for step in old_steps.scalars().all():
        await db.delete(step)
    await db.flush()
    
    # Create new steps
    for step_in in session_in.steps:
        step = ExplanationStep(
            session_id=session.id,
            step_order=step_in.step_order,
            text=step_in.text,
            panda_emotion=step_in.panda_emotion,
            board_line=step_in.board_line,
        )
        db.add(step)
    
    await db.commit()
    
    # Re-fetch with steps
    query = (
        select(ExplanationSession)
        .options(selectinload(ExplanationSession.steps))
        .where(ExplanationSession.id == session.id)
    )
    result = await db.execute(query)
    return result.scalar_one()


# ── DELETE /topic-board/{session_id} ─────────────────────────────────────────
@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(
        select(ExplanationSession).where(ExplanationSession.id == str(session_id))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Explanation session not found",
        )

    session.is_active = False
    await db.commit()
    return None
