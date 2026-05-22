import uuid
from fastapi import APIRouter, Depends, HTTPException, status, File, Form, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.session import get_db
from app.models.ocr_upload import OcrUpload
from app.schemas.ocr import OcrUploadCreate, OcrUploadResponse, OcrUploadUpdate
from typing import List, Optional
from app.core.security import get_current_user

router = APIRouter()


@router.post("/upload/file")
async def upload_ocr_file(
    file: UploadFile = File(...),
    subject: str = Form("数学"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept image upload (multipart), store OCR record, return mock result."""
    if current_user.user_type != "STUDENT":
        raise HTTPException(status_code=403, detail="仅学生可用")

    import base64, random
    contents = await file.read()
    image_b64 = base64.b64encode(contents).decode("utf-8")

    ocr_upload = OcrUpload(
        student_id=uuid.UUID(current_user.id),
        file_name=file.filename or "upload.jpg",
        file_path=f"/tmp/ocr/{uuid.uuid4().hex}.jpg",
        file_size=len(contents),
        file_type=file.content_type or "image/jpeg",
        status="COMPLETED",
        ocr_engine="mock-v2.3",
        confidence_score=0.85 + random.random() * 0.1,
        processed_text=f"识别完成：共5题\n选择题3题、填空题2题",
        structured_data={
            "questions": [
                {"title": "计算: (-5)+12", "type": "FILL_BLANK", "student_answer": "7", "correct": True},
                {"title": "y=2x+1的斜率", "type": "FILL_BLANK", "student_answer": "3", "correct": False, "correct_answer": "2"},
                {"title": "下列哪个是二次函数？", "type": "SINGLE_CHOICE", "options": ["A. y=2x+1", "B. y=x²", "C. y=1/x", "D. y=|x|"], "student_answer": "A", "correct": False, "correct_answer": "B"},
                {"title": "等腰三角形底角相等（判断）", "type": "SINGLE_CHOICE", "options": ["A. 正确", "B. 错误"], "student_answer": "A", "correct": True},
                {"title": "证明: 三角形内角和为180°", "type": "SUBJECTIVE", "student_answer": "作图...", "correct": None},
            ],
            "total_score": 100,
            "estimated_score": 60,
            "error_count": 2,
        },
    )
    db.add(ocr_upload)
    await db.commit()
    await db.refresh(ocr_upload)
    return {
        "ok": True, "upload_id": str(ocr_upload.id),
        "status": "COMPLETED",
        "result": ocr_upload.structured_data,
    }


@router.post("/upload", response_model=OcrUploadResponse)
async def upload_ocr_image(
    ocr_in: OcrUploadCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only students can upload OCR images
    if current_user.role != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    # Create new OCR upload
    ocr_upload = OcrUpload(
        **ocr_in.dict(),
        student_id=uuid.UUID(current_user.id),
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
    if ocr_upload.student_id != current_user.id and current_user.role not in ["TEACHER", "ADMIN"]:
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
    if ocr_upload.student_id != current_user.id and current_user.role not in ["TEACHER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    return ocr_upload


@router.get("", response_model=List[OcrUploadResponse])
async def get_ocr_uploads(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(OcrUpload)

    # Apply filters
    if status:
        query = query.where(OcrUpload.status == status)

    # Students can only see their own uploads, teachers/admins can see all
    if current_user.role == "STUDENT":
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
    if current_user.role != "STUDENT":
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
    if current_user.role != "STUDENT":
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


@router.get("/config")
async def get_ocr_config(
    current_user = Depends(get_current_user),
):
    # TODO: Implement OCR configuration retrieval
    # For now, return a placeholder
    return {
        "engine": "paddleocr",
        "lang": "ch",
        "use_gpu": True,
        "confidence_threshold": 0.5,
    }


@router.put("/config")
async def update_ocr_config(
    config: dict,
    current_user = Depends(get_current_user),
):
    # Only admins can update OCR configuration
    if current_user.role != "ADMIN":
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