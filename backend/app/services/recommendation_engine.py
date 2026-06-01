"""智能推荐引擎 — 配额分解 + 加权选题 + 换题推荐"""
from dataclasses import dataclass

KNOWLEDGE_MATCH_WEIGHT = 40.0
TYPICAL_QUESTION_BONUS = 30.0
APPROVED_QUESTION_BONUS = 15.0
FRESHNESS_BONUS = 20.0
DIFFICULTY_MATCH_BONUS = 10.0
DEFAULT_RATIO = 0.33
DIFFICULTIES = ("EASY", "MEDIUM", "HARD")

__all__ = [
    "QuotaTarget",
    "distribute_quotas",
    "score_question",
    "score_for_difficulty",
    "select_for_targets",
]


@dataclass(frozen=True)
class QuotaTarget:
    """单个选题目标"""
    question_type: str
    score: int
    target_difficulty: str  # EASY / MEDIUM / HARD


def distribute_quotas(
    type_configs: list[dict],
    difficulty_ratio: dict[str, float],
) -> list[QuotaTarget]:
    """按难度比例将题型配置分解为带难度标签的选题目标列表."""
    targets: list[QuotaTarget] = []
    for cfg in type_configs:
        total = cfg["count"]
        quotas: dict[str, int] = {}
        for diff in DIFFICULTIES:
            quotas[diff] = int(total * difficulty_ratio.get(diff, DEFAULT_RATIO))
        remainder = total - sum(quotas.values())
        if remainder > 0:
            quotas["MEDIUM"] += remainder
        for diff in DIFFICULTIES:
            for _ in range(quotas[diff]):
                targets.append(QuotaTarget(
                    question_type=cfg["question_type"],
                    score=cfg["score_per_question"],
                    target_difficulty=diff,
                ))
    return targets


def score_question(
    question,
    paper_knowledge_node_ids: set[str],
    used_ids: set[str],
) -> float:
    """计算题目对当前需求的匹配得分 (0-90)"""
    s = 0.0
    q_kn_ids = set(getattr(question, 'kn_ids', []) or [])
    if paper_knowledge_node_ids and q_kn_ids:
        matched = len(q_kn_ids & paper_knowledge_node_ids)
        s += KNOWLEDGE_MATCH_WEIGHT * (matched / len(paper_knowledge_node_ids))

    if getattr(question, 'is_typical', False):
        s += TYPICAL_QUESTION_BONUS
    elif getattr(question, 'review_status', '') == 'APPROVED':
        s += APPROVED_QUESTION_BONUS

    qid = str(getattr(question, 'id', ''))
    if qid not in used_ids:
        s += FRESHNESS_BONUS

    return s


def score_for_difficulty(question, target_difficulty: str) -> float:
    """难度附加分 (0-10)，仅在匹配时加分"""
    if getattr(question, 'difficulty', None) == target_difficulty:
        return DIFFICULTY_MATCH_BONUS
    return 0.0


# ── Async: select_for_targets ─────────────────────────────────

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.question import Question
from app.models.knowledge_node import QuestionKnowledgeNode, KnowledgeNode


async def select_for_targets(
    db: AsyncSession,
    targets: list[QuotaTarget],
    knowledge_node_ids: set[str],
    subject: Optional[str] = None,
) -> tuple[list[dict], dict]:
    """为所有目标选题，返回题目列表和约束仪表盘数据."""
    used_ids: set[str] = set()
    questions: list[dict] = []

    for target in targets:
        conditions = [
            Question.is_active == True,
            Question.review_status == "APPROVED",
            Question.question_type == target.question_type,
            Question.difficulty == target.target_difficulty,
        ]
        if subject:
            conditions.append(Question.subject == subject)

        result = await db.execute(select(Question).where(*conditions))
        candidates = [q for q in result.scalars().all() if str(q.id) not in used_ids]

        if not candidates:
            continue

        # Load knowledge node IDs for each candidate
        for q in candidates:
            kn_rows = await db.execute(
                select(KnowledgeNode.id).join(
                    QuestionKnowledgeNode,
                    QuestionKnowledgeNode.knowledge_node_id == KnowledgeNode.id,
                ).where(QuestionKnowledgeNode.question_id == q.id)
            )
            q.kn_ids = [str(r[0]) for r in kn_rows.fetchall()]

        # Score and rank
        scored = []
        for q in candidates:
            base = score_question(q, knowledge_node_ids, used_ids)
            diff_bonus = score_for_difficulty(q, target.target_difficulty)
            scored.append((base + diff_bonus, q))
        scored.sort(key=lambda x: x[0], reverse=True)

        best_score, best = scored[0]
        used_ids.add(str(best.id))

        tags = _build_tags(best, knowledge_node_ids)
        alts = _build_alternatives(scored[1:4], knowledge_node_ids)

        questions.append({
            "question_id": str(best.id),
            "question_type": best.question_type,
            "difficulty": best.difficulty,
            "score": target.score,
            "title": (best.title or "")[:120],
            "recommendation_tags": tags,
            "alternatives": alts,
            "_kn_ids": getattr(best, 'kn_ids', []) or [],
        })

    dashboard = _build_dashboard(questions, targets, knowledge_node_ids)
    return questions, dashboard


def _build_tags(question, kn_set: set[str]) -> list[str]:
    tags = []
    q_kn = set(getattr(question, 'kn_ids', []) or [])
    if q_kn & kn_set:
        tags.append("知识点匹配 ✓")
    if getattr(question, 'is_typical', False):
        tags.append("典型题")
    tags.append("难度匹配 ✓")
    return tags


def _build_alternatives(scored: list, kn_set: set[str]) -> list[dict]:
    alts = []
    for _, alt_q in scored:
        alt_tags = []
        q_kn = set(getattr(alt_q, 'kn_ids', []) or [])
        if q_kn & kn_set:
            alt_tags.append("知识点匹配")
        if getattr(alt_q, 'is_typical', False):
            alt_tags.append("典型题")
        alts.append({
            "question_id": str(alt_q.id),
            "title": (alt_q.title or "")[:80],
            "difficulty": alt_q.difficulty or "",
            "tags": alt_tags,
        })
    return alts


def _build_dashboard(
    questions: list[dict],
    targets: list[QuotaTarget],
    kn_set: set[str],
) -> dict:
    diff_actual = {"EASY": 0, "MEDIUM": 0, "HARD": 0}
    for q in questions:
        d = q.get("difficulty", "")
        if d in diff_actual:
            diff_actual[d] += 1

    dashboard = {
        "difficulty": {},
        "knowledge_coverage": {"matched": 0, "total": len(kn_set)},
        "total_score": sum(q.get("score", 0) for q in questions),
    }
    for diff in DIFFICULTIES:
        target_count = sum(1 for t in targets if t.target_difficulty == diff)
        dashboard["difficulty"][diff] = {
            "target": target_count,
            "actual": diff_actual[diff],
            "matched": target_count == diff_actual[diff],
        }

    hit_kn: set[str] = set()
    for q in questions:
        kn_ids = q.get("_kn_ids", [])
        hit_kn.update(kn_set & set(kn_ids))
    dashboard["knowledge_coverage"]["matched"] = len(hit_kn)
    return dashboard
