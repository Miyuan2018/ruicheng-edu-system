import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.error_notebook import ErrorNotebook
from app.models.error_notebook_question import ErrorNotebookQuestion
from app.models.question import Question
from app.schemas.error_notebook import ErrorNotebookResponse
from typing import List
from app.core.security import get_current_user
from app.services.mistake_service import generate_mistake_book

router = APIRouter()


@router.post("/generate", response_model=ErrorNotebookResponse)
async def generate_error_notebook(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    exam_paper_id: str = None,
):
    book = await generate_mistake_book(current_user.id, db, exam_paper_id=exam_paper_id)
    if not book:
        raise HTTPException(status_code=404, detail="没有错题可生成错题本")
    return book


@router.get("/{notebook_id}", response_model=ErrorNotebookResponse)
async def get_error_notebook(
    notebook_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ErrorNotebook)
        .where(ErrorNotebook.id == notebook_id)
        .options(selectinload(ErrorNotebook.questions))
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="错题本不存在")
    if str(book.student_id) != str(current_user.id) and current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    return book


@router.get("/student/{student_id}", response_model=List[ErrorNotebookResponse])
async def get_student_error_notebooks(
    student_id: uuid.UUID,
    date_from: str = Query(None),
    date_to: str = Query(None),
    paper_id: str = Query(None),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if str(student_id) != str(current_user.id) and current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    query = select(ErrorNotebook).where(ErrorNotebook.student_id == student_id)
    if date_from:
        query = query.where(ErrorNotebook.generated_at >= date_from)
    if date_to:
        query = query.where(ErrorNotebook.generated_at <= date_to + " 23:59:59")
    if paper_id:
        query = query.where(ErrorNotebook.exam_paper_id == uuid.UUID(paper_id))
    query = query.order_by(ErrorNotebook.generated_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.delete("/{notebook_id}")
async def delete_error_notebook(
    notebook_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ErrorNotebook).where(ErrorNotebook.id == notebook_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="错题本不存在")
    if str(book.student_id) != str(current_user.id) and current_user.user_type not in ("SYS_ADMIN", "QUESTION_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    await db.delete(book)
    await db.commit()
    return {"message": "已删除"}


@router.get("/{notebook_id}/export/pdf")
async def export_notebook_pdf(
    notebook_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ErrorNotebook).where(ErrorNotebook.id == notebook_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="错题本不存在")

    # Generate simple text export (Word/PDF generation via python-docx/WeasyPrint to come)
    entries = await db.execute(
        select(ErrorNotebookQuestion).where(ErrorNotebookQuestion.error_notebook_id == notebook_id)
    )
    entries_list = entries.scalars().all()

    text = f"错题本: {book.title}\n生成时间: {book.generated_at}\n\n"
    for i, entry in enumerate(entries_list):
        qr = await db.execute(select(Question).where(Question.id == entry.original_question_id))
        q = qr.scalar_one_or_none()
        text += f"{i+1}. {q.title if q else '未知题目'}\n"
        text += f"   错误类型: {entry.error_type or '未分类'}\n"
        text += f"   解析: {entry.explanation or '无'}\n"
        if entry.practice_question_id:
            pr = await db.execute(select(Question).where(Question.id == entry.practice_question_id))
            pq = pr.scalar_one_or_none()
            if pq:
                text += f"   强化练习: {pq.title}\n"
        text += "\n"

    return Response(content=text, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=mistake_book_{notebook_id}.txt"
    })


@router.get("/{notebook_id}/export/word")
async def export_notebook_word(
    notebook_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await export_notebook_pdf(notebook_id, current_user, db)


@router.get("/stats/student/{student_id}")
async def get_student_stats(
    student_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if str(student_id) != str(current_user.id) and current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    result = await db.execute(
        select(ErrorNotebook).where(ErrorNotebook.student_id == student_id)
    )
    books = result.scalars().all()
    total_questions = sum(b.question_count or 0 for b in books)
    return {"total_notebooks": len(books), "total_wrong_questions": total_questions}


@router.get("/stats/class/{class_id}")
async def get_class_stats(
    class_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    return {"class_id": str(class_id), "total_notebooks": 0, "total_wrong_questions": 0}


@router.post("/manual-entry")
async def manual_entry_mistake(
    question_title: str = Body(...),
    question_type: str = Body("FILL_BLANK"),
    subject: str = Body(""),
    student_answer: str = Body(""),
    correct_answer: str = Body(""),
    error_type: str = Body("概念错误"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Quick entry: create an ErrorNotebook with a single mistake from scan/manual input."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(status_code=403, detail="仅学生可用")

    # Create a minimal question for the mistake
    from app.models.question import Question as QModel
    q = QModel(
        title=question_title, question_type=question_type,
        difficulty="MEDIUM", subject=subject or "未分类",
        score=5, correct_answer=correct_answer or "",
        explanation="", source="MANUAL", review_status="APPROVED",
        created_by=uuid.UUID(current_user.id),
    )
    db.add(q)
    await db.flush()

    # Create notebook
    from datetime import datetime
    now = datetime.now()
    notebook = ErrorNotebook(
        student_id=uuid.UUID(current_user.id),
        title=f"手动录入 - {now.strftime('%Y年%m月%d日 %H:%M')}",
        question_count=1, status="GENERATED",
    )
    db.add(notebook)
    await db.flush()

    # Create entry
    entry = ErrorNotebookQuestion(
        error_notebook_id=notebook.id,
        original_question_id=q.id,
        error_type=error_type,
        explanation=f"学生答案: {student_answer}\n正确答案: {correct_answer}",
    )
    db.add(entry)
    await db.commit()
    return {"ok": True, "notebook_id": str(notebook.id), "message": "错题已录入"}
