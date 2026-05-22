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
) -> dict:
    """Call Ollama to generate questions. Returns {ok, questions, error}."""
    cfg = load_config()
    llm = cfg.get("llm", {})
    endpoint = llm.get("endpoint", "http://127.0.0.1:11434/v1")
    model_name = model or llm.get("model", "qwen3-coder:30b")

    instructions = TYPE_INSTRUCTIONS.get(question_type, TYPE_INSTRUCTIONS["SINGLE_CHOICE"])
    answer_format = ANSWER_FORMATS.get(question_type, ANSWER_FORMATS["SINGLE_CHOICE"])

    prompt = PROMPT_TEMPLATE.format(
        knowledge_point=knowledge_point,
        difficulty=difficulty,
        question_type=question_type,
        count=count,
        subject=subject,
        grade_level=grade_level,
        answer_format=answer_format,
        type_instructions=instructions,
    )

    # Use Ollama native API for broader compatibility
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
            # Try to extract JSON array from response
            questions = _parse_llm_response(content)
            if not questions:
                return {"ok": False, "error": "无法解析LLM返回的试题数据", "raw": content[:500]}

            return {"ok": True, "questions": questions, "model": model_name}
    except httpx.ConnectError:
        return {"ok": False, "error": "无法连接Ollama服务，请确认服务已启动"}
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
