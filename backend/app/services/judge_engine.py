"""Rule-based grading engine — handles JSON answer format for all question types.

Each grader receives max_score directly and computes score_obtained relative to it.
No post-hoc rescaling is performed.
"""
import json
import re
from typing import Optional
from dataclasses import dataclass


@dataclass
class GradeResult:
    is_correct: bool
    score_obtained: float
    max_score: float
    feedback: str


def _parse_answer(correct_answer: Optional[str]) -> dict:
    """Parse the JSON answer data from correct_answer column."""
    if not correct_answer:
        return {}
    try:
        return json.loads(correct_answer)
    except (json.JSONDecodeError, TypeError):
        # Legacy plain-text answer
        return {"correct_answer": correct_answer}


def grade_single_choice(student_answer: str, answer_data: dict, max_score: float) -> GradeResult:
    expected = str(answer_data.get("correct_answer", "")).strip().upper()
    actual = (student_answer or "").strip().upper()
    correct = actual == expected
    return GradeResult(
        is_correct=correct,
        score_obtained=max_score if correct else 0.0,
        max_score=max_score,
        feedback="正确" if correct else f"正确答案是 {expected}",
    )


def grade_multiple_choice(student_answer: str, answer_data: dict, max_score: float) -> GradeResult:
    expected = answer_data.get("correct_answer", [])
    if isinstance(expected, str):
        expected = list(expected.upper().replace(",", "").replace(" ", ""))
    expected_set = set(str(x).strip().upper() for x in expected)
    actual = (student_answer or "").upper().replace(",", "").replace(" ", "")
    actual_set = set(actual)
    if not expected_set:
        return GradeResult(False, 0.0, max_score, "题目答案未配置")
    overlap = len(actual_set & expected_set)
    total = len(expected_set)
    correct = actual_set == expected_set
    # Partial credit: overlap / total_correct * max_score
    score = (overlap / total) * max_score if total > 0 else 0.0
    feedback = "完全正确" if correct else f"部分正确({overlap}/{total}), 正确答案是 {','.join(sorted(expected_set))}"
    return GradeResult(is_correct=correct, score_obtained=score, max_score=max_score, feedback=feedback)


def grade_fill_blank(student_answer: str, answer_data: dict, max_score: float) -> GradeResult:
    acceptable = answer_data.get("correct_answer", [])
    if isinstance(acceptable, str):
        acceptable = [a.strip() for a in acceptable.split("|")]

    # Multiple blanks: each blank can have multiple acceptable answers
    # If answer_data has a list of lists, each sub-list is for one blank
    if isinstance(acceptable, list) and len(acceptable) > 0 and isinstance(acceptable[0], list):
        # Multi-blank mode: [[ans1a, ans1b], [ans2a], ...]
        total_blanks = len(acceptable)
        matched = 0
        student_answers = (student_answer or "").split("|")
        for i, blank_acceptable in enumerate(acceptable):
            s = student_answers[i].strip().lower() if i < len(student_answers) else ""
            if any(s == str(a).strip().lower() for a in blank_acceptable):
                matched += 1
        correct = matched == total_blanks
        score = (matched / total_blanks) * max_score if total_blanks > 0 else 0.0
        all_answers = [" 或 ".join(str(a) for a in blank) for blank in acceptable]
        feedback = "正确" if correct else f"正确答案是 {' | '.join(all_answers)}"
    else:
        # Single blank or multiple acceptable answers for one blank
        s = (student_answer or "").strip().lower()
        correct = any(s == str(a).strip().lower() for a in acceptable)
        score = max_score if correct else 0.0
        feedback = "正确" if correct else f"正确答案是 {' 或 '.join(str(a) for a in acceptable)}"

    return GradeResult(
        is_correct=correct,
        score_obtained=score,
        max_score=max_score,
        feedback=feedback,
    )


def grade_subjective(student_answer: str, answer_data: dict, max_score: float) -> GradeResult:
    keywords = answer_data.get("correct_answer", {})
    if isinstance(keywords, dict):
        keywords = keywords.get("keywords", [])
    if not keywords:
        return GradeResult(False, 0.0, max_score, "待人工评阅")

    if not student_answer:
        return GradeResult(False, 0.0, max_score, "未作答")

    student_lower = student_answer.lower()
    matched = sum(1 for kw in keywords if str(kw).lower() in student_lower)
    ratio = matched / len(keywords) if keywords else 0

    if ratio >= 0.8:
        return GradeResult(True, max_score * 0.9, max_score, f"关键词匹配 {matched}/{len(keywords)}, 建议人工复核")
    elif ratio >= 0.4:
        return GradeResult(False, max_score * 0.5, max_score, f"部分匹配({matched}/{len(keywords)}), 请参考标准答案")
    else:
        return GradeResult(False, max_score * 0.1, max_score, f"匹配度低({matched}/{len(keywords)}), 请参考标准答案")


GRADERS = {
    "SINGLE_CHOICE": grade_single_choice,
    "MULTIPLE_CHOICE": grade_multiple_choice,
    "FILL_BLANK": grade_fill_blank,
    "SUBJECTIVE": grade_subjective,
}


def grade_answer(question_type: str, student_answer: Optional[str], correct_answer: Optional[str], max_score: float) -> GradeResult:
    answer_data = _parse_answer(correct_answer)
    grader = GRADERS.get(question_type, grade_subjective)
    return grader(student_answer or "", answer_data, max_score)
