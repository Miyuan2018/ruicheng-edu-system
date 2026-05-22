"""V2.1 Question Bank Admin APIs - syllabus, LLM generate, scrape, approval, dedup."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, Form, UploadFile, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.question import Question
from app.models.syllabus import Syllabus
from app.models.llm_config import LlmConfig
from app.models.question_task import QuestionTask
from app.schemas.question import QuestionCreate, QuestionResponse
from app.core.security import get_current_user
from typing import List, Optional
import json

router = APIRouter()


# ─── Syllabus ───────────────────────────────────────────────

@router.post("/syllabi")
async def create_syllabus(
    title: str, grade_level: str = None, province: str = None,
    subject: str = None, content: dict = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="仅题库管理员可操作")
    s = Syllabus(
        title=title, grade_level=grade_level, province=province,
        subject=subject, content=content or {},
        created_by=uuid.UUID(current_user.id),
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"id": str(s.id), "title": s.title, "status": s.status}


@router.get("/syllabi")
async def list_syllabi(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Syllabus).order_by(Syllabus.created_at.desc()))
    syllabi = result.scalars().all()
    return [{"id": str(s.id), "title": s.title, "grade_level": s.grade_level,
             "province": s.province, "subject": s.subject, "status": s.status,
             "knowledge_tree": s.knowledge_tree} for s in syllabi]


@router.get("/syllabi/{syllabus_id}")
async def get_syllabus(syllabus_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Syllabus).where(Syllabus.id == syllabus_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, detail="考纲不存在")
    return {"id": str(s.id), "title": s.title, "content": s.content,
            "knowledge_tree": s.knowledge_tree, "status": s.status}


@router.put("/syllabi/{syllabus_id}")
async def update_syllabus(
    syllabus_id: uuid.UUID, knowledge_tree: dict = None, content: dict = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="仅题库管理员可操作")
    result = await db.execute(select(Syllabus).where(Syllabus.id == syllabus_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, detail="考纲不存在")
    if knowledge_tree:
        s.knowledge_tree = knowledge_tree
    if content:
        s.content = content
    await db.commit()
    return {"message": "更新成功"}


@router.post("/syllabi/{syllabus_id}/extract-knowledge")
async def extract_knowledge(
    syllabus_id: uuid.UUID,
    model_config_id: str = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="仅题库管理员可操作")
    result = await db.execute(select(Syllabus).where(Syllabus.id == syllabus_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, detail="考纲不存在")

    # Mock LLM knowledge extraction - in production calls the selected model
    content_text = json.dumps(s.content or {}, ensure_ascii=False)
    knowledge_tree = _mock_extract_knowledge(s.subject or "数学", s.grade_level or "八年级")

    s.knowledge_tree = knowledge_tree
    await db.commit()
    return {"knowledge_tree": knowledge_tree, "message": "知识点提取完成"}


def _mock_extract_knowledge(subject: str, grade: str) -> dict:
    """Mock knowledge tree generation. Replace with real LLM call."""
    return {
        "name": f"{grade}{subject}考纲",
        "children": [
            {"name": "数与代数", "children": [
                {"name": "实数"}, {"name": "代数式"}, {"name": "方程与不等式"}
            ]},
            {"name": "图形与几何", "children": [
                {"name": "三角形"}, {"name": "四边形"}, {"name": "圆"}
            ]},
            {"name": "统计与概率", "children": [
                {"name": "数据收集"}, {"name": "概率初步"}
            ]},
        ]
    }


# ─── LLM Configs ────────────────────────────────────────────

@router.get("/llm-configs")
async def list_llm_configs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LlmConfig).where(LlmConfig.is_active == True))
    configs = result.scalars().all()
    return [{"id": str(c.id), "name": c.name, "provider": c.provider,
             "model_name": c.model_name, "is_local": c.is_local} for c in configs]


# ─── Question Generation ────────────────────────────────────

@router.post("/generate")
async def generate_questions(
    knowledge_point: str, difficulty: str = "MEDIUM",
    question_type: str = "SINGLE_CHOICE", count: int = 5,
    subject: str = "数学", grade_level: str = "八年级",
    model: str = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="仅题库管理员可操作")

    if count > 20:
        count = 20

    # Call real LLM service
    try:
        from app.services.llm_service import generate_questions as llm_generate
        result = await llm_generate(
            knowledge_point=knowledge_point, difficulty=difficulty,
            question_type=question_type, count=count,
            subject=subject, grade_level=grade_level, model=model,
        )
    except Exception as e:
        return {"ok": False, "error": "LLM调用异常: " + str(e)}

    if not result.get("ok"):
        return {"ok": False, "error": result.get("error", "生成失败")}

    # Save generated questions
    task = QuestionTask(
        task_type="LLM_GENERATE", status="COMPLETED", total_items=count,
        parameters={"knowledge_point": knowledge_point, "difficulty": difficulty,
                     "question_type": question_type, "count": count},
        model_used=model or "default",
        created_by=uuid.UUID(current_user.id),
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        completed_items=count,
    )
    db.add(task)
    await db.flush()

    generated = []
    for item in result["questions"]:
        correct_answer = item.get("correct_answer")
        if isinstance(correct_answer, (dict, list)):
            correct_answer = json.dumps(correct_answer, ensure_ascii=False)

        q = Question(
            title=item.get("title", ""),
            question_type=question_type, difficulty=difficulty,
            subject=subject, grade_level=grade_level,
            score=item.get("score", 5),
            correct_answer=correct_answer or "",
            explanation=item.get("explanation", ""),
            meta_data={"knowledge_points": [knowledge_point]},
            source="LLM_GENERATED", review_status="PENDING",
            source_task_id=task.id,
            created_by=uuid.UUID(current_user.id),
        )
        db.add(q)
        await db.flush()
        generated.append({"id": str(q.id), "title": q.title})

    task.result_summary = {"generated_ids": [g["id"] for g in generated]}
    await db.commit()

    return {"ok": True, "count": len(generated), "questions": generated,
            "model": result.get("model", ""), "task_id": str(task.id)}


# ─── Question Approval ──────────────────────────────────────

@router.get("/pending")
async def list_pending_questions(
    source: str = None, skip: int = 0, limit: int = 50,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN", "TEACHER"):
        raise HTTPException(403, detail="权限不足")
    query = select(Question).where(Question.review_status.in_(("PENDING", "NEEDS_REVIEW")))
    if source:
        query = query.where(Question.source == source)
    query = query.offset(skip).limit(limit).order_by(Question.created_at.desc())
    result = await db.execute(query)
    questions = result.scalars().all()
    return [{"id": str(q.id), "title": q.title, "question_type": q.question_type,
             "difficulty": q.difficulty, "subject": q.subject, "source": q.source,
             "review_status": q.review_status, "created_at": q.created_at.isoformat()}
            for q in questions]


@router.post("/{question_id}/approve")
async def approve_question(
    question_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN", "TEACHER"):
        raise HTTPException(403, detail="权限不足")
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, detail="试题不存在")
    q.review_status = "APPROVED"
    q.reviewed_by = current_user.id
    q.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "审核通过", "id": str(q.id)}


@router.post("/{question_id}/reject")
async def reject_question(
    question_id: uuid.UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN", "TEACHER"):
        raise HTTPException(403, detail="权限不足")
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, detail="试题不存在")
    q.review_status = "REJECTED"
    q.reviewed_by = current_user.id
    q.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "已驳回", "id": str(q.id)}


@router.post("/batch-approve")
async def batch_approve(
    question_ids: List[str],
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN", "TEACHER"):
        raise HTTPException(403, detail="权限不足")
    now = datetime.now(timezone.utc)
    for qid in question_ids:
        result = await db.execute(select(Question).where(Question.id == uuid.UUID(qid)))
        q = result.scalar_one_or_none()
        if q:
            q.review_status = "APPROVED"
            q.reviewed_by = current_user.id
            q.reviewed_at = now
    await db.commit()
    return {"message": f"已批量审核通过 {len(question_ids)} 道试题"}


# ─── Web Scraping ───────────────────────────────────────────

@router.post("/scrape")
async def start_scrape(
    knowledge_point: str, source_urls: List[str] = None, count: int = 10,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(403, detail="权限不足")

    uid = uuid.UUID(current_user.id)
    task = QuestionTask(
        task_type="WEB_SCRAPE", status="RUNNING", total_items=count,
        parameters={"knowledge_point": knowledge_point, "urls": source_urls or []},
        created_by=uid, started_at=datetime.now(timezone.utc),
    )
    db.add(task)
    await db.flush()

    cnt = min(count, 5)
    for i in range(cnt):
        q = Question(
            title="[抓取-" + knowledge_point + "] 网络试题 #" + str(i+1),
            question_type="SINGLE_CHOICE", difficulty="MEDIUM",
            subject="数学", score=5,
            correct_answer='{"options":[{"label":"A","text":"选项A"},{"label":"B","text":"选项B"},{"label":"C","text":"选项C"},{"label":"D","text":"选项D"}],"correct_answer":"A"}',
            source="SCRAPED", review_status="PENDING",
            source_task_id=task.id,
            created_by=uid,
        )
        db.add(q)

    task.status = "COMPLETED"
    task.completed_items = cnt
    task.completed_at = datetime.now(timezone.utc)
    await db.commit()

    return {"ok": True, "task_id": str(task.id), "scraped_count": cnt}


@router.get("/tasks/{task_id}")
async def get_task_status(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(QuestionTask).where(QuestionTask.id == task_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, detail="任务不存在")
    return {"id": str(t.id), "task_type": t.task_type, "status": t.status,
            "progress": t.progress, "total": t.total_items, "completed": t.completed_items,
            "result": t.result_summary}


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(QuestionTask).where(QuestionTask.id == task_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, detail="任务不存在")
    t.status = "CANCELLED"
    await db.commit()
    return {"message": "任务已取消"}


# ─── Deduplication ─────────────────────────────────────────

@router.post("/deduplicate")
async def start_dedup(
    knowledge_point: str = None, difficulty: str = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("QUESTION_ADMIN", "SYS_ADMIN", "TEACHER"):
        raise HTTPException(403, detail="权限不足")

    query = select(Question).where(Question.review_status == "APPROVED")
    if knowledge_point:
        query = query.where(Question.meta_data.contains({"knowledge_points": [knowledge_point]}))
    if difficulty:
        query = query.where(Question.difficulty == difficulty)

    result = await db.execute(query)
    questions = result.scalars().all()

    # Simple title-based dedup groups
    from collections import defaultdict
    groups = defaultdict(list)
    for q in questions:
        key = q.title[:20]
        groups[key].append({"id": str(q.id), "title": q.title,
                            "difficulty": q.difficulty, "subject": q.subject})

    duplicates = [{"group_key": k, "count": len(v), "questions": v}
                  for k, v in groups.items() if len(v) > 1]

    return {"duplicate_groups": duplicates, "total_groups": len(duplicates)}


# ─── Paper Import (Exam Paper OCR via LLM Vision) ────────────

PAPER_IMPORT_PROMPT = """你是一位专业的教育试卷识别专家。请仔细查看这张试卷图片，识别出所有试题。
对每道试题，请判断题型并提取题目内容、选项（如有）、正确答案（如有）和分值。

请严格返回JSON数组格式，不要任何其他文字：
[
  {
    "title": "题目内容",
    "question_type": "SINGLE_CHOICE/MULTIPLE_CHOICE/FILL_BLANK/SUBJECTIVE",
    "difficulty": "EASY/MEDIUM/HARD",
    "score": 分值数字,
    "options": [{"label": "A", "text": "选项内容"}, ...],
    "correct_answer": "正确答案（选择题为选项字母如A，填空题为答案文字，解答题为关键词对象{\"keywords\":[\"关键词1\"]}）",
    "explanation": "解析说明（如有）"
  }
]

注意：
- 如果图片中没有试题，返回空数组 []
- 如果某个字段无法识别，可以设为null
- 单选题correct_answer为选项字母如"A"
- 多选题correct_answer为选项数组如["A","C"]
- 填空题correct_answer为可接受的答案数组如["答案1","答案2"]
- 解答题correct_answer为{"keywords":["关键词1","关键词2"]}
- 如果没有看到选项，options设为null
"""


@router.post("/import-paper")
async def import_paper_recognize(
    file: UploadFile = File(...),
    subject: str = Form("数学"),
    grade_level: str = Form("八年级"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 1: Upload exam paper image, call LLM vision to extract questions."""
    from fastapi import File, Form, UploadFile
    import base64
    import httpx
    from app.services.config_service import load_config

    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")

    # Read and encode image
    contents = await file.read()
    image_b64 = base64.b64encode(contents).decode("utf-8")

    # Get LLM config
    cfg = load_config()
    llm = cfg.get("llm", {})
    endpoint = llm.get("endpoint", "http://127.0.0.1:11434/v1")
    model_name = llm.get("model", "")

    # Try to get a vision-capable model
    if not model_name:
        # Try to detect available vision models
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
                r = await client.get(endpoint.rstrip("/").replace("/v1", "") + "/api/tags")
                if r.status_code == 200:
                    models = r.json().get("models", [])
                    for m in models:
                        mn = m.get("name", "")
                        if any(v in mn.lower() for v in ["llava", "vision", "minicpm", "gemma3", "bakllava"]):
                            model_name = mn
                            break
        except Exception:
            pass

    if not model_name:
        raise HTTPException(400, detail="未配置大模型，请先在系统配置中设置Ollama模型。推荐使用llava等多模态模型以获得最佳试卷识别效果。")

    # Call Ollama vision
    base = endpoint.rstrip("/").replace("/v1", "")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
            # Try Ollama native API with images
            r = await client.post(base + "/api/generate", json={
                "model": model_name,
                "prompt": PAPER_IMPORT_PROMPT,
                "images": [image_b64],
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 4096},
            })

            if r.status_code == 400 and "does not support images" in r.text.lower():
                raise HTTPException(
                    400,
                    detail=f"模型 {model_name} 不支持图片识别，请使用多模态模型(llava/minicpm-v等)。"
                    "也可以在试卷录入页面手动输入试题。"
                )

            if r.status_code != 200:
                return {"ok": False, "error": f"Ollama返回错误 {r.status_code}: {r.text[:300]}"}

            content = r.json().get("response", "")
            questions = _parse_llm_response(content)

            if not questions:
                return {"ok": False, "error": "无法从图片中识别出试题，请确认图片清晰且包含试卷内容",
                        "raw": content[:500], "model": model_name}

            return {"ok": True, "questions": questions, "model": model_name,
                    "count": len(questions)}

    except httpx.ConnectError:
        raise HTTPException(400, detail="无法连接Ollama服务，请确认服务已启动")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"识别失败: {str(e)}")


def _parse_llm_response(content: str) -> list:
    """Extract JSON array from LLM response text."""
    try:
        data = json.loads(content)
        if isinstance(data, list): return data
        if isinstance(data, dict):
            if "questions" in data: return data["questions"]
    except json.JSONDecodeError:
        pass

    # Try to find JSON array
    import re
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        try: return json.loads(match.group())
        except json.JSONDecodeError: pass

    # Try code block
    match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', content, re.DOTALL)
    if match:
        try: return json.loads(match.group(1))
        except json.JSONDecodeError: pass

    # Try multiple code blocks
    matches = re.findall(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL)
    for m in matches:
        try: return json.loads(m)
        except json.JSONDecodeError: continue

    return []


@router.post("/import-confirm")
async def import_paper_confirm(
    questions: List[dict] = Body(..., description="识别后的试题列表"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 2: Confirm and save recognized questions to question bank."""
    if current_user.user_type not in ("TEACHER", "QUESTION_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")

    if not questions:
        raise HTTPException(400, detail="试题列表为空")

    saved = []
    for qdata in questions:
        # Normalize correct_answer format
        correct_answer = qdata.get("correct_answer", "")
        if isinstance(correct_answer, (dict, list)):
            correct_answer = json.dumps(correct_answer, ensure_ascii=False)

        # Build options JSON if present
        options = qdata.get("options")
        if options is not None:
            answer_data = {"options": options, "correct_answer": qdata.get("correct_answer", "")}
            if isinstance(answer_data["correct_answer"], str):
                pass  # keep as-is
            correct_answer = json.dumps(answer_data, ensure_ascii=False)

        question = Question(
            title=qdata.get("title", ""),
            question_type=qdata.get("question_type", "SINGLE_CHOICE"),
            difficulty=qdata.get("difficulty", "MEDIUM"),
            subject=qdata.get("subject", "数学"),
            grade_level=qdata.get("grade_level", "八年级"),
            score=qdata.get("score", 5),
            correct_answer=correct_answer,
            explanation=qdata.get("explanation", ""),
            source="OCR_UPLOAD",
            review_status="PENDING",
            created_by=uuid.UUID(current_user.id),
        )
        db.add(question)
        saved.append(question)

    await db.commit()
    return {"ok": True, "count": len(saved),
            "ids": [str(q.id) for q in saved],
            "message": f"已入库 {len(saved)} 道试题，状态为待审核"}
