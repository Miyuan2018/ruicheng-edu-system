"""Web scraper — DuckDuckGo → Baidu → LLM fallback + LLM formatting = structured questions."""
import re
import json
import httpx
from bs4 import BeautifulSoup

GRADE_LABELS = {"G5":"五年级","G6":"六年级","G7":"七年级","G8":"八年级","G9":"九年级","G10":"高一","G11":"高二","G12":"高三"}
TYPE_LABELS = {"SINGLE_CHOICE":"选择题","MULTIPLE_CHOICE":"多选题","FILL_BLANK":"填空题","SUBJECTIVE":"解答题"}


async def search_questions(
    knowledge_point: str, subject: str = "数学", grade_level: str = "G8",
    difficulty: str = "MEDIUM", question_type: str = "SINGLE_CHOICE",
    count: int = 5, provider: str = "deepseek",
) -> list[dict]:
    """搜索网络 + LLM 格式化 → 结构化题目列表."""

    grade_label = GRADE_LABELS.get(grade_level, grade_level)
    type_label = TYPE_LABELS.get(question_type, "试题")
    query = f"{knowledge_point} {subject} {grade_label} {type_label}"

    # Step 1: 三级搜索回退
    snippets = await _search_duckduckgo(query)
    if not snippets:
        snippets = await _search_baidu(query)

    # Step 2: LaTeX 预处理
    from app.utils.latex import format_latex
    snippets = [format_latex(s) for s in snippets]

    # Step 3: LLM 格式化
    if snippets:
        context = "\n".join(f"{i+1}. {s}" for i, s in enumerate(snippets[:15]))
    else:
        context = f"请根据你的知识，生成{count}道关于{knowledge_point}的{subject}{grade_label}{type_label}题目。"

    prompt = _build_prompt(knowledge_point, subject, grade_label, type_label, difficulty, question_type, count, context)

    try:
        results = await _llm_format(prompt, count, question_type, difficulty, subject, grade_level, provider)
        if not results:
            results = await _llm_format(prompt, count, question_type, difficulty, subject, grade_level, provider)
        return results
    except Exception:
        return []


def _build_prompt(kp: str, subject: str, grade_label: str, type_label: str,
                  diff: str, qtype: str, count: int, context: str) -> str:
    return f"""你是教育试题整理专家。根据以下材料，生成{count}道关于"{kp}"的{subject}{grade_label}{type_label}，难度{diff}。

材料：
{context}

返回格式（严格JSON数组，无其他文字）：
[
  {{
    "title": "题目标题",
    "question_type": "{qtype}",
    "difficulty": "{diff}",
    "score": 5,
    "correct_answer": "...",
    "explanation": "解析说明"
  }}
]

规则：
1. title 必填且非空，长度 2-500
2. question_type 必须是 SINGLE_CHOICE|MULTIPLE_CHOICE|FILL_BLANK|SUBJECTIVE 之一
3. difficulty 必须是 EASY|MEDIUM|HARD 之一
4. score 是正整数
5. correct_answer 必填非空：选择题用"A"/["A","C"]，填空题用答案文本，解答题用关键词
6. 至少{count}道题；材料不足可自行补充
7. 数学表达式用 LaTeX 格式（如 x^{{2}}）"""


# ─── 搜索源 ───────────────────────────────────────────────────

async def _search_duckduckgo(query: str, max_results: int = 10) -> list[str]:
    snippets = []
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            r = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                },
            )
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                for item in soup.select(".result__body")[:max_results]:
                    text = item.get_text(" ", strip=True)
                    if len(text) > 20:
                        snippets.append(text)
    except Exception:
        pass
    return snippets


async def _search_baidu(query: str, max_results: int = 10) -> list[str]:
    snippets = []
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            r = await client.get(
                "https://www.baidu.com/s",
                params={"wd": query, "rn": str(max_results)},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                },
            )
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                for item in soup.select("div.result, div.result-op")[:max_results]:
                    text = item.get_text(" ", strip=True)
                    if len(text) > 20:
                        snippets.append(text)
    except Exception:
        pass
    return snippets


# ─── LLM 格式化 ────────────────────────────────────────────────

async def _llm_format(prompt: str, count: int, qtype: str, diff: str,
                       subj: str, grade: str, provider: str) -> list[dict]:
    from app.services.config_service import load_config
    cfg = load_config()
    llm = cfg.get("llm", {})

    if provider == "deepseek":
        ds = llm.get("deepseek", {})
        endpoint = ds.get("endpoint", "https://api.deepseek.com/anthropic/v1/messages")
        api_key = ds.get("api_key", "")
        model = ds.get("model", "deepseek-chat")
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            r = await client.post(endpoint, headers={
                "x-api-key": api_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json",
            }, json={
                "model": model, "max_tokens": 4096,
                "messages": [{"role": "user", "content": prompt}],
            })
            if r.status_code != 200:
                return []
            content_blocks = r.json().get("content", [])
            content = "".join(b["text"] for b in content_blocks if b.get("type") == "text")
    else:
        ollama = llm.get("ollama", {})
        base = ollama.get("endpoint", "http://127.0.0.1:11434/v1").rstrip("/").replace("/v1", "")
        model = ollama.get("model", "")
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            r = await client.post(f"{base}/api/generate", json={
                "model": model, "prompt": prompt, "stream": False,
                "options": {"temperature": 0.3, "num_predict": 4096},
            })
            if r.status_code != 200:
                return []
            content = r.json().get("response", "")

    return _parse_questions(content, qtype, diff, subj, grade)


def _parse_questions(content: str, qtype: str, diff: str, subj: str, grade: str) -> list[dict]:
    # 1. 优先匹配 ```json 代码块
    match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', content, re.DOTALL)
    if not match:
        # 2. 正则提取数组
        match = re.search(r'\[.*\]', content, re.DOTALL)
    if not match:
        return []

    json_str = match.group(1) if match.lastindex else match.group()

    # 3. JSON 解析 + 自动修复
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError:
        data = _repair_json(json_str)
        if data is None:
            return []

    if not isinstance(data, list):
        return []

    # 4. 字段校验
    VALID_TYPES = {"SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_BLANK", "SUBJECTIVE"}
    VALID_DIFFS = {"EASY", "MEDIUM", "HARD"}

    results = []
    for item in data:
        title = str(item.get("title", "")).strip()
        if not title or len(title) < 2:
            continue
        itype = item.get("question_type", qtype)
        if itype not in VALID_TYPES:
            itype = qtype
        idiff = item.get("difficulty", diff)
        if idiff not in VALID_DIFFS:
            idiff = diff
        score = item.get("score", 5)
        if not isinstance(score, int) or score < 1:
            score = 5
        ca = item.get("correct_answer", "")
        if isinstance(ca, (dict, list)):
            ca = json.dumps(ca, ensure_ascii=False)
        ca = str(ca).strip()
        if not ca:
            continue
        results.append({
            "title": title,
            "question_type": itype,
            "difficulty": idiff,
            "subject": item.get("subject", subj),
            "grade_level": item.get("grade_level", grade),
            "score": score,
            "correct_answer": ca,
            "explanation": str(item.get("explanation", "")),
            "source_url": "web_scrape",
        })
    return results


def _repair_json(json_str: str) -> list | None:
    stripped = json_str.strip()
    open_braces = stripped.count('{') - stripped.count('}')
    open_brackets = stripped.count('[') - stripped.count(']')
    repaired = stripped + '}' * max(0, open_braces) + ']' * max(0, open_brackets)
    try:
        return json.loads(repaired)
    except Exception:
        return None
