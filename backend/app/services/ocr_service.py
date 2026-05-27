"""OCR service — Tesseract + PaddleOCR integration for answer sheet scanning."""
import os
import uuid
import json
import re
import logging
from typing import Optional
from datetime import datetime, timezone

import httpx

try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.7


def _extract_questions(raw_text: str) -> list:
    """Heuristic extraction of questions from OCR raw text."""
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    questions = []
    current = {"title": "", "type": "SUBJECTIVE", "options": [], "student_answer": ""}
    for line in lines:
        # Detect question number pattern: 1. / (1) / 1、
        if re.match(r"^[\(（]?\d+[\)）]?[\.、\s]", line):
            if current["title"]:
                questions.append(current)
            current = {"title": line, "type": "SUBJECTIVE", "options": [], "student_answer": ""}
        # Detect options A/B/C/D
        elif re.match(r"^[A-Da-d][\.．、\s]", line):
            current["options"].append(line)
            current["type"] = "SINGLE_CHOICE" if len(current["options"]) <= 2 else "MULTIPLE_CHOICE"
        # Detect answer line
        elif "答案" in line or "答" in line:
            current["student_answer"] = line.split("：", 1)[-1].split(":", 1)[-1].strip()
        else:
            current["title"] += " " + line
    if current["title"]:
        questions.append(current)
    return questions


def _estimate_confidence(raw_text: str, question_count: int) -> float:
    """Estimate OCR confidence based on text quality heuristics."""
    if not raw_text.strip():
        return 0.0
    lines = [l for l in raw_text.splitlines() if l.strip()]
    # Heuristic: more lines with Chinese characters = higher confidence
    chinese_chars = sum(1 for c in raw_text if "\u4e00" <= c <= "\u9fff")
    total_chars = len(raw_text.replace(" ", "").replace("\n", ""))
    ratio = chinese_chars / total_chars if total_chars > 0 else 0
    # Penalize very short text
    length_score = min(len(lines) / 5, 1.0)
    # Base confidence
    confidence = (ratio * 0.5 + length_score * 0.5)
    return round(min(max(confidence, 0.0), 1.0), 4)


async def _process_with_paddleocr(image_bytes: bytes, endpoint: str) -> dict:
    """Process image via PaddleOCR HTTP service.

    Returns dict with raw_text, confidence, engine — or raises on failure.
    """
    files = {"image": ("upload.jpg", image_bytes, "image/jpeg")}
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
        r = await client.post(endpoint, files=files)
        if r.status_code != 200:
            raise RuntimeError(f"PaddleOCR returned {r.status_code}: {r.text[:300]}")
        data = r.json()

    # PaddleOCR response: list of results, each with text/confidence/box
    results = data if isinstance(data, list) else data.get("results", data.get("data", []))
    if not results:
        return {"raw_text": "", "confidence": 0.0, "engine": "paddleocr"}

    # Concatenate text blocks sorted by vertical position (top-to-bottom)
    if isinstance(results[0], dict) and "text" in results[0]:
        # Standard PaddleOCR format: [{text, confidence, box: [[x,y],...]}]
        blocks = sorted(results, key=lambda b: min(p[1] for p in b.get("box", [[0, 0]])))
        raw_text = "\n".join(b["text"] for b in blocks if b.get("text"))
        avg_conf = sum(b.get("confidence", 0) for b in blocks) / len(blocks) if blocks else 0
    elif isinstance(results[0], list):
        # Nested format: [[{text, confidence, box}]]
        lines_text = []
        confidences = []
        for line_blocks in results:
            line_parts = []
            for b in line_blocks:
                line_parts.append(b.get("text", ""))
                confidences.append(b.get("confidence", 0))
            lines_text.append(" ".join(line_parts))
        raw_text = "\n".join(lines_text)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0
    else:
        raw_text = str(data)
        avg_conf = 0.5

    return {"raw_text": raw_text, "confidence": round(avg_conf, 4), "engine": "paddleocr"}


def _build_result(raw_text: str, engine: str) -> dict:
    """Build standardized OCR result from raw text."""
    questions = _extract_questions(raw_text)
    confidence = _estimate_confidence(raw_text, len(questions))
    status = "NEEDS_REVIEW" if confidence < CONFIDENCE_THRESHOLD else "COMPLETED"

    structured_questions = []
    for i, q in enumerate(questions, 1):
        structured_questions.append({
            "index": i,
            "title": q.get("title", ""),
            "type": q.get("type", "SUBJECTIVE"),
            "student_answer": q.get("student_answer", ""),
            "options": q.get("options", []),
            "correct": None,
        })

    return {
        "status": status,
        "raw_text": raw_text,
        "confidence": confidence,
        "questions": structured_questions,
        "total_questions": len(structured_questions),
        "engine": engine,
    }


async def _process_with_tesseract(image_bytes: bytes, file_path: str) -> dict:
    """Process image via Tesseract (original path)."""
    if not TESSERACT_AVAILABLE:
        return {
            "status": "FAILED",
            "error": "Tesseract OCR not available. Install: apt-get install tesseract-ocr tesseract-ocr-chi-sim",
            "raw_text": "",
            "confidence": 0.0,
            "questions": [],
        }

    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    try:
        image = Image.open(file_path)
        raw_text = pytesseract.image_to_string(image, lang="chi_sim+eng")
    except Exception as e:
        return {
            "status": "FAILED",
            "error": str(e),
            "raw_text": "",
            "confidence": 0.0,
            "questions": [],
        }

    return _build_result(raw_text, "tesseract")


async def process_image(
    image_bytes: bytes,
    file_path: str,
    file_name: str = "upload.jpg",
) -> dict:
    """Process an image with the configured OCR engine.

    Routes to PaddleOCR or Tesseract based on sysconfig.
    Falls back to Tesseract if PaddleOCR fails.
    """
    from app.services.config_service import load_config
    cfg = load_config().get("ocr", {})
    engine = cfg.get("ocr_engine", "tesseract")
    endpoint = cfg.get("paddleocr_endpoint", "http://paddleocr:8080/predict")

    if engine == "paddleocr":
        try:
            paddle_result = await _process_with_paddleocr(image_bytes, endpoint)
            return _build_result(paddle_result["raw_text"], "paddleocr")
        except Exception as e:
            logger.warning("PaddleOCR failed, falling back to Tesseract: %s", e)
            # Fall through to Tesseract

    return await _process_with_tesseract(image_bytes, file_path)
