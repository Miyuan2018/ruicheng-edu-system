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
