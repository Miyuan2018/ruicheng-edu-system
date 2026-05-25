"""LLM question generation service — calls Ollama API."""
import json
import httpx
from app.services.config_service import load_config


PROMPT_TEMPLATE = """你是一位专业的教育题目生成专家。请根据以下要求生成试题，直接返回JSON数组，不要任何其他文字。

要求：
- 知识点：{knowledge_point}
- 难度：{difficulty}（EASY/MEDIUM/HARD）
- 题型：{question_type}
- 数量：{count}道
- 年级：{grade_level}
- 学科：{subject}

{kp_requirement}
返回格式（严格的JSON数组，不要markdown代码块）：
[
  {{
    "title": "题目内容",
    "question_type": "{question_type}",
    "difficulty": "{difficulty}",
    "subject": "{subject}",
    "grade_level": "{grade_level}",
    "score": 5,
    "correct_answer": {answer_format},
    "explanation": "解析说明"
  }}
]

{type_instructions}
"""

TYPE_INSTRUCTIONS = {
    "SINGLE_CHOICE": '''题目为单选题。
correct_answer 格式：{"options":[{"label":"A","text":"选项A内容"},{"label":"B","text":"选项B内容"},{"label":"C","text":"选项C内容"},{"label":"D","text":"选项D内容"}],"correct_answer":"A"}''',
    "MULTIPLE_CHOICE": '''题目为多选题。
correct_answer 格式：{"options":[{"label":"A","text":"选项A内容"},{"label":"B","text":"选项B内容"},{"label":"C","text":"选项C内容"},{"label":"D","text":"选项D内容"}],"correct_answer":["A","C"]}''',
    "FILL_BLANK": '''题目为填空题。
correct_answer 格式：{"options":null,"correct_answer":["答案1","答案2"]}，多个可接受的答案都列出''',
    "SUBJECTIVE": '''题目为解答题/问答题。
correct_answer 格式：{"options":null,"correct_answer":{"keywords":["关键词1","关键词2"],"max_score":10}}''',
}

ANSWER_FORMATS = {
    "SINGLE_CHOICE": '{"options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correct_answer":"A"}',
    "MULTIPLE_CHOICE": '{"options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correct_answer":["A","C"]}',
    "FILL_BLANK": '{"options":null,"correct_answer":["答案"]}',
    "SUBJECTIVE": '{"options":null,"correct_answer":{"keywords":["关键词"],"max_score":10}}',
}


async def generate_questions(
    knowledge_point: str,
    difficulty: str = "MEDIUM",
    question_type: str = "SINGLE_CHOICE",
    count: int = 5,
    subject: str = "数学",
    grade_level: str = "八年级",
    model: str = None,
    provider: str = "ollama",
) -> dict:
    """Call LLM to generate questions. Supports Ollama and DeepSeek. Returns {ok, questions, error}."""
    cfg = load_config()
    llm = cfg.get("llm", {})

    if provider == "deepseek":
        return await _generate_deepseek(
            knowledge_point, difficulty, question_type, count,
            subject, grade_level, model, llm,
        )

    # Ollama
    ollama_cfg = llm.get("ollama", {})
    endpoint = ollama_cfg.get("endpoint", "http://127.0.0.1:11434/v1")
    model_name = model or ollama_cfg.get("model", "nemotron-3-super:120b")
    prompt = _build_prompt(knowledge_point, difficulty, question_type, count, subject, grade_level)

    base = endpoint.rstrip("/").replace("/v1", "")
    url = f"{base}/api/generate"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
            r = await client.post(url, json={
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.7, "num_predict": 4096},
            })
            if r.status_code != 200:
                return {"ok": False, "error": f"Ollama返回{r.status_code}: {r.text[:300]}"}

            content = r.json().get("response", "")
            questions = _parse_llm_response(content)
            if not questions:
                return {"ok": False, "error": "无法解析LLM返回的试题数据", "raw": content[:500]}

            questions = _dedup_questions(questions)[:count]
            return {"ok": True, "questions": questions, "model": model_name}
    except httpx.ConnectError:
        return {"ok": False, "error": "无法连接Ollama服务，请确认服务已启动"}
    except Exception as e:
        return {"ok": False, "error": f"生成失败: {str(e)}"}


def _build_prompt(
    knowledge_point: str, difficulty: str, question_type: str,
    count: int, subject: str, grade_level: str,
) -> str:
    instructions = TYPE_INSTRUCTIONS.get(question_type, TYPE_INSTRUCTIONS["SINGLE_CHOICE"])
    answer_format = ANSWER_FORMATS.get(question_type, ANSWER_FORMATS["SINGLE_CHOICE"])
    # If knowledge_point contains commas, treat as multiple required topics (AND)
    kps = [kp.strip() for kp in knowledge_point.split(",") if kp.strip()]
    if len(kps) > 1:
        kp_text = "、".join(kps)
        kp_requirement = f"重要：每道题必须同时覆盖以上全部 {len(kps)} 个知识点（{kp_text}），缺一不可。"
    else:
        kp_requirement = ""
    return PROMPT_TEMPLATE.format(
        knowledge_point=knowledge_point,
        difficulty=difficulty,
        question_type=question_type,
        count=count,
        subject=subject,
        grade_level=grade_level,
        kp_requirement=kp_requirement,
        answer_format=answer_format,
        type_instructions=instructions,
    )


async def _generate_deepseek(
    knowledge_point: str, difficulty: str, question_type: str,
    count: int, subject: str, grade_level: str,
    model: str, llm: dict,
) -> dict:
    """Generate questions using DeepSeek API (Anthropic-compatible Messages API)."""
    ds_cfg = llm.get("deepseek", {})
    api_key = ds_cfg.get("api_key", "")
    model_name = model or ds_cfg.get("model", "deepseek-chat")
    endpoint = ds_cfg.get("endpoint", "https://api.deepseek.com/anthropic/v1/messages")
    prompt = _build_prompt(knowledge_point, difficulty, question_type, count, subject, grade_level)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
            r = await client.post(
                endpoint,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "max_tokens": 4096,
                    "system": "你是一位专业的教育题目生成专家。直接返回JSON数组，不要任何其他文字，不要markdown代码块。",
                    "messages": [
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            if r.status_code != 200:
                err_data = r.json() if r.text else {}
                err_msg = err_data.get("error", {}).get("message", r.text[:300]) if isinstance(err_data, dict) else r.text[:300]
                return {"ok": False, "error": f"DeepSeek返回{r.status_code}: {err_msg}"}

            # Extract text from Anthropic response (skip "thinking" blocks)
            content_blocks = r.json().get("content", [])
            content = "".join(b["text"] for b in content_blocks if b.get("type") == "text")
            questions = _parse_llm_response(content)
            if not questions:
                return {"ok": False, "error": "无法解析LLM返回的试题数据", "raw": content[:500]}

            questions = _dedup_questions(questions)[:count]
            return {"ok": True, "questions": questions, "model": model_name}
    except httpx.ConnectError:
        return {"ok": False, "error": "无法连接 DeepSeek API"}
    except Exception as e:
        return {"ok": False, "error": f"生成失败: {str(e)}"}


def _dedup_questions(questions: list) -> list:
    """Remove duplicate questions by title."""
    seen = set()
    result = []
    for q in questions:
        title = q.get("title", "").strip()
        if title and title not in seen:
            seen.add(title)
            result.append(q)
    return result


PRACTICE_PROMPT = """你是一位专业的教育题目生成专家。学生做错了一道题，请生成一道同类型、同难度、测试相同知识点的变式练习题。

原始题目：{original_title}
正确答案：{correct_answer}
学生错误答案：{student_answer}
错误类型：{error_type}

要求：
- 题型：{question_type}
- 难度：{difficulty}
- 学科：{subject}
- 年级：{grade_level}
- 数量：1道

请生成一道与原始题目**知识点相同但场景/数据/表述不同**的练习题，帮助学生巩固薄弱点。
直接返回JSON数组，不要任何其他文字，不要markdown代码块。

[
  {{
    "title": "题目内容",
    "question_type": "{question_type}",
    "difficulty": "{difficulty}",
    "subject": "{subject}",
    "grade_level": "{grade_level}",
    "score": 5,
    "correct_answer": {answer_format},
    "explanation": "解题思路和解析"
  }}
]

{type_instructions}"""


async def generate_practice_question(
    original_title: str,
    correct_answer: str,
    student_answer: str,
    error_type: str,
    question_type: str = "SINGLE_CHOICE",
    difficulty: str = "MEDIUM",
    subject: str = "数学",
    grade_level: str = "八年级",
) -> dict:
    """Generate a single variant practice question based on a mistake."""
    cfg = load_config()
    llm = cfg.get("llm", {})
    provider = llm.get("current", "ollama")

    instructions = TYPE_INSTRUCTIONS.get(question_type, TYPE_INSTRUCTIONS["SINGLE_CHOICE"])
    answer_format = ANSWER_FORMATS.get(question_type, ANSWER_FORMATS["SINGLE_CHOICE"])
    prompt = PRACTICE_PROMPT.format(
        original_title=original_title,
        correct_answer=correct_answer,
        student_answer=student_answer,
        error_type=error_type,
        question_type=question_type,
        difficulty=difficulty,
        subject=subject,
        grade_level=grade_level,
        answer_format=answer_format,
        type_instructions=instructions,
    )

    if provider == "deepseek":
        return await _generate_practice_deepseek(prompt, llm)
    return await _generate_practice_ollama(prompt, llm)


async def _generate_practice_ollama(prompt: str, llm: dict) -> dict:
    ollama_cfg = llm.get("ollama", {})
    endpoint = ollama_cfg.get("endpoint", "http://127.0.0.1:11434/v1")
    model_name = ollama_cfg.get("model", "nemotron-3-super:120b")
    base = endpoint.rstrip("/").replace("/v1", "")
    url = f"{base}/api/generate"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
            r = await client.post(url, json={
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.7, "num_predict": 2048},
            })
            if r.status_code != 200:
                return {"ok": False, "error": f"Ollama返回{r.status_code}"}
            content = r.json().get("response", "")
            questions = _parse_llm_response(content)
            return {"ok": True, "question": questions[0]} if questions else {"ok": False, "error": "无法解析LLM返回"}
    except httpx.ConnectError:
        return {"ok": False, "error": "无法连接Ollama服务"}
    except Exception as e:
        return {"ok": False, "error": f"生成失败: {str(e)}"}


async def _generate_practice_deepseek(prompt: str, llm: dict) -> dict:
    ds_cfg = llm.get("deepseek", {})
    api_key = ds_cfg.get("api_key", "")
    model_name = ds_cfg.get("model", "deepseek-chat")
    endpoint = ds_cfg.get("endpoint", "https://api.deepseek.com/anthropic/v1/messages")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
            r = await client.post(
                endpoint,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "max_tokens": 2048,
                    "system": "你是一位专业的教育题目生成专家。直接返回JSON数组，不要任何其他文字，不要markdown代码块。",
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            if r.status_code != 200:
                return {"ok": False, "error": f"DeepSeek返回{r.status_code}"}
            content_blocks = r.json().get("content", [])
            content = "".join(b["text"] for b in content_blocks if b.get("type") == "text")
            questions = _parse_llm_response(content)
            return {"ok": True, "question": questions[0]} if questions else {"ok": False, "error": "无法解析LLM返回"}
    except httpx.ConnectError:
        return {"ok": False, "error": "无法连接 DeepSeek API"}
    except Exception as e:
        return {"ok": False, "error": f"生成失败: {str(e)}"}


def _parse_llm_response(content: str) -> list:
    """Extract JSON array from LLM response."""
    # Try direct parse
    try:
        data = json.loads(content)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "questions" in data:
            return data["questions"]
    except json.JSONDecodeError:
        pass

    # Try to find JSON array between [ and ]
    import re
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Try code block
    match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    return []
