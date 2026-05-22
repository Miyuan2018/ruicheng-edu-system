import uuid
import json
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, text as sa_text
from app.db.session import get_db
from app.models.exam_paper import ExamPaper
from app.models.question import Question
from app.schemas.exam_paper import ExamPaperCreate, ExamPaperResponse, ExamPaperUpdate
from app.models.exam_paper import exam_paper_questions
from app.schemas.question import QuestionResponse
from typing import List, Optional
from app.core.security import get_current_user

router = APIRouter()


@router.post("", response_model=ExamPaperResponse)
async def create_exam_paper(
    exam_paper_in: ExamPaperCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")

    data = exam_paper_in.model_dump(exclude_none=True)
    questions_data = data.pop("questions", []) if isinstance(data.get("questions"), list) else []
    # Remove extra fields not in ExamPaper model
    for key in ["question_count", "distribution", "difficulty_ratio"]:
        data.pop(key, None)
    data["created_by"] = uuid.UUID(current_user.id)
    exam_paper = ExamPaper(**data)
    db.add(exam_paper)
    await db.flush()

    # Import questions if provided
    for i, qdata in enumerate(questions_data):
        q = Question(
            title=qdata.get("title", ""),
            question_type=qdata.get("question_type", "SINGLE_CHOICE"),
            difficulty=qdata.get("difficulty", "MEDIUM"),
            subject=qdata.get("subject", exam_paper.subject),
            grade_level=qdata.get("grade_level", exam_paper.grade_level),
            score=qdata.get("score", 5),
            correct_answer=qdata.get("correct_answer", ""),
            explanation=qdata.get("explanation", ""),
            source="MANUAL", review_status="APPROVED",
            created_by=uuid.UUID(current_user.id),
        )
        db.add(q)
        await db.flush()
        # Link to paper
        await db.execute(exam_paper_questions.insert().values(
            id=uuid.uuid4(), exam_paper_id=exam_paper.id,
            question_id=q.id, position=i+1, score=qdata.get("score", 5),
        ))

    await db.commit()
    await db.refresh(exam_paper)
    return exam_paper


@router.get("/{exam_paper_id}", response_model=ExamPaperResponse)
async def get_exam_paper(
    exam_paper_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ExamPaper).where(ExamPaper.id == exam_paper_id))
    exam_paper = result.scalar_one_or_none()
    if not exam_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam paper not found",
        )
    return exam_paper


@router.put("/{exam_paper_id}", response_model=ExamPaperResponse)
async def update_exam_paper(
    exam_paper_id: uuid.UUID,
    exam_paper_in: ExamPaperUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only teachers and admins can update exam papers
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(select(ExamPaper).where(ExamPaper.id == exam_paper_id))
    exam_paper = result.scalar_one_or_none()
    if not exam_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam paper not found",
        )

    # Check if user is the creator or is an admin
    if exam_paper.created_by != uuid.UUID(current_user.id) and current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Update exam paper
    update_data = exam_paper_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(exam_paper, field, value)

    await db.commit()
    await db.refresh(exam_paper)
    return exam_paper


@router.delete("/{exam_paper_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam_paper(
    exam_paper_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only teachers and admins can delete exam papers
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(select(ExamPaper).where(ExamPaper.id == exam_paper_id))
    exam_paper = result.scalar_one_or_none()
    if not exam_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam paper not found",
        )

    # Check if user is the creator or is an admin
    if exam_paper.created_by != uuid.UUID(current_user.id) and current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    await db.execute(delete(ExamPaper).where(ExamPaper.id == exam_paper_id))
    await db.commit()
    return None


@router.get("")
async def get_exam_papers(
    skip: int = 0,
    limit: int = 100,
    title: Optional[str] = None,
    status: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ExamPaper)
    if title: query = query.where(ExamPaper.title.ilike(f"%{title}%"))
    if status: query = query.where(ExamPaper.status == status)
    query = query.offset(skip).limit(limit).order_by(ExamPaper.created_at.desc())
    result = await db.execute(query)
    papers = result.scalars().all()

    # Compute question_count for each paper
    from sqlalchemy import text as sa_text
    output = []
    for p in papers:
        cnt_result = await db.execute(sa_text("SELECT COUNT(*) FROM exam_paper_questions WHERE exam_paper_id = :pid"), {"pid": p.id.hex})
        qcount = cnt_result.scalar() or 0
        output.append({
            "id": str(p.id), "title": p.title, "subtitle": p.subtitle,
            "subject": p.subject, "grade_level": p.grade_level,
            "total_score": p.total_score, "duration_minutes": p.duration_minutes,
            "status": p.status, "question_count": qcount,
            "instructions": p.instructions, "description": p.description,
            "created_at": p.created_at, "updated_at": p.updated_at,
        })
    return output


@router.post("/{exam_paper_id}/questions")
async def add_question_to_exam_paper(
    exam_paper_id: uuid.UUID,
    question_id: uuid.UUID = Body(...),
    position: int = Body(1),
    score: int = Body(10),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only teachers and admins can add questions to exam papers
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Check if exam paper exists
    result = await db.execute(select(ExamPaper).where(ExamPaper.id == exam_paper_id))
    exam_paper = result.scalar_one_or_none()
    if not exam_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam paper not found",
        )

    # Check if question exists
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    # Check if user is the creator of the exam paper or is an admin
    if exam_paper.created_by != uuid.UUID(current_user.id) and current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Insert into association table
    await db.execute(exam_paper_questions.insert().values(
        id=uuid.uuid4(), exam_paper_id=exam_paper.id,
        question_id=question.id, position=position, score=score,
    ))

    await db.commit()
    await db.refresh(exam_paper)
    return exam_paper


@router.delete("/{exam_paper_id}/questions/{question_id}", response_model=ExamPaperResponse)
async def remove_question_from_exam_paper(
    exam_paper_id: uuid.UUID,
    question_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only teachers and admins can remove questions from exam papers
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Check if exam paper exists
    result = await db.execute(select(ExamPaper).where(ExamPaper.id == exam_paper_id))
    exam_paper = result.scalar_one_or_none()
    if not exam_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam paper not found",
        )

    # Check if question exists
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    # Check if user is the creator of the exam paper or is an admin
    if exam_paper.created_by != uuid.UUID(current_user.id) and current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Remove question from exam paper (this would require an association table)
    # For now, we'll just return the exam paper as a placeholder
    await db.commit()
    await db.refresh(exam_paper)
    return exam_paper


@router.put("/{exam_paper_id}/questions/sort", response_model=ExamPaperResponse)
async def sort_questions_in_exam_paper(
    exam_paper_id: uuid.UUID,
    question_ids: List[str],
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only teachers and admins can sort questions in exam papers
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Check if exam paper exists
    result = await db.execute(select(ExamPaper).where(ExamPaper.id == exam_paper_id))
    exam_paper = result.scalar_one_or_none()
    if not exam_paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam paper not found",
        )

    # Check if user is the creator of the exam paper or is an admin
    if exam_paper.created_by != uuid.UUID(current_user.id) and current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Sort questions in exam paper (this would require an association table with ordering)
    # For now, we'll just return the exam paper as a placeholder
    await db.commit()
    await db.refresh(exam_paper)
    return exam_paper


@router.get("/{exam_paper_id}/questions")
async def get_questions_in_exam_paper(
    exam_paper_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text as sa_text
    # Get questions through association table
    qresult = await db.execute(
        sa_text("SELECT q.* FROM questions q JOIN exam_paper_questions epq ON q.id = epq.question_id WHERE epq.exam_paper_id = :pid ORDER BY epq.position"),
        {"pid": exam_paper_id.hex}
    )
    questions = qresult.fetchall()
    return [{"id": row[0], "title": row[1], "question_type": row[2], "difficulty": row[3],
             "subject": row[4], "grade_level": row[5], "score": row[6],
             "correct_answer": row[7], "explanation": row[8], "meta_data": row[9],
             "source": row[10], "review_status": row[11]} for row in questions]


async def _get_paper_with_questions(exam_paper_id: uuid.UUID, db: AsyncSession):
    """Fetch paper info and questions, raise 404 if not found."""
    result = await db.execute(select(ExamPaper).where(ExamPaper.id == exam_paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam paper not found")

    qresult = await db.execute(
        sa_text("SELECT q.* FROM questions q JOIN exam_paper_questions epq ON q.id = epq.question_id WHERE epq.exam_paper_id = :pid ORDER BY epq.position"),
        {"pid": exam_paper_id.hex}
    )
    questions = qresult.fetchall()

    TYPE_LABELS = {"FILL_BLANK": "填空题", "SINGLE_CHOICE": "单选题", "MULTIPLE_CHOICE": "多选题", "SUBJECTIVE": "解答题"}
    mapped = []
    for i, row in enumerate(questions):
        qtype = row[2]
        correct_answer = row[7] or ""
        options = None
        answer_text = ""
        try:
            ad = json.loads(correct_answer)
            if isinstance(ad, dict):
                options = ad.get("options")
                answer_text = ad.get("correct_answer", "")
                if isinstance(answer_text, list):
                    answer_text = ", ".join(str(x) for x in answer_text)
                else:
                    answer_text = str(answer_text)
        except (json.JSONDecodeError, TypeError):
            answer_text = correct_answer

        mapped.append({
            "index": i + 1,
            "title": row[1] or "",
            "question_type": qtype,
            "type_label": TYPE_LABELS.get(qtype, qtype),
            "difficulty": row[3] or "",
            "score": row[6] or 0,
            "correct_answer": correct_answer,
            "answer_text": answer_text,
            "options": options,
            "explanation": row[8] or "",
        })
    return paper, mapped


@router.get("/{exam_paper_id}/export/word")
async def export_exam_paper_word(
    exam_paper_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from docx import Document
    from docx.shared import Pt, Inches, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from fastapi.responses import StreamingResponse
    import io

    paper, questions = await _get_paper_with_questions(exam_paper_id, db)

    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "SimSun"
    style.font.size = Pt(11)

    # Title
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title_para.add_run(paper.title or "")
    run.bold = True
    run.font.size = Pt(18)

    # Subtitle / info line
    if paper.subtitle:
        sub_para = doc.add_paragraph()
        sub_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sub_para.add_run(paper.subtitle).font.size = Pt(10)

    info_parts = []
    if paper.subject: info_parts.append(f"学科：{paper.subject}")
    if paper.grade_level: info_parts.append(f"年级：{paper.grade_level}")
    info_parts.append(f"总分：{paper.total_score}分")
    if paper.duration_minutes: info_parts.append(f"时长：{paper.duration_minutes}分钟")
    info_para = doc.add_paragraph()
    info_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    info_para.add_run(" | ".join(info_parts)).font.size = Pt(10)

    # Notes
    if paper.instructions:
        doc.add_paragraph()
        note_para = doc.add_paragraph()
        run = note_para.add_run(f"注意事项：{paper.instructions}")
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(100, 100, 100)

    doc.add_paragraph()  # spacing

    # Group by type
    type_order = ["FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SUBJECTIVE"]
    grouped = {}
    for q in questions:
        t = q["question_type"]
        grouped.setdefault(t, []).append(q)

    for t in type_order:
        qs = grouped.get(t, [])
        if not qs:
            continue
        # Section header
        header = doc.add_paragraph()
        run = header.add_run(f"{qs[0]['type_label']}（共{len(qs)}题）")
        run.bold = True
        run.font.size = Pt(13)

        for q in qs:
            # Question title
            q_para = doc.add_paragraph()
            q_para.add_run(f"{q['index']}. {q['title']}（{q['score']}分）").font.size = Pt(11)

            # Options for choice questions
            if q["options"] and len(q["options"]) > 0:
                for opt in q["options"]:
                    opt_para = doc.add_paragraph()
                    opt_para.paragraph_format.left_indent = Cm(1)
                    opt_para.add_run(f"{opt.get('label', '')}. {opt.get('text', '')}").font.size = Pt(10)

            # Blank line for fill-blank
            if t == "FILL_BLANK":
                blank_para = doc.add_paragraph()
                blank_para.add_run("_" * 40).font.size = Pt(10)

            # Space for subjective
            if t == "SUBJECTIVE":
                for _ in range(3):
                    space_para = doc.add_paragraph()
                    space_para.add_run("_" * 60).font.size = Pt(10)

            doc.add_paragraph()  # spacing

    # Save to BytesIO
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    safe_name = quote((paper.title or 'exam_paper') + '.docx')
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=utf-8''{safe_name}"}
    )


@router.get("/{exam_paper_id}/export/pdf")
async def export_exam_paper_pdf(
    exam_paper_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fpdf import FPDF
    from fastapi.responses import StreamingResponse
    import io

    paper, questions = await _get_paper_with_questions(exam_paper_id, db)

    pdf = FPDF()
    pdf.add_page()
    # Use built-in font that supports CJK - or fallback to ASCII
    pdf.add_font("SimSun", "", "/usr/share/fonts/truetype/arphic/uming.ttc", uni=True)
    pdf.set_font("SimSun", "", 12)

    # Title
    pdf.set_font("SimSun", "", 18)
    pdf.cell(0, 12, paper.title or "", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(4)

    # Info
    pdf.set_font("SimSun", "", 10)
    info_parts = []
    if paper.subject: info_parts.append(f"学科：{paper.subject}")
    if paper.grade_level: info_parts.append(f"年级：{paper.grade_level}")
    info_parts.append(f"总分：{paper.total_score}分")
    if paper.duration_minutes: info_parts.append(f"时长：{paper.duration_minutes}分钟")
    pdf.cell(0, 8, " | ".join(info_parts), new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(6)

    # Questions grouped by type
    type_order = ["FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SUBJECTIVE"]
    grouped = {}
    for q in questions:
        t = q["question_type"]
        grouped.setdefault(t, []).append(q)

    for t in type_order:
        qs = grouped.get(t, [])
        if not qs:
            continue
        pdf.set_font("SimSun", "", 13)
        pdf.cell(0, 10, f"{qs[0]['type_label']}（共{len(qs)}题）", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

        for q in qs:
            pdf.set_font("SimSun", "", 11)
            title_text = f"{q['index']}. {q['title']}（{q['score']}分）"
            pdf.multi_cell(0, 7, title_text)
            pdf.ln(1)

            if q["options"] and len(q["options"]) > 0:
                pdf.set_font("SimSun", "", 10)
                for opt in q["options"]:
                    pdf.cell(10, 6, "")
                    pdf.cell(0, 6, f"{opt.get('label', '')}. {opt.get('text', '')}", new_x="LMARGIN", new_y="NEXT")
                pdf.ln(1)

            if t == "FILL_BLANK":
                pdf.cell(10, 6, "")
                pdf.cell(0, 6, "_" * 40, new_x="LMARGIN", new_y="NEXT")
                pdf.ln(2)

            if t == "SUBJECTIVE":
                for _ in range(3):
                    pdf.cell(10, 8, "")
                    pdf.cell(0, 8, "_" * 50, new_x="LMARGIN", new_y="NEXT")
                pdf.ln(2)

            pdf.ln(2)

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)

    safe_name = quote((paper.title or 'exam_paper') + '.pdf')
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=utf-8''{safe_name}"}
    )


@router.get("/{exam_paper_id}/preview")
async def preview_exam_paper(
    exam_paper_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    paper, questions = await _get_paper_with_questions(exam_paper_id, db)
    return {
        "paper": {
            "id": str(paper.id), "title": paper.title, "subtitle": paper.subtitle,
            "subject": paper.subject, "grade_level": paper.grade_level,
            "total_score": paper.total_score, "duration_minutes": paper.duration_minutes,
            "status": paper.status, "instructions": paper.instructions,
            "description": paper.description,
        },
        "questions": questions,
    }


# Exam paper templates endpoints would go here
# For brevity, I'm skipping them for now but they would follow a similar pattern