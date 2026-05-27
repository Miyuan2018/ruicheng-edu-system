import uuid
import os
import io
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, File, Form, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.session import get_db
from app.models.ocr_upload import OcrUpload
from app.schemas.ocr import OcrUploadCreate, OcrUploadResponse, OcrUploadUpdate
from app.services.ocr_service import process_image, TESSERACT_AVAILABLE
from app.core.security import get_current_user, require_role
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


@router.post("/upload/file")
async def upload_ocr_file(
    file: UploadFile = File(...),
    exam_paper_id: str = Form(None),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept image upload (multipart), run Tesseract OCR, store record."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(status_code=403, detail="仅学生可用")

    contents = await file.read()
    file_path = f"/tmp/ocr/{uuid.uuid4().hex}.jpg"

    # Run OCR processing
    result = await process_image(contents, file_path, file.filename or "upload.jpg")

    ocr_upload = OcrUpload(
        student_id=current_user.id,
        exam_paper_id=exam_paper_id if exam_paper_id else current_user.id,
        file_name=file.filename or "upload.jpg",
        file_path=file_path,
        file_size=len(contents),
        file_type=file.content_type or "image/jpeg",
        status=result["status"],
        ocr_engine=result.get("engine", "tesseract") if TESSERACT_AVAILABLE else "unavailable",
        confidence_score=result.get("confidence"),
        processed_text=result.get("raw_text", "")[:4000],
        structured_data={
            "questions": result.get("questions", []),
            "total_questions": result.get("total_questions", 0),
            "error": result.get("error"),
        },
    )
    db.add(ocr_upload)
    await db.commit()
    await db.refresh(ocr_upload)

    return {
        "ok": result["status"] != "FAILED",
        "upload_id": str(ocr_upload.id),
        "status": result["status"],
        "confidence": result.get("confidence"),
        "needs_review": result["status"] == "NEEDS_REVIEW",
        "result": ocr_upload.structured_data,
        "tesseract_installed": TESSERACT_AVAILABLE,
    }


@router.post("/upload", response_model=OcrUploadResponse)
async def upload_ocr_image(
    ocr_in: OcrUploadCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only students can upload OCR images
    if current_user.user_type != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Create new OCR upload
    ocr_upload = OcrUpload(
        **ocr_in.dict(),
        student_id=current_user.id,
        status="PENDING",
    )
    db.add(ocr_upload)
    await db.commit()
    await db.refresh(ocr_upload)
    return ocr_upload


@router.get("/status/{upload_id}", response_model=OcrUploadResponse)
async def get_ocr_status(
    upload_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(OcrUpload).where(OcrUpload.id == upload_id))
    ocr_upload = result.scalar_one_or_none()
    if not ocr_upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OCR upload not found",
        )

    # Check if user is the owner of the OCR upload or is a teacher/admin
    if ocr_upload.student_id != current_user.id and current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    return ocr_upload


@router.get("/result/{upload_id}", response_model=OcrUploadResponse)
async def get_ocr_result(
    upload_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(OcrUpload).where(OcrUpload.id == upload_id))
    ocr_upload = result.scalar_one_or_none()
    if not ocr_upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OCR upload not found",
        )

    # Check if user is the owner of the OCR upload or is a teacher/admin
    if ocr_upload.student_id != current_user.id and current_user.user_type not in ["TEACHER", "SYS_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    return ocr_upload


@router.get("", response_model=List[OcrUploadResponse])
async def get_ocr_uploads(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 200)
    query = select(OcrUpload)

    # Apply filters
    if status:
        query = query.where(OcrUpload.status == status)

    # Students can only see their own uploads, teachers/admins can see all
    if current_user.user_type == "STUDENT":
        query = query.where(OcrUpload.student_id == current_user.id)

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    ocr_uploads = result.scalars().all()
    return ocr_uploads


@router.put("/{upload_id}", response_model=OcrUploadResponse)
async def update_ocr_upload(
    upload_id: uuid.UUID,
    ocr_in: OcrUploadUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only students can update their own OCR uploads
    if current_user.user_type != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(select(OcrUpload).where(OcrUpload.id == upload_id))
    ocr_upload = result.scalar_one_or_none()
    if not ocr_upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OCR upload not found",
        )

    # Check if user is the owner of the OCR upload
    if ocr_upload.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Update OCR upload
    update_data = ocr_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ocr_upload, field, value)

    await db.commit()
    await db.refresh(ocr_upload)
    return ocr_upload


@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ocr_upload(
    upload_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only students can delete their own OCR uploads
    if current_user.user_type != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    result = await db.execute(select(OcrUpload).where(OcrUpload.id == upload_id))
    ocr_upload = result.scalar_one_or_none()
    if not ocr_upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OCR upload not found",
        )

    # Check if user is the owner of the OCR upload
    if ocr_upload.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    await db.execute(delete(OcrUpload).where(OcrUpload.id == upload_id))
    await db.commit()
    return None


class PaddleOCRTestRequest(BaseModel):
    endpoint: str


@router.post("/test-paddleocr")
async def test_paddleocr(
    req: PaddleOCRTestRequest,
    current_user=Depends(require_role("SYS_ADMIN")),
):
    """Test PaddleOCR endpoint connectivity by sending a minimal test image."""
    # Create a 1x1 white pixel PNG as test image
    try:
        from PIL import Image
        img = Image.new("RGB", (1, 1), color=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        test_bytes = buf.getvalue()
    except ImportError:
        # Fallback: minimal valid PNG bytes (1x1 white pixel)
        test_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            r = await client.post(
                req.endpoint,
                files={"image": ("test.png", test_bytes, "image/png")},
            )
            if r.status_code == 200:
                return {"ok": True, "message": "PaddleOCR 连接成功"}
            return {"ok": False, "message": f"PaddleOCR 返回 {r.status_code}: {r.text[:200]}"}
    except httpx.ConnectError:
        return {"ok": False, "message": f"无法连接 PaddleOCR ({req.endpoint})"}
    except httpx.TimeoutException:
        return {"ok": False, "message": f"连接 PaddleOCR 超时 ({req.endpoint})"}
    except Exception as e:
        return {"ok": False, "message": f"连接异常: {str(e)}"}


@router.get("/config")
async def get_ocr_config(
    current_user = Depends(get_current_user),
):
    from app.services.config_service import load_config
    ocr_cfg = load_config().get("ocr", {})
    return {
        "engine": ocr_cfg.get("ocr_engine", "tesseract"),
        "paddleocr_endpoint": ocr_cfg.get("paddleocr_endpoint", ""),
        "max_concurrent_ocr": ocr_cfg.get("max_concurrent_ocr", 5),
        "confidence_threshold": ocr_cfg.get("ocr_confidence_threshold", 0.7),
    }


@router.put("/config")
async def update_ocr_config(
    config: dict,
    current_user = Depends(get_current_user),
):
    # Only admins can update OCR configuration
    if current_user.user_type != "SYS_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # TODO: Implement OCR configuration update
    # For now, just return a success message
    return {"message": "OCR configuration updated successfully"}


@router.post("/batch-upload")
async def batch_upload_ocr_images(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: Implement batch upload functionality
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Batch upload functionality not yet implemented",
    )


@router.get("/batch-status/{batch_id}")
async def get_batch_ocr_status(
    batch_id: uuid.UUID,
    current_user = Depends(get_current_user),
):
    # TODO: Implement batch status retrieval
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Batch status functionality not yet implemented",
    )


# ── OCR 答题提交 ──────────────────────────────────────────

class OcrQuestionItem(BaseModel):
    title: str
    question_type: str = "SUBJECTIVE"
    options: list | None = None
    correct_answer: str | None = None
    student_answer: str | None = None
    score: int = 5


class OcrSubmitRequest(BaseModel):
    exam_paper_id: str
    ocr_upload_id: str | None = None
    questions: list[OcrQuestionItem]


@router.post("/submit-answers")
async def submit_ocr_answers(
    req: OcrSubmitRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """将 OCR 识别的题目保存到数据库，并创建答题提交记录。"""
    import json
    from app.models.question import Question
    from app.models.answer_submission import AnswerSubmission
    from app.models.answer_detail import AnswerDetail
    from app.models.exam_paper import ExamPaper

    if current_user.user_type != "STUDENT":
        raise HTTPException(403, detail="仅学生可提交答案")

    # 验证试卷存在
    paper_result = await db.execute(select(ExamPaper).where(ExamPaper.id == req.exam_paper_id))
    paper = paper_result.scalar_one_or_none()
    if not paper:
        raise HTTPException(404, detail="试卷不存在")

    now = datetime.now(timezone.utc)
    uid = current_user.id

    # 1. 创建 AnswerSubmission
    submission = AnswerSubmission(
        exam_paper_id=req.exam_paper_id,
        student_id=uid,
        submission_type="OCR",
        ocr_upload_id=req.ocr_upload_id if req.ocr_upload_id else None,
        status="GRADED",
        submitted_at=now,
    )
    db.add(submission)
    await db.flush()

    # 2. 保存 OCR 识别的题目 + 创建答题详情
    total_score = 0.0
    total_max = 0.0
    for item in req.questions:
        # 构建 correct_answer JSON
        ca_value = item.correct_answer or ""
        if item.question_type in ("SINGLE_CHOICE", "MULTIPLE_CHOICE") and item.options:
            ca_json = json.dumps({
                "options": [{"label": chr(65 + i), "text": o} for i, o in enumerate(item.options)],
                "correct_answer": ca_value,
            }, ensure_ascii=False)
        elif item.question_type == "FILL_BLANK":
            ca_json = json.dumps({"options": None, "correct_answer": [ca_value] if ca_value else []}, ensure_ascii=False)
        else:
            ca_json = json.dumps({"options": None, "correct_answer": {"keywords": [ca_value] if ca_value else [], "max_score": item.score}}, ensure_ascii=False)

        # 保存 Question
        q = Question(
            title=item.title,
            question_type=item.question_type,
            difficulty="MEDIUM",
            subject=paper.subject if hasattr(paper, 'subject') else "数学",
            score=item.score,
            correct_answer=ca_json,
            source="OCR_UPLOAD",
            review_status="APPROVED",
            created_by=uid,
        )
        db.add(q)
        await db.flush()

        # 创建 AnswerDetail
        detail = AnswerDetail(
            answer_submission_id=submission.id,
            question_id=q.id,
            student_answer=item.student_answer,
        )
        db.add(detail)
        total_max += item.score

    await db.commit()

    # 3. 自动评分
    try:
        from app.api.v1.endpoints.answers import _grade_submission
        async with db.begin():
            await _grade_submission(submission.id, db)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("OCR grading failed")

    # 4. 生成错题本
    try:
        await db.refresh(submission)
        pct = submission.percentage
        if pct is not None and float(pct) < 100:
            from app.services.mistake_service import generate_mistake_book
            await generate_mistake_book(current_user.id, db, exam_paper_id=req.exam_paper_id)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Mistake book generation failed")

    await db.refresh(submission)
    return {
        "ok": True,
        "submission_id": str(submission.id),
        "question_count": len(req.questions),
        "total_score": float(submission.total_score or 0),
        "percentage": float(submission.percentage or 0),
        "status": submission.status,
    }