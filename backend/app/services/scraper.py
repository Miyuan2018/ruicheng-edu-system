"""Web scraper — search internet + LLM formatting = structured questions."""
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
    """Search web + LLM formatting."""

    grade_label = GRADE_LABELS.get(grade_level, grade_level)
    type_label = TYPE_LABELS.get(question_type, "试题")
    query = f"{knowledge_point} {subject} {grade_label} {type_label}"

    # Step 1: Web search
    snippets = await _search_bing_text(query, min(count * 3, 15))
    if len(snippets) < 3:
        snippets += await _search_bing_text(f"{knowledge_point} {subject} 题目", 10)

    if not snippets:
        return []

    # Step 2: LLM formats snippets into questions
    context = "\n".join(f"{i+1}. {s}" for i, s in enumerate(snippets[:15]))
    prompt = f"""你是一位教育试题整理专家。从以下网络搜索结果中，提取并整理出{count}道关于"{knowledge_point}"的{subject}{grade_label}{type_label}，难度{difficulty}。

网络搜索结果：
{context}

要求：
1. 每道题必须有明确的问题和正确答案
2. 选择题必须包含A/B/C/D四个选项
3. 直接返回JSON数组格式，不要任何其他文字：
[
  {{
    "title": "题目内容",
    "question_type": "{question_type}",
    "difficulty": "{difficulty}",
    "subject": "{subject}",
    "grade_level": "{grade_level}",
    "score": 5,
    "correct_answer": {{选项JSON}},
    "explanation": "解析说明"
  }}
]
4. 至少生成{count}道题
5. 如果搜索结果中题目信息不足，可根据知识点自行补充"""

    try:
        return await _llm_format(prompt, count, question_type, difficulty, subject, grade_level, provider)
    except Exception:
        return []


async def _search_bing_text(query: str, max_results: int = 10) -> list[str]:
    """Search Bing and return text snippets."""
    snippets = []
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            r = await client.get(
                "https://www.bing.com/search",
                params={"q": query, "setlang": "zh-Hans"},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                },
            )
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                for item in soup.select("li.b_algo")[:max_results]:
                    text_parts = []
                    h2 = item.select_one("h2")
                    if h2: text_parts.append(h2.get_text(strip=True))
                    p = item.select_one(".b_caption p, .b_lineclamp2")
                    if p: text_parts.append(p.get_text(strip=True))
                    snippet = " ".join(text_parts).strip()
                    if len(snippet) > 20:
                        snippets.append(snippet)
    except Exception:
        pass
    return snippets


async def _llm_format(prompt: str, count: int, qtype: str, diff: str,
                       subj: str, grade: str, provider: str) -> list[dict]:
    """Call LLM to format scraped text into questions."""
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
    """Parse LLM response into question dicts."""
    # Extract JSON array
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if not match:
        match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', content, re.DOTALL)
    if not match:
        return []

    try:
        data = json.loads(match.group(1) if match.lastindex else match.group())
    except json.JSONDecodeError:
        return []

    if not isinstance(data, list):
        return []

    results = []
    for item in data:
        ca = item.get("correct_answer", {})
        if isinstance(ca, (dict, list)):
            ca = json.dumps(ca, ensure_ascii=False)
        results.append({
            "title": item.get("title", ""),
            "question_type": item.get("question_type", qtype),
            "difficulty": item.get("difficulty", diff),
            "subject": item.get("subject", subj),
            "grade_level": item.get("grade_level", grade),
            "score": item.get("score", 5),
            "correct_answer": ca or "",
            "explanation": item.get("explanation", ""),
            "source_url": "web_scrape",
        })
    return results


def _extract_question_from_text(
    text: str, knowledge_point: str, subject: str,
    grade_level: str, difficulty: str, question_type: str,
    source_url: str = "",
) -> dict | None:
    """Try to parse a question from text."""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()

    if len(text) < 10:
        return None

    # Look for choice patterns: A.xxx B.xxx C.xxx D.xxx
    choice_pattern = re.compile(
        r'(.+?)\s*[AＡ][.．、]\s*(.+?)\s*[BＢ][.．、]\s*(.+?)\s*[CＣ][.．、]\s*(.+?)\s*(?:[DＤ][.．、]\s*(.+?))?\s*(?:答案[：:]\s*([A-DＡ-Ｄ]))?'
    )
    match = choice_pattern.search(text)
    if match:
        groups = match.groups()
        title = groups[0].strip()
        options = []
        labels = ['A', 'B', 'C', 'D']
        for i in range(1, min(5, len(groups))):
            if groups[i]:
                options.append({"label": labels[i-1], "text": groups[i].strip()})
        correct = groups[5] if len(groups) > 5 and groups[5] else ""
        if len(title) > 6 and len(options) >= 2:
            return _build_question(title, question_type, difficulty, subject, grade_level,
                                   options, correct, source_url)

    # Look for brackets/填空 pattern: ___ or （）
    blank_pattern = re.compile(r'(.+?)[（(]\s*[）)]|(.+?)_{2,}|(.+?)____')
    match = blank_pattern.search(text)
    if match and question_type == "FILL_BLANK":
        title = text[:200]
        return _build_question(title, "FILL_BLANK", difficulty, subject, grade_level,
                               None, ["(待校验)"], source_url)

    # Fallback
    return _build_question(text[:200], question_type, difficulty, subject, grade_level,
                           None, ["(待校验)"], source_url)


def _build_question(title, qtype, diff, subj, grade, options, answer, url):
    ca = {"options": options, "correct_answer": answer} if options else {"options": None, "correct_answer": answer}
    return {
        "title": title,
        "question_type": qtype,
        "difficulty": diff,
        "subject": subj,
        "grade_level": grade,
        "score": 5,
        "correct_answer": json.dumps(ca, ensure_ascii=False),
        "explanation": f"网络抓取: {url}",
        "source_url": url,
    }


async def _search_bing(
    query: str, knowledge_point: str, subject: str,
    grade_level: str, difficulty: str, question_type: str,
    count: int,
) -> list[dict]:
    """Search Bing and extract question snippets."""
    results = []

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            r = await client.get(
                "https://www.bing.com/search",
                params={"q": query, "setlang": "zh-Hans", "cc": "cn"},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                },
            )
            if r.status_code != 200:
                return results

            soup = BeautifulSoup(r.text, "html.parser")

            # Bing search result items
            for item in soup.select("li.b_algo")[:count + 5]:
                title_el = item.select_one("h2 a")
                snippet_el = item.select_one(".b_caption p, .b_lineclamp2")
                link_el = item.select_one("h2 a")

                text = ""
                if title_el:
                    text += title_el.get_text(strip=True) + " "
                if snippet_el:
                    text += snippet_el.get_text(strip=True)

                url = link_el.get("href", "") if link_el else ""

                q = _extract_question_from_text(
                    text, knowledge_point, subject, grade_level,
                    difficulty, question_type, source_url=url,
                )
                if q and len(results) < count:
                    results.append(q)

    except Exception:
        pass

    return results
