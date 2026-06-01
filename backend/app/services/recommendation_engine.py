"""智能推荐引擎 — 配额分解 + 加权选题 + 换题推荐"""
from dataclasses import dataclass


@dataclass
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
    diffs = ["EASY", "MEDIUM", "HARD"]
    for cfg in type_configs:
        total = cfg["count"]
        quotas: dict[str, int] = {}
        for diff in diffs:
            quotas[diff] = int(total * difficulty_ratio.get(diff, 0.33))
        remainder = total - sum(quotas.values())
        if remainder > 0:
            quotas["MEDIUM"] += remainder
        for diff in diffs:
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
    """计算题目对当前需求的匹配得分 (0-80, 不含难度附加分)"""
    s = 0.0
    q_kn_ids = set(getattr(question, 'kn_ids', []) or [])
    if paper_knowledge_node_ids and q_kn_ids:
        matched = len(q_kn_ids & paper_knowledge_node_ids)
        s += 40.0 * (matched / len(paper_knowledge_node_ids))

    if getattr(question, 'is_typical', False):
        s += 30.0
    elif getattr(question, 'review_status', '') == 'APPROVED':
        s += 15.0

    qid = str(getattr(question, 'id', ''))
    if qid not in used_ids:
        s += 20.0

    return s


def score_for_difficulty(question, target_difficulty: str) -> float:
    """难度附加分 (0-10)，仅在匹配时加分"""
    if getattr(question, 'difficulty', None) == target_difficulty:
        return 10.0
    return 0.0
