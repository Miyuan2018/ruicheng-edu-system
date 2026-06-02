"""Word/PDF export helpers for exam papers with unit structure.

V3.5.1: Loads questions from ExamPaperUnit + ExamPaperUnitQuestion instead
of the deleted exam_paper_questions association table.
"""
import json
import io
from urllib.parse import quote
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.exam_paper import ExamPaper, ExamPaperUnit, ExamPaperUnitQuestion


TYPE_LABELS = {
    "FILL_BLANK": "填空题",
    "SINGLE_CHOICE": "单选题",
    "MULTIPLE_CHOICE": "多选题",
    "SUBJECTIVE": "解答题",
}


def _parse_question(question, uq_score: int) -> dict:
    """Parse a single Question row into the export dict format."""
    correct_answer = question.correct_answer or ""
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

    return {
        "title": question.title or "",
        "question_type": question.question_type,
        "type_label": TYPE_LABELS.get(question.question_type, question.question_type),
        "difficulty": question.difficulty or "",
        "score": uq_score or question.score or 0,
        "correct_answer": correct_answer,
        "answer_text": answer_text,
        "options": options,
        "explanation": question.explanation or "",
    }


async def load_paper_with_questions(
    exam_paper_id,
    db: AsyncSession,
):
    """Load a paper together with all units and their questions.

    Returns (paper, questions) where questions is a flat list of dicts with
    a sequential ``index``.
    """
    result = await db.execute(
        select(ExamPaper)
        .where(ExamPaper.id == exam_paper_id)
        .options(
            selectinload(ExamPaper.units)
            .selectinload(ExamPaperUnit.questions)
            .selectinload(ExamPaperUnitQuestion.question),
        )
    )
    paper = result.scalar_one_or_none()
    if not paper:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam paper not found",
        )

    questions = []
    for unit in paper.units:
        for uq in unit.questions:
            parsed = _parse_question(uq.question, uq.score)
            parsed["index"] = len(questions) + 1
            parsed["unit_name"] = unit.name
            questions.append(parsed)

    return paper, questions


def _write_type_sections(doc, qs, type_order, Cm, Pt, RGBColor):
    """写入题型分区（Word）"""
    grouped: dict[str, list] = {}
    for q in qs:
        grouped.setdefault(q["question_type"], []).append(q)
    for t in type_order:
        tqs = grouped.get(t, [])
        if not tqs:
            continue
        header = doc.add_paragraph()
        run = header.add_run(f"{tqs[0]['type_label']}（共{len(tqs)}题）")
        run.bold = True
        run.font.size = Pt(13)
        for q in tqs:
            _write_question_word(doc, q, t, Cm, Pt)


def _write_question_word(doc, q, t, Cm, Pt):
    """写入单道题目（Word）"""
    q_para = doc.add_paragraph()
    q_para.add_run(f"{q['index']}. {q['title']}（{q['score']}分）").font.size = Pt(11)
    if q["options"] and len(q["options"]) > 0:
        for opt in q["options"]:
            opt_para = doc.add_paragraph()
            opt_para.paragraph_format.left_indent = Cm(1)
            if isinstance(opt, dict):
                opt_para.add_run(f"{opt.get('label', '')}. {opt.get('text', '')}").font.size = Pt(10)
            else:
                opt_para.add_run(str(opt)).font.size = Pt(10)
    if t == "FILL_BLANK":
        blank_para = doc.add_paragraph()
        blank_para.add_run("_" * 40).font.size = Pt(10)
    if t == "SUBJECTIVE":
        for _ in range(3):
            space_para = doc.add_paragraph()
            space_para.add_run("_" * 60).font.size = Pt(10)
    doc.add_paragraph()


async def export_word(exam_paper_id, db: AsyncSession):
    """Generate a Word document for the exam paper."""
    from docx import Document
    from docx.shared import Pt, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    paper, questions = await load_paper_with_questions(exam_paper_id, db)

    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(11)
    # 东亚字体回退
    from docx.oxml.ns import qn
    style.element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')

    # ── Title ──
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title_para.add_run(paper.title or "")
    run.bold = True
    run.font.size = Pt(18)

    # Subtitle
    if paper.subtitle:
        sub_para = doc.add_paragraph()
        sub_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sub_para.add_run(paper.subtitle).font.size = Pt(10)

    # Info line
    info_parts = []
    if paper.subject:
        info_parts.append(f"学科：{paper.subject}")
    if paper.grade_level and isinstance(paper.grade_level, dict):
        grades = paper.grade_level.get("grades", [])
        if grades:
            info_parts.append(f"年级：{', '.join(grades)}")
    info_parts.append(f"总分：{paper.total_score}分")
    if paper.duration_minutes:
        info_parts.append(f"时长：{paper.duration_minutes}分钟")
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

    doc.add_paragraph()

    # ── Questions ──
    type_order = ["FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SUBJECTIVE"]

    if getattr(paper, 'show_units', True):
        # 按单元分组 → 单元内按题型
        unit_groups: dict[str, list] = {}
        for q in questions:
            un = q.get("unit_name", "")
            unit_groups.setdefault(un, []).append(q)
        for uname, uqs in unit_groups.items():
            # Unit header
            u_header = doc.add_paragraph()
            run = u_header.add_run(f"{uname}（共{len(uqs)}题）")
            run.bold = True
            run.font.size = Pt(14)
            doc.add_paragraph()
            _write_type_sections(doc, uqs, type_order, Cm, Pt, RGBColor)
    else:
        _write_type_sections(doc, questions, type_order, Cm, Pt, RGBColor)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    safe_name = quote((paper.title or "exam_paper") + ".docx")
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f"attachment; filename*=utf-8''{safe_name}"
        },
    )


def _write_type_sections_pdf(pdf, qs, type_order):
    """写入题型分区（PDF）"""
    grouped: dict[str, list] = {}
    for q in qs:
        grouped.setdefault(q["question_type"], []).append(q)
    for t in type_order:
        tqs = grouped.get(t, [])
        if not tqs:
            continue
        pdf.set_font("CJK", "", 13)
        pdf.cell(0, 10, f"{tqs[0]['type_label']}（共{len(tqs)}题）", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        for q in tqs:
            pdf.set_font("CJK", "", 11)
            pdf.multi_cell(0, 7, f"{q['index']}. {q['title']}（{q['score']}分）")
            pdf.ln(1)
            if q["options"] and len(q["options"]) > 0:
                pdf.set_font("CJK", "", 10)
                for opt in q["options"]:
                    pdf.cell(10, 6, "")
                    if isinstance(opt, dict):
                        pdf.cell(0, 6, f"{opt.get('label', '')}. {opt.get('text', '')}", new_x="LMARGIN", new_y="NEXT")
                    else:
                        pdf.cell(0, 6, str(opt), new_x="LMARGIN", new_y="NEXT")
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


async def export_pdf(exam_paper_id, db: AsyncSession):
    """Generate a PDF for the exam paper."""
    from fpdf import FPDF

    paper, questions = await load_paper_with_questions(exam_paper_id, db)

    pdf = FPDF()
    pdf.add_page()

    # Load CJK font
    FONT_PATHS = [
        "/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        "/usr/share/fonts/truetype/arphic/uming.ttc",
    ]
    font_loaded = False
    for fp in FONT_PATHS:
        try:
            pdf.add_font("CJK", "", fp, uni=True)
            pdf.set_font("CJK", "", 12)
            font_loaded = True
            break
        except Exception:
            continue
    if not font_loaded:
        pdf.set_font("Helvetica", "", 12)

    # Title
    pdf.set_font("CJK", "", 18)
    pdf.cell(0, 12, paper.title or "", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(4)

    # Info line
    pdf.set_font("CJK", "", 10)
    info_parts = []
    if paper.subject:
        info_parts.append(f"学科：{paper.subject}")
    if paper.grade_level and isinstance(paper.grade_level, dict):
        grades = paper.grade_level.get("grades", [])
        if grades:
            info_parts.append(f"年级：{', '.join(grades)}")
    info_parts.append(f"总分：{paper.total_score}分")
    if paper.duration_minutes:
        info_parts.append(f"时长：{paper.duration_minutes}分钟")
    pdf.cell(
        0, 8, " | ".join(info_parts), new_x="LMARGIN", new_y="NEXT", align="C"
    )
    pdf.ln(6)

    type_order = ["FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SUBJECTIVE"]

    if getattr(paper, 'show_units', True):
        unit_groups: dict[str, list] = {}
        for q in questions:
            un = q.get("unit_name", "")
            unit_groups.setdefault(un, []).append(q)
        for uname, uqs in unit_groups.items():
            pdf.set_font("CJK", "", 14)
            pdf.cell(0, 10, f"{uname}（共{len(uqs)}题）", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(4)
            _write_type_sections_pdf(pdf, uqs, type_order)
    else:
        _write_type_sections_pdf(pdf, questions, type_order)

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)

    safe_name = quote((paper.title or "exam_paper") + ".pdf")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=utf-8''{safe_name}"
        },
    )
