import uuid, json
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
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
    exam_paper_id: str = Body(None, embed=True),
):
    # Check submission status before generating
    from app.models.answer_submission import AnswerSubmission
    sub_result = await db.execute(
        select(AnswerSubmission).where(
            AnswerSubmission.student_id == uuid.UUID(current_user.id),
            AnswerSubmission.exam_paper_id == uuid.UUID(exam_paper_id) if exam_paper_id else None,
        ).order_by(AnswerSubmission.submitted_at.desc()).limit(1)
    )
    submission = sub_result.scalar_one_or_none()
    if submission and submission.status == "已生成":
        raise HTTPException(status_code=400, detail="错题本已生成，请先修改试卷状态后再重新生成")

    book = await generate_mistake_book(current_user.id, db, exam_paper_id=exam_paper_id)
    if not book:
        raise HTTPException(status_code=404, detail="没有错题可生成错题本")

    # Mark submission as 已生成
    if submission:
        submission.status = "已生成"
        await db.commit()

    return book


@router.get("/{notebook_id}")
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

    # Build enriched question list
    questions_data = []
    if book.questions:
        qids = [q.original_question_id for q in book.questions]
        q_result = await db.execute(select(Question).where(Question.id.in_(qids)))
        questions_map = {str(q.id): q for q in q_result.scalars().all()}

        # Load practice questions too
        pqids = [q.practice_question_id for q in book.questions if q.practice_question_id]
        pq_map = {}
        if pqids:
            pq_result = await db.execute(select(Question).where(Question.id.in_(pqids)))
            pq_map = {str(q.id): q for q in pq_result.scalars().all()}

        from app.models.answer_detail import AnswerDetail
        student_answers = {}
        if qids:
            ad_result = await db.execute(
                select(AnswerDetail.question_id, AnswerDetail.student_answer).where(
                    AnswerDetail.question_id.in_(qids)
                ).order_by(AnswerDetail.created_at.desc())
            )
            for row in ad_result:
                qid = str(row[0])
                if qid not in student_answers:
                    student_answers[qid] = row[1]

        for item in book.questions:
            q = questions_map.get(str(item.original_question_id))
            q_title = q.title if q else None
            ca = None
            if q:
                try:
                    data = json.loads(q.correct_answer or '{}')
                    if isinstance(data.get('correct_answer'), list):
                        ca = ', '.join(str(x) for x in data['correct_answer'])
                    elif isinstance(data.get('correct_answer'), str):
                        ca = data['correct_answer']
                    elif isinstance(data.get('correct_answer'), dict):
                        ca = ', '.join(data['correct_answer'].get('keywords', []))
                except Exception:
                    ca = q.correct_answer

            sa = None
            if item.explanation and '学生答案:' in item.explanation:
                parts = item.explanation.split('正确答案:')
                sa = parts[0].replace('学生答案:', '').strip() or None
            if not sa:
                sa = student_answers.get(str(item.original_question_id))

            questions_data.append({
                "id": str(item.id),
                "error_notebook_id": str(item.error_notebook_id),
                "original_question_id": str(item.original_question_id),
                "practice_question_id": str(item.practice_question_id) if item.practice_question_id else None,
                "error_type": item.error_type,
                "explanation": item.explanation,
                "question_title": q_title,
                "correct_answer": ca,
                "student_answer": sa,
                "practice_question": pq_map[str(item.practice_question_id)].title if item.practice_question_id and str(item.practice_question_id) in pq_map else None,
            })

    return {
        "id": str(book.id),
        "student_id": str(book.student_id),
        "title": book.title,
        "description": book.description,
        "exam_paper_id": str(book.exam_paper_id) if book.exam_paper_id else None,
        "question_count": book.question_count,
        "status": book.status,
        "generated_at": book.generated_at.isoformat() if book.generated_at else None,
        "created_at": book.created_at.isoformat() if book.created_at else None,
        "updated_at": book.updated_at.isoformat() if book.updated_at else None,
        "questions": questions_data,
    }


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
    # Delete child records first (FK constraint)
    await db.execute(delete(ErrorNotebookQuestion).where(ErrorNotebookQuestion.error_notebook_id == notebook_id))
    await db.delete(book)
    await db.commit()
    return {"message": "已删除"}


@router.post("/{notebook_id}/practice")
async def generate_notebook_practice(
    notebook_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate practice questions via LLM for each mistake in the notebook."""
    try:
        result = await db.execute(
            select(ErrorNotebook)
            .where(ErrorNotebook.id == notebook_id)
            .options(selectinload(ErrorNotebook.questions))
        )
        book = result.scalar_one_or_none()
        if not book:
            raise HTTPException(status_code=404, detail="错题本不存在")
        if str(book.student_id) != str(current_user.id) and current_user.user_type not in ("SYS_ADMIN", "QUESTION_ADMIN"):
            raise HTTPException(status_code=403, detail="权限不足")

        if not book.questions:
            raise HTTPException(status_code=400, detail="错题本为空")

        qids = [q.original_question_id for q in book.questions]
        q_result = await db.execute(select(Question).where(Question.id.in_(qids)))
        questions_map = {str(q.id): q for q in q_result.scalars().all()}

        from app.models.answer_detail import AnswerDetail
        sa_map = {}
        if qids:
            ad_result = await db.execute(
                select(AnswerDetail.question_id, AnswerDetail.student_answer)
                .where(AnswerDetail.question_id.in_(qids))
                .order_by(AnswerDetail.created_at.desc())
            )
            for row in ad_result:
                qid = str(row[0])
                if qid not in sa_map:
                    sa_map[qid] = row[1]

        # Get a valid admin ID for question ownership
        from app.models.admin import Admin
        admin_result = await db.execute(select(Admin.id).limit(1))
        admin_id = admin_result.scalar_one_or_none()
        if not admin_id:
            raise HTTPException(status_code=500, detail="系统中没有管理员账号")

        from app.services.llm_service import generate_practice_question
        generated = 0
        failed = 0

        for entry in book.questions:
            if entry.practice_question_id:
                continue

            q = questions_map.get(str(entry.original_question_id))
            if not q:
                continue

            sa = sa_map.get(str(entry.original_question_id)) or ""
            ca = ""
            try:
                data = json.loads(q.correct_answer or '{}')
                if isinstance(data.get('correct_answer'), list):
                    ca = ', '.join(str(x) for x in data['correct_answer'])
                elif isinstance(data.get('correct_answer'), str):
                    ca = data['correct_answer']
                elif isinstance(data.get('correct_answer'), dict):
                    ca = ', '.join(data['correct_answer'].get('keywords', []))
            except Exception:
                ca = q.correct_answer or ""

            llm_result = await generate_practice_question(
                original_title=q.title or "",
                correct_answer=ca,
                student_answer=sa,
                error_type=entry.error_type or "概念错误",
                question_type=q.question_type or "SINGLE_CHOICE",
                difficulty=q.difficulty or "MEDIUM",
                subject=q.subject or "数学",
                grade_level=(q.grade_level or "八年级"),
            )

            if llm_result.get("ok") and llm_result.get("question"):
                pq_data = llm_result["question"]
                pq = Question(
                    title=pq_data.get("title", ""),
                    question_type=pq_data.get("question_type", q.question_type),
                    difficulty=pq_data.get("difficulty", q.difficulty),
                    subject=pq_data.get("subject", q.subject),
                    grade_level=pq_data.get("grade_level", q.grade_level),
                    score=5,
                    correct_answer=json.dumps(pq_data.get("correct_answer", {}), ensure_ascii=False),
                    explanation=pq_data.get("explanation", ""),
                    source="LLM_PRACTICE",
                    review_status="APPROVED",
                    created_by=admin_id,
                    is_active=True,
                )
                db.add(pq)
                await db.flush()
                entry.practice_question_id = pq.id
                generated += 1
            else:
                failed += 1

        await db.commit()
        return {"ok": True, "generated": generated, "failed": failed, "total": len(book.questions)}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("!!! PRACTICE ERROR:", e, flush=True)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
