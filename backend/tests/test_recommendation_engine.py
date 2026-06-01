import pytest
from app.services.recommendation_engine import distribute_quotas, QuotaTarget, score_question, score_for_difficulty


def test_distribute_quotas_basic():
    """10道题 3:5:2 比例分配"""
    type_configs = [
        {"question_type": "SINGLE_CHOICE", "count": 10, "score_per_question": 3},
    ]
    ratio = {"EASY": 0.3, "MEDIUM": 0.5, "HARD": 0.2}
    result = distribute_quotas(type_configs, ratio)
    assert len(result) == 10
    easy = [r for r in result if r.target_difficulty == "EASY"]
    medium = [r for r in result if r.target_difficulty == "MEDIUM"]
    hard = [r for r in result if r.target_difficulty == "HARD"]
    assert len(easy) == 3
    assert len(medium) == 5
    assert len(hard) == 2


def test_distribute_quotas_remainder_to_medium():
    """7道题 3:5:2 余数归MEDIUM"""
    type_configs = [
        {"question_type": "SINGLE_CHOICE", "count": 7, "score_per_question": 5},
    ]
    ratio = {"EASY": 0.3, "MEDIUM": 0.5, "HARD": 0.2}
    result = distribute_quotas(type_configs, ratio)
    easy = [r for r in result if r.target_difficulty == "EASY"]
    medium = [r for r in result if r.target_difficulty == "MEDIUM"]
    hard = [r for r in result if r.target_difficulty == "HARD"]
    assert len(easy) == 2
    assert len(medium) == 4
    assert len(hard) == 1


def test_distribute_quotas_multiple_types():
    """多个题型混合分配"""
    type_configs = [
        {"question_type": "SINGLE_CHOICE", "count": 6, "score_per_question": 5},
        {"question_type": "FILL_BLANK", "count": 4, "score_per_question": 5},
    ]
    ratio = {"EASY": 0.5, "MEDIUM": 0.3, "HARD": 0.2}
    result = distribute_quotas(type_configs, ratio)
    assert len(result) == 10
    for r in result:
        assert r.question_type in ("SINGLE_CHOICE", "FILL_BLANK")
        assert r.target_difficulty in ("EASY", "MEDIUM", "HARD")


def test_score_question_full_match():
    """完全匹配得分最高"""
    from unittest.mock import MagicMock
    q = MagicMock()
    q.kn_ids = ["kn1", "kn2", "kn3"]
    q.is_typical = True
    q.review_status = "APPROVED"
    q.difficulty = "EASY"
    q.id = "q1"
    paper_kn_ids = {"kn1", "kn2", "kn3"}
    used_ids = set()

    s = score_question(q, paper_kn_ids, used_ids)
    s += score_for_difficulty(q, "EASY")
    assert s == 100.0


def test_score_question_no_match():
    """完全不匹配得分最低"""
    from unittest.mock import MagicMock
    q = MagicMock()
    q.kn_ids = ["kn4"]
    q.is_typical = False
    q.review_status = "PENDING"
    q.difficulty = "HARD"
    q.id = "q2"
    paper_kn_ids = {"kn1", "kn2"}
    used_ids = {"q2"}

    s = score_question(q, paper_kn_ids, used_ids)
    s += score_for_difficulty(q, "EASY")
    assert s == 0.0
