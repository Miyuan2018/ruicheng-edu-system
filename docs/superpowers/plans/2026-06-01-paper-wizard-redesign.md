# 组卷向导 V3.6 重设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建智能推荐引擎替代随机选题，重构向导 UI 使教师操作透明直观

**Architecture:** 新增 recommendation_engine 服务层（配额分解+加权评分），3 个新 API 端点，前端 TypeScript 类型更新 + 3 个向导步骤重构

**Tech Stack:** Python 3.12 + FastAPI + SQLAlchemy async + React 19 + Ant Design 6 + Zustand 5

---

## 文件结构

```
backend/
├── app/services/recommendation_engine.py   [NEW] 推荐引擎核心
├── app/api/v1/endpoints/exam_papers.py     [MODIFY] 新增3个端点
├── app/schemas/exam_paper.py               [MODIFY] 新增请求/响应schema
└── tests/test_recommendation_engine.py     [NEW] 单元测试

frontend/
├── src/types/paper.ts                      [MODIFY] 类型更新
├── src/api/papers.ts                       [MODIFY] 新API函数
├── src/store/paperEditor.ts                [MODIFY] 新actions
├── src/pages/papers/PaperWizardPage.tsx     [MODIFY] 步骤逻辑调整
├── src/pages/papers/steps/BasicInfoStep.tsx [MODIFY] 知识点选择器
├── src/pages/papers/steps/StructureStep.tsx [REWRITE] 单表简化
├── src/pages/papers/steps/SelectionStep.tsx [DELETE]
├── src/pages/papers/steps/RecommendStep.tsx [NEW] 推荐结果+换题
```

---

### Task 1: 推荐引擎服务层

**Files:**
- Create: `backend/app/services/recommendation_engine.py`
- Create: `backend/tests/test_recommendation_engine.py`

- [ ] **Step 1: 编写配额分解函数的测试**

```python
# backend/tests/test_recommendation_engine.py
import pytest
from app.services.recommendation_engine import distribute_quotas, QuotaTarget

def test_distribute_quotas_basic():
    """10道题 3:5:2 比例分配"""
    type_configs = [
        {"question_type": "SINGLE_CHOICE", "count": 10, "score_per_question": 3},
    ]
    ratio = {"EASY": 0.3, "MEDIUM": 0.5, "HARD": 0.2}
    result = distribute_quotas(type_configs, ratio)
    # 10 * 0.3 = 3 EASY, 10 * 0.5 = 5 MEDIUM, 10 * 0.2 = 2 HARD
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
    # floor(7*0.3)=2, floor(7*0.5)=3, floor(7*0.2)=1, sum=6, rem=1→MEDIUM
    easy = [r for r in result if r.target_difficulty == "EASY"]
    medium = [r for r in result if r.target_difficulty == "MEDIUM"]
    hard = [r for r in result if r.target_difficulty == "HARD"]
    assert len(easy) == 2
    assert len(medium) == 4  # 3+1 remainder
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
    # 检查每个target保留原始question_type
    for r in result:
        assert r.question_type in ("SINGLE_CHOICE", "FILL_BLANK")
        assert r.target_difficulty in ("EASY", "MEDIUM", "HARD")
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd backend && python -m pytest tests/test_recommendation_engine.py -v
```
Expected: ImportError (recommendation_engine module not found)

- [ ] **Step 3: 实现配额分解函数**

```python
# backend/app/services/recommendation_engine.py
"""智能推荐引擎 — 配额分解 + 加权选题 + 换题推荐"""
from dataclasses import dataclass, field
from typing import Optional
import random
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.question import Question
from app.models.knowledge_node import QuestionKnowledgeNode, KnowledgeNode


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
    """按难度比例将题型配置分解为带难度标签的选题目标列表。

    Args:
        type_configs: [{"question_type": str, "count": int, "score_per_question": int}, ...]
        difficulty_ratio: {"EASY": 0.3, "MEDIUM": 0.5, "HARD": 0.2}

    Returns:
        QuotaTarget 列表，每条代表"需要选一道某题型某难度的题，分值X"
    """
    targets: list[QuotaTarget] = []
    diffs = ["EASY", "MEDIUM", "HARD"]
    for cfg in type_configs:
        total = cfg["count"]
        quotas: dict[str, int] = {}
        for diff in diffs:
            quotas[diff] = int(total * difficulty_ratio.get(diff, 0.33))
        # 余数归 MEDIUM
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
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd backend && python -m pytest tests/test_recommendation_engine.py::test_distribute_quotas_basic tests/test_recommendation_engine.py::test_distribute_quotas_remainder_to_medium tests/test_recommendation_engine.py::test_distribute_quotas_multiple_types -v
```
Expected: 3 PASSED

- [ ] **Step 5: 编写评分函数的测试**

```python
# Add to backend/tests/test_recommendation_engine.py

def test_score_question_full_match():
    """完全匹配得分最高"""
    # 需要 mock Question 对象
    from unittest.mock import MagicMock
    q = MagicMock()
    q.kn_ids = ["kn1", "kn2", "kn3"]
    q.is_typical = True
    q.review_status = "APPROVED"
    q.difficulty = "EASY"
    paper_kn_ids = {"kn1", "kn2", "kn3"}
    used_ids = set()

    from app.services.recommendation_engine import score_question, score_for_difficulty
    s = score_question(q, paper_kn_ids, used_ids)
    s += score_for_difficulty(q, "EASY")
    # 40 (3/3知识点) + 30 (典型题) + 20 (未使用) + 10 (难度匹配) = 100
    assert s == 100.0

def test_score_question_no_match():
    """完全不匹配得分最低"""
    from unittest.mock import MagicMock
    from app.services.recommendation_engine import score_question, score_for_difficulty
    q = MagicMock()
    q.kn_ids = ["kn4"]
    q.is_typical = False
    q.review_status = "PENDING"
    q.difficulty = "HARD"
    paper_kn_ids = {"kn1", "kn2"}
    used_ids = {"some_id"}

    s = score_question(q, paper_kn_ids, used_ids)
    s += score_for_difficulty(q, "EASY")
    # 0 (0/2知识点) + 0 (非典型非APPROVED) + 0 (已使用) + 0 (难度不匹配) = 0
    assert s == 0.0
```

- [ ] **Step 6: 运行测试确认失败**

```bash
cd backend && python -m pytest tests/test_recommendation_engine.py::test_score_question_full_match -v
```
Expected: FAIL (score_question not defined)

- [ ] **Step 7: 实现评分函数**

```python
# Add to backend/app/services/recommendation_engine.py

def score_question(
    question,  # Question ORM object or mock with kn_ids, is_typical, review_status, difficulty
    paper_knowledge_node_ids: set[str],
    used_ids: set[str],
) -> float:
    """计算题目对当前需求的匹配得分 (0-100)"""
    s = 0.0
    # 知识点匹配 (0-40)
    q_kn_ids = set(getattr(question, 'kn_ids', []))
    if paper_knowledge_node_ids and q_kn_ids:
        matched = len(q_kn_ids & paper_knowledge_node_ids)
        s += 40.0 * (matched / len(paper_knowledge_node_ids))

    # 题目质量 (0-30)
    if getattr(question, 'is_typical', False):
        s += 30.0
    elif getattr(question, 'review_status', '') == 'APPROVED':
        s += 15.0

    # 新鲜度 (0-20)
    qid = str(getattr(question, 'id', ''))
    if qid not in used_ids:
        s += 20.0

    return s


def score_for_difficulty(question, target_difficulty: str) -> float:
    """难度附加分 (0-10)，仅在匹配时加分"""
    if getattr(question, 'difficulty', None) == target_difficulty:
        return 10.0
    return 0.0
```

- [ ] **Step 8: 运行评分测试确认通过**

```bash
cd backend && python -m pytest tests/test_recommendation_engine.py -v
```
Expected: 5 PASSED

- [ ] **Step 9: 提交**

```bash
git add backend/app/services/recommendation_engine.py backend/tests/test_recommendation_engine.py
git commit -m "feat: 推荐引擎配额分解和评分函数"
```

---

### Task 2: auto-generate 端点

**Files:**
- Modify: `backend/app/schemas/exam_paper.py`
- Modify: `backend/app/api/v1/endpoints/exam_papers.py`

- [ ] **Step 1: 新增 Schema**

```python
# Add to backend/app/schemas/exam_paper.py, after existing classes

class AutoGenerateRequest(BaseModel):
    difficulty_ratio: dict[str, float] = {"EASY": 0.3, "MEDIUM": 0.5, "HARD": 0.2}
    knowledge_node_ids: list[str] = []

class GenerateRecommendation(BaseModel):
    """单道题的推荐信息"""
    question_id: str
    question_type: str
    difficulty: str
    score: int
    title: str = ""
    recommendation_tags: list[str] = []  # ["知识点匹配 ✓", "典型题", "难度匹配 ✓"]
    alternatives: list[dict] = []  # 备选题列表

class GenerateReport(BaseModel):
    """一次生成的完整报告"""
    questions: list[GenerateRecommendation]
    constraint_dashboard: dict[str, any]  # {difficulty: {target, actual}, knowledge_coverage, total_score}

class AutoGenerateResponse(BaseModel):
    report: GenerateReport
```

- [ ] **Step 2: 实现 auto-generate 端点**

```python
# Add to backend/app/api/v1/endpoints/exam_papers.py, after auto_select_all endpoint
# Import at top:
from app.services.recommendation_engine import distribute_quotas, score_question, score_for_difficulty

@router.post("/{paper_id}/auto-generate", response_model=AutoGenerateResponse)
async def auto_generate_paper(
    paper_id: str,
    request: AutoGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """一键生成完整试卷：按约束从题库自动选题并返回推荐报告"""
    # 1. 获取试卷和单元结构
    result = await db.execute(
        select(ExamPaperUnit).where(ExamPaperUnit.exam_paper_id == paper_id).order_by(ExamPaperUnit.position)
    )
    units = result.scalars().all()
    if not units:
        raise HTTPException(404, detail="请先设置试卷结构")

    type_configs = []
    for unit in units:
        for cfg in (unit.question_config or []):
            type_configs.append({
                "question_type": cfg.get("question_type"),
                "count": cfg.get("count", 0),
                "score_per_question": cfg.get("score_per_question", 5),
            })

    # 2. 配额分解
    targets = distribute_quotas(type_configs, request.difficulty_ratio)

    # 3. 为每个目标选题
    kn_set = set(request.knowledge_node_ids)
    used_ids: set[str] = set()
    questions: list[dict] = []

    for target in targets:
        # 查询候选
        candidates = await db.execute(
            select(Question).where(
                Question.is_active == True,
                Question.review_status == "APPROVED",
                Question.question_type == target.question_type,
                Question.difficulty == target.target_difficulty,
            )
        )
        candidate_list = [q for q in candidates.scalars().all() if str(q.id) not in used_ids]

        if not candidate_list:
            continue

        # 加载知识点
        for q in candidate_list:
            kn_rows = await db.execute(
                select(KnowledgeNode.id).join(
                    QuestionKnowledgeNode, QuestionKnowledgeNode.knowledge_node_id == KnowledgeNode.id
                ).where(QuestionKnowledgeNode.question_id == q.id)
            )
            q.kn_ids = [str(r[0]) for r in kn_rows.fetchall()]

        # 评分排序
        scored = []
        for q in candidate_list:
            base = score_question(q, kn_set, used_ids)
            diff_bonus = score_for_difficulty(q, target.target_difficulty)
            scored.append((base + diff_bonus, q))
        scored.sort(key=lambda x: x[0], reverse=True)

        # 选最高分
        best = scored[0][1]
        used_ids.add(str(best.id))
        tags = []
        if any(kn in kn_set for kn in best.kn_ids):
            tags.append("知识点匹配 ✓")
        if best.is_typical:
            tags.append("典型题")
        tags.append(f"难度匹配 ✓")

        # 备选 (top 2-4)
        alts = []
        for _, alt_q in scored[1:4]:
            alt_tags = []
            if any(kn in kn_set for kn in alt_q.kn_ids):
                alt_tags.append("知识点匹配")
            alts.append({
                "question_id": str(alt_q.id),
                "title": (alt_q.title or "")[:80],
                "difficulty": alt_q.difficulty,
                "tags": alt_tags,
            })

        questions.append({
            "question_id": str(best.id),
            "question_type": best.question_type,
            "difficulty": best.difficulty,
            "score": target.score,
            "title": (best.title or "")[:120],
            "recommendation_tags": tags,
            "alternatives": alts,
        })

    # 4. 构建约束仪表盘
    difficulty_actual = {"EASY": 0, "MEDIUM": 0, "HARD": 0}
    for q in questions:
        difficulty_actual[q["difficulty"]] = difficulty_actual.get(q["difficulty"], 0) + 1

    dashboard = {
        "difficulty": {
            "EASY": {"target": 0, "actual": difficulty_actual["EASY"]},
            "MEDIUM": {"target": 0, "actual": difficulty_actual["MEDIUM"]},
            "HARD": {"target": 0, "actual": difficulty_actual["HARD"]},
        },
        "knowledge_coverage": {"matched": 0, "total": len(kn_set)},
        "total_score": sum(q["score"] for q in questions),
    }
    for diff in ["EASY", "MEDIUM", "HARD"]:
        dashboard["difficulty"][diff]["target"] = sum(
            1 for t in targets if t.target_difficulty == diff
        )

    # 计算知识点覆盖
    all_kn = set()
    for q in questions:
        # reload kn_ids for matched questions
        pass
    dashboard["knowledge_coverage"]["matched"] = 0  # placeholder

    return {"report": {"questions": questions, "constraint_dashboard": dashboard}}
```

Wait — the above is too long. Let me split the auto-generate endpoint into smaller steps.

- [ ] **Step 2a: 实现选题核心函数 `select_for_targets`**

```python
# Add to backend/app/services/recommendation_engine.py
import uuid

async def select_for_targets(
    db: AsyncSession,
    targets: list[QuotaTarget],
    knowledge_node_ids: set[str],
    subject: Optional[str] = None,
) -> tuple[list[dict], dict]:
    """为所有目标选题，返回题目列表和约束仪表盘数据。

    Returns:
        (questions, dashboard) where questions is list of dicts with
        question_id, question_type, difficulty, score, title, recommendation_tags, alternatives
    """
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

        for q in candidates:
            kn_rows = await db.execute(
                select(KnowledgeNode.id).join(
                    QuestionKnowledgeNode,
                    QuestionKnowledgeNode.knowledge_node_id == KnowledgeNode.id,
                ).where(QuestionKnowledgeNode.question_id == q.id)
            )
            q.kn_ids = [str(r[0]) for r in kn_rows.fetchall()]

        scored = []
        for q in candidates:
            base = score_question(q, knowledge_node_ids, used_ids)
            diff_bonus = score_for_difficulty(q, target.target_difficulty)
            scored.append((base + diff_bonus, q))
        scored.sort(key=lambda x: x[0], reverse=True)

        best_score, best = scored[0]
        used_ids.add(str(best.id))

        tags = _build_tags(best, knowledge_node_ids, target.target_difficulty)
        alts = _build_alternatives(scored[1:4], knowledge_node_ids)

        questions.append({
            "question_id": str(best.id),
            "question_type": best.question_type,
            "difficulty": best.difficulty,
            "score": target.score,
            "title": (best.title or "")[:120],
            "recommendation_tags": tags,
            "alternatives": alts,
        })

    dashboard = _build_dashboard(questions, targets, knowledge_node_ids)
    return questions, dashboard


def _build_tags(question, kn_set: set[str], target_diff: str) -> list[str]:
    tags = []
    if any(kn in kn_set for kn in (getattr(question, 'kn_ids', []) or [])):
        tags.append("知识点匹配 ✓")
    if getattr(question, 'is_typical', False):
        tags.append("典型题")
    tags.append("难度匹配 ✓")
    return tags


def _build_alternatives(scored: list, kn_set: set[str]) -> list[dict]:
    alts = []
    for _, alt_q in scored:
        alt_tags = []
        if any(kn in kn_set for kn in (getattr(alt_q, 'kn_ids', []) or [])):
            alt_tags.append("知识点匹配")
        if getattr(alt_q, 'is_typical', False):
            alt_tags.append("典型题")
        alts.append({
            "question_id": str(alt_q.id),
            "title": (alt_q.title or "")[:80],
            "difficulty": alt_q.difficulty,
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
        d = q["difficulty"]
        if d in diff_actual:
            diff_actual[d] += 1

    dashboard = {
        "difficulty": {},
        "knowledge_coverage": {"matched": 0, "total": len(kn_set)},
        "total_score": sum(q.get("score", 0) for q in questions),
    }
    for diff in ["EASY", "MEDIUM", "HARD"]:
        target_count = sum(1 for t in targets if t.target_difficulty == diff)
        dashboard["difficulty"][diff] = {
            "target": target_count,
            "actual": diff_actual[diff],
            "matched": target_count == diff_actual[diff],
        }
    # 知识点覆盖：统计推荐题目命中的知识点
    hit_kn: set[str] = set()
    for q in questions:
        kn_ids = q.get("_kn_ids", [])
        hit_kn.update(kn_set & set(kn_ids))
    dashboard["knowledge_coverage"]["matched"] = len(hit_kn)
    return dashboard
```

- [ ] **Step 2b: 实现 auto-generate 端点**

```python
# Add to backend/app/api/v1/endpoints/exam_papers.py, before router definition ends

@router.post("/{paper_id}/auto-generate")
async def auto_generate_paper(
    paper_id: str,
    request: AutoGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """一键生成完整试卷推荐"""
    from app.services.recommendation_engine import distribute_quotas, select_for_targets

    # 1. 获取试卷元信息
    paper = await db.execute(select(ExamPaper).where(ExamPaper.id == paper_id))
    paper = paper.scalar_one_or_none()
    if not paper:
        raise HTTPException(404, detail="试卷不存在")

    # 2. 获取单元结构
    result = await db.execute(
        select(ExamPaperUnit).where(
            ExamPaperUnit.exam_paper_id == paper_id
        ).order_by(ExamPaperUnit.position)
    )
    units = result.scalars().all()
    if not units:
        raise HTTPException(400, detail="请先在试卷结构步骤设置题型")

    type_configs = []
    for unit in units:
        for cfg in (unit.question_config or []):
            if cfg.get("count", 0) > 0:
                type_configs.append({
                    "question_type": cfg["question_type"],
                    "count": cfg["count"],
                    "score_per_question": cfg.get("score_per_question", 5),
                })

    if not type_configs:
        raise HTTPException(400, detail="试卷结构中没有配置题型")

    # 3. 配额分解
    ratio = request.difficulty_ratio
    if sum(ratio.get(d, 0) for d in ["EASY", "MEDIUM", "HARD"]) != 1.0:
        # normalize
        total = sum(ratio.get(d, 0) for d in ["EASY", "MEDIUM", "HARD"])
        if total > 0:
            ratio = {d: ratio.get(d, 0) / total for d in ["EASY", "MEDIUM", "HARD"]}

    targets = distribute_quotas(type_configs, ratio)

    # 4. 选题
    questions, dashboard = await select_for_targets(
        db, targets, set(request.knowledge_node_ids), paper.subject
    )

    return {"questions": questions, "constraint_dashboard": dashboard}
```

- [ ] **Step 3: 运行集成测试验证**

```bash
cd backend && python -m pytest tests/test_recommendation_engine.py -v
```
Expected: All tests pass

- [ ] **Step 4: 提交**

```bash
git add backend/app/services/recommendation_engine.py backend/app/schemas/exam_paper.py backend/app/api/v1/endpoints/exam_papers.py
git commit -m "feat: auto-generate端点 — 一键生成完整试卷推荐"
```

---

### Task 3: swap 换题端点

**Files:**
- Modify: `backend/app/api/v1/endpoints/exam_papers.py`

- [ ] **Step 1: 实现 swap 端点**

```python
# Add to backend/app/api/v1/endpoints/exam_papers.py

@router.post("/{paper_id}/questions/{question_id}/swap")
async def swap_question(
    paper_id: str,
    question_id: str,
    db: AsyncSession = Depends(get_db),
):
    """换题：返回同题型、同难度的 top 3 备选题"""
    from app.services.recommendation_engine import score_question

    # 获取当前题目信息
    current = await db.execute(select(Question).where(Question.id == question_id))
    current = current.scalar_one_or_none()
    if not current:
        raise HTTPException(404, detail="题目不存在")

    # 获取试卷已选题（移除当前题）
    result = await db.execute(
        select(ExamPaperUnitQuestion.question_id).join(
            ExamPaperUnit, ExamPaperUnit.id == ExamPaperUnitQuestion.unit_id
        ).where(ExamPaperUnit.exam_paper_id == paper_id)
    )
    used = {str(r[0]) for r in result.fetchall()}
    used.discard(question_id)

    # 查询同题型同难度的候选
    result = await db.execute(
        select(Question).where(
            Question.is_active == True,
            Question.review_status == "APPROVED",
            Question.question_type == current.question_type,
            Question.difficulty == current.difficulty,
        )
    )
    candidates = [q for q in result.scalars().all() if str(q.id) not in used]

    # 评分排序，取 top 3
    scored = []
    for q in candidates:
        s = score_question(q, set(), {str(q.id) for q in [current]})
        scored.append((s, q))
    scored.sort(key=lambda x: x[0], reverse=True)

    alternatives = []
    for _, q in scored[:3]:
        alternatives.append({
            "question_id": str(q.id),
            "title": (q.title or "")[:120],
            "difficulty": q.difficulty,
            "question_type": q.question_type,
            "score": q.score,
        })

    return {"alternatives": alternatives}
```

- [ ] **Step 2: 提交**

```bash
git add backend/app/api/v1/endpoints/exam_papers.py
git commit -m "feat: swap端点 — 换题推荐同题型同难度备选"
```

---

### Task 4: 前端类型和 Store 更新

**Files:**
- Modify: `frontend/src/types/paper.ts`
- Modify: `frontend/src/api/papers.ts`
- Modify: `frontend/src/store/paperEditor.ts`

- [ ] **Step 1: 更新 PaperDraft 类型**

```typescript
// Modify frontend/src/types/paper.ts

export interface DifficultyRatio {
  EASY: number;
  MEDIUM: number;
  HARD: number;
}

export interface PaperDraft {
  id?: string;
  title: string;
  subject: string;
  grade_level: any;
  duration_minutes?: number | null;
  difficulty_ratio: DifficultyRatio;  // 代替旧的 difficulty?: Record<string, number>
  knowledge_node_ids: string[];       // 新增：试卷级知识点
  total_score: number;
  status: string;
  subtitle?: string;
  instructions?: string;
  description?: string;
  units: ExamPaperUnit[];
}

// QuestionConfigItem 简化 — 移除 knowledge_points 和 difficulty_ratio
export interface QuestionConfigItem {
  question_type: string;
  count: number;
  score_per_question: number;
}

// 新增：推荐相关类型
export interface GenerateRecommendation {
  question_id: string;
  question_type: string;
  difficulty: string;
  score: number;
  title: string;
  recommendation_tags: string[];
  alternatives: AlternativeQuestion[];
}

export interface AlternativeQuestion {
  question_id: string;
  title: string;
  difficulty: string;
  tags: string[];
}

export interface ConstraintDashboard {
  difficulty: Record<string, { target: number; actual: number; matched: boolean }>;
  knowledge_coverage: { matched: number; total: number };
  total_score: number;
}

export interface GenerateReport {
  questions: GenerateRecommendation[];
  constraint_dashboard: ConstraintDashboard;
}
```

- [ ] **Step 2: 新增 API 函数**

```typescript
// Add to frontend/src/api/papers.ts

autoGenerate: (paperId: string, data: {
  difficulty_ratio: { EASY: number; MEDIUM: number; HARD: number };
  knowledge_node_ids: string[];
}) =>
  apiClient.post(`/exam-papers/${paperId}/auto-generate`, data),

swapQuestion: (paperId: string, questionId: string) =>
  apiClient.post(`/exam-papers/${paperId}/questions/${questionId}/swap`),
```

- [ ] **Step 3: 更新 Store**

```typescript
// Modify frontend/src/store/paperEditor.ts

// In PaperEditorState interface, add:
generateReport: GenerateReport | null;
setGenerateReport: (report: GenerateReport | null) => void;

// In newEmptyPaper(), change:
const newEmptyPaper = (): PaperDraft => ({
  // ...
  difficulty_ratio: { EASY: 20, MEDIUM: 50, HARD: 30 },
  knowledge_node_ids: [],
  // ...
});
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/types/paper.ts frontend/src/api/papers.ts frontend/src/store/paperEditor.ts
git commit -m "feat: 前端类型和Store适配推荐引擎API"
```

---

### Task 5: BasicInfoStep — 知识点选择器

**Files:**
- Modify: `frontend/src/pages/papers/steps/BasicInfoStep.tsx`

- [ ] **Step 1: 添加知识点选择器组件**

```tsx
// 在 BasicInfoStep.tsx 中：
// 1. 添加知识树节点加载
const [knowledgeNodes, setKnowledgeNodes] = useState<any[]>([]);
const [syllabi, setSyllabi] = useState<any[]>([]);
const [selectedSyllabus, setSelectedSyllabus] = useState<string>('');

useEffect(() => {
  apiClient.get('/question-admin/syllabi').then((resp) => {
    setSyllabi(resp.data || []);
  }).catch(() => {});
}, []);

const loadKnowledgeTree = async (sid: string) => {
  try {
    const resp = await apiClient.get(`/knowledge-tree/syllabi/${sid}/tree`);
    // 提取所有 POINT 节点
    const points: any[] = [];
    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        if (n.node_type === 'POINT') points.push(n);
        if (n.children) walk(n.children);
      }
    };
    walk(resp.data.tree || []);
    setKnowledgeNodes(points);
  } catch { /* ignore */ }
};

// 2. 在 Form 中新增表单项：
// 考纲选择 + 知识点多选 TreeSelect
<Form.Item label="知识点范围">
  <Select
    placeholder="选择考纲"
    value={selectedSyllabus || undefined}
    onChange={(v) => { setSelectedSyllabus(v); loadKnowledgeTree(v); }}
    options={syllabi.map((s: any) => ({ value: s.id, label: s.title }))}
    allowClear
    style={{ marginBottom: 8 }}
  />
  <Select
    mode="multiple"
    placeholder="选择知识点（可多选）"
    value={paper?.knowledge_node_ids || []}
    onChange={(v) => updateMeta({ knowledge_node_ids: v })}
    options={knowledgeNodes.map((n: any) => ({ value: n.key, label: n.title }))}
    filterOption={(input, option) =>
      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
    }
  />
</Form.Item>
```

- [ ] **Step 2: 难度比例从 difficulty_ratio 读取（而非旧的 difficulty）**

```tsx
// 在 handleValuesChange 中：
difficulty_ratio: {
  EASY: allValues.diff_easy ?? 20,
  MEDIUM: allValues.diff_medium ?? 50,
  HARD: allValues.diff_hard ?? 30,
},
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/pages/papers/steps/BasicInfoStep.tsx
git commit -m "feat: BasicInfoStep添加知识点选择器和难度比例字段"
```

---

### Task 6: StructureStep — 单表简化

**Files:**
- Rewrite: `frontend/src/pages/papers/steps/StructureStep.tsx`

- [ ] **Step 1: 重写为简洁表格**

```tsx
// frontend/src/pages/papers/steps/StructureStep.tsx — 完全重写
import { useMemo } from 'react';
import { Card, Button, Select, InputNumber, Tag, Popconfirm, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { usePaperEditorStore } from '../../../store/paperEditor';
import type { QuestionConfigItem } from '../../../types/paper';

const QUESTION_TYPES = [
  { value: 'SINGLE_CHOICE', label: '单选题' },
  { value: 'MULTIPLE_CHOICE', label: '多选题' },
  { value: 'FILL_BLANK', label: '填空题' },
  { value: 'SUBJECTIVE', label: '解答题' },
];

const DEFAULT_PRESET: QuestionConfigItem[] = [
  { question_type: 'FILL_BLANK', count: 0, score_per_question: 5 },
  { question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 4 },
  { question_type: 'MULTIPLE_CHOICE', count: 0, score_per_question: 6 },
  { question_type: 'SUBJECTIVE', count: 0, score_per_question: 10 },
];

export default function StructureStep() {
  const { paper, updateMeta, addQuickUnits, setDirty } = usePaperEditorStore();
  const units = paper?.units || [];
  const targetTotal = paper?.total_score || 0;

  // 将 unit.question_config 扁平化为行列表
  const rows = useMemo(() => {
    const result: { unitId: string; cfg: QuestionConfigItem; idx: number }[] = [];
    units.forEach((u) => {
      (u.question_config || []).forEach((cfg, idx) => {
        result.push({ unitId: u.id || '', cfg, idx });
      });
    });
    return result;
  }, [units]);

  const computedTotal = useMemo(() =>
    rows.reduce((s, r) => s + (r.cfg.count || 0) * (r.cfg.score_per_question || 0), 0),
    [rows],
  );
  const totalQuestions = useMemo(() =>
    rows.reduce((s, r) => s + (r.cfg.count || 0), 0),
    [rows],
  );
  const scoreMatched = targetTotal > 0 && computedTotal === targetTotal;

  const handleApplyPreset = () => {
    addQuickUnits('byType');
  };

  const handleAddRow = () => {
    // 添加一个新单元
    const store = usePaperEditorStore.getState();
    store.addUnit({
      name: '未命名',
      question_config: [{ question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 5 }],
    });
  };

  const updateRow = (unitId: string, cfgIdx: number, field: string, value: any) => {
    const store = usePaperEditorStore.getState();
    store.updateTypeConfig(unitId, cfgIdx, { [field]: value });
    setDirty(true);
  };

  const removeRow = (unitId: string, cfgIdx: number) => {
    const store = usePaperEditorStore.getState();
    store.removeTypeConfig(unitId, cfgIdx);
    setDirty(true);
  };

  if (rows.length === 0) {
    return (
      <Card size="small">
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 14, color: '#999', marginBottom: 16 }}>尚未设置题型结构</div>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleApplyPreset}>
              按题型分组
            </Button>
            <Button icon={<PlusOutlined />} onClick={handleAddRow}>自定义添加</Button>
          </Space>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e8e8e8', fontSize: 13, color: '#666' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '30%' }}>题型</th>
            <th style={{ padding: '8px 12px', textAlign: 'center', width: '20%' }}>题数</th>
            <th style={{ padding: '8px 12px', textAlign: 'center', width: '20%' }}>每题分值</th>
            <th style={{ padding: '8px 12px', textAlign: 'center', width: '20%' }}>小计</th>
            <th style={{ padding: '8px 12px', textAlign: 'center', width: '10%' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const subtotal = (row.cfg.count || 0) * (row.cfg.score_per_question || 0);
            return (
              <tr key={`${row.unitId}-${row.idx}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '6px 12px' }}>
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    value={row.cfg.question_type}
                    onChange={(v) => updateRow(row.unitId, row.idx, 'question_type', v)}
                    options={QUESTION_TYPES}
                  />
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                  <InputNumber
                    size="small"
                    style={{ width: 80 }}
                    min={0} max={200}
                    value={row.cfg.count}
                    onChange={(v) => updateRow(row.unitId, row.idx, 'count', v || 0)}
                  />
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                  <InputNumber
                    size="small"
                    style={{ width: 80 }}
                    min={1} max={100}
                    value={row.cfg.score_per_question}
                    onChange={(v) => updateRow(row.unitId, row.idx, 'score_per_question', v || 1)}
                  />
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 500, color: '#1890ff' }}>
                  {subtotal} 分
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                  <Popconfirm title="删除此行？" onConfirm={() => removeRow(row.unitId, row.idx)}>
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={rows.length <= 1} />
                  </Popconfirm>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #e8e8e8', fontWeight: 600 }}>
            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
              合计 {totalQuestions} 题
            </td>
            <td colSpan={2} />
            <td style={{ padding: '10px 12px', textAlign: 'center', color: scoreMatched ? '#52c41a' : '#ff4d4f' }}>
              {computedTotal} 分
              {!scoreMatched && targetTotal > 0 && (
                <span style={{ marginLeft: 8, fontSize: 12 }}>
                  （目标 {targetTotal} 分，差 {Math.abs(computedTotal - targetTotal)} 分）
                </span>
              )}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Button size="small" icon={<PlusOutlined />} onClick={handleAddRow}>添加题型</Button>
        {targetTotal > 0 && !scoreMatched && (
          <Tag color="error" style={{ fontSize: 12, lineHeight: '22px' }}>
            结构总分（{computedTotal}）≠ 试卷总分（{targetTotal}）
          </Tag>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证逻辑**

在 PaperWizardPage handleNext 中，第2步校验保持不变（已有 `computedTotal !== targetTotal` 检查）

- [ ] **Step 3: 提交**

```bash
git add frontend/src/pages/papers/steps/StructureStep.tsx
git commit -m "refactor: StructureStep简化为单表视图,移除单元卡片嵌套"
```

---

### Task 7: RecommendStep — 推荐结果展示

**Files:**
- Create: `frontend/src/pages/papers/steps/RecommendStep.tsx`
- Delete: `frontend/src/pages/papers/steps/SelectionStep.tsx`
- Modify: `frontend/src/pages/papers/PaperWizardPage.tsx`

- [ ] **Step 1: 创建 RecommendStep 组件**

```tsx
// frontend/src/pages/papers/steps/RecommendStep.tsx
import { useState } from 'react';
import { Card, Button, Tag, Space, message, Spin, Empty, Progress, Popconfirm, Tooltip } from 'antd';
import { SyncOutlined, SwapOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { usePaperEditorStore } from '../../../store/paperEditor';
import { paperApi } from '../../../api/papers';
import type { GenerateReport, GenerateRecommendation } from '../../../types/paper';

const DIFF_COLORS: Record<string, string> = { EASY: '#52c41a', MEDIUM: '#faad14', HARD: '#ff4d4f' };
const DIFF_LABELS: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
const QTYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', FILL_BLANK: '填空题', SUBJECTIVE: '解答题',
};

export default function RecommendStep() {
  const { paper, generateReport, setGenerateReport, addQuestionToUnit, removeQuestionFromUnit, clearAllQuestions, setDirty } = usePaperEditorStore();
  const [loading, setLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState<Record<string, boolean>>({});

  const units = paper?.units || [];

  const handleGenerate = async () => {
    if (!paper?.id) { message.warning('请先保存基本信息'); return; }
    setLoading(true);
    try {
      const resp = await paperApi.autoGenerate(paper.id, {
        difficulty_ratio: paper.difficulty_ratio,
        knowledge_node_ids: paper.knowledge_node_ids || [],
      });
      const data = resp.data;
      setGenerateReport(data);
      // 清除旧选题，将新结果写入 store
      clearAllQuestions();
      (data.questions || []).forEach((rec: GenerateRecommendation) => {
        // 找到对应 unit
        const unit = units.find(u =>
          (u.question_config || []).some(c => c.question_type === rec.question_type)
        );
        if (unit) {
          addQuestionToUnit(unit.id!, {
            question_id: rec.question_id,
            question_type: rec.question_type,
            position: (unit.questions?.length || 0) + 1,
            score: rec.score,
            question: {
              id: rec.question_id,
              title: rec.title,
              question_type: rec.question_type,
              difficulty: rec.difficulty,
              subject: paper.subject,
            },
          });
        }
      });
      setDirty(true);
      message.success(`已推荐 ${data.questions?.length || 0} 道题`);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '推荐生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async (questionId: string, unitId: string) => {
    if (!paper?.id) return;
    setSwapLoading(prev => ({ ...prev, [questionId]: true }));
    try {
      const resp = await paperApi.swapQuestion(paper.id, questionId);
      const alts = resp.data?.alternatives || [];
      if (alts.length === 0) {
        message.warning('没有可替换的题目');
        return;
      }
      // 用第一个备选替换
      const alt = alts[0];
      removeQuestionFromUnit(unitId, questionId);
      addQuestionToUnit(unitId, {
        question_id: alt.question_id,
        question_type: alt.question_type,
        position: (units.find(u => u.id === unitId)?.questions?.length || 0) + 1,
        score: alt.score || 5,
        question: {
          id: alt.question_id,
          title: alt.title,
          question_type: alt.question_type,
          difficulty: alt.difficulty,
          subject: paper.subject,
        },
      });
      setDirty(true);
      message.success('已替换');
    } catch {
      message.error('换题失败');
    } finally {
      setSwapLoading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleRemove = (unitId: string, questionId: string) => {
    removeQuestionFromUnit(unitId, questionId);
    setDirty(true);
  };

  // 约束仪表盘
  const dashboard = generateReport?.constraint_dashboard;
  const renderDashboard = () => {
    if (!dashboard) return null;
    return (
      <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
          {/* 难度分布 */}
          <div>
            <span style={{ color: '#888', marginRight: 8 }}>难度分布</span>
            {Object.entries(dashboard.difficulty || {}).map(([diff, info]: [string, any]) => (
              <Tag key={diff} color={info.matched ? 'success' : 'error'} style={{ fontSize: 11 }}>
                {DIFF_LABELS[diff]} {info.actual}/{info.target}
                {info.matched ? ' ✓' : ' ⚠'}
              </Tag>
            ))}
          </div>
          {/* 总分 */}
          <div>
            <span style={{ color: '#888', marginRight: 8 }}>总分</span>
            <Tag color={dashboard.total_score === paper?.total_score ? 'success' : 'error'}>
              {dashboard.total_score}/{paper?.total_score}
              {dashboard.total_score === paper?.total_score ? ' ✓' : ' ⚠'}
            </Tag>
          </div>
        </div>
      </Card>
    );
  };

  // 按题型分组展示
  const groupedByType = (generateReport?.questions || []).reduce<Record<string, GenerateRecommendation[]>>((acc, q) => {
    (acc[q.question_type] = acc[q.question_type] || []).push(q);
    return acc;
  }, {});

  return (
    <div>
      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          {generateReport ? (
            <span style={{ fontSize: 13, color: '#666' }}>
              共推荐 {generateReport.questions?.length || 0} 题
            </span>
          ) : (
            <span style={{ fontSize: 13, color: '#999' }}>点击"智能生成"开始选题</span>
          )}
        </div>
        <Space>
          <Button type="primary" icon={<SyncOutlined />} loading={loading} onClick={handleGenerate}>
            智能生成
          </Button>
        </Space>
      </div>

      {renderDashboard()}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin tip="正在智能选题..." />
        </div>
      )}

      {!loading && !generateReport && (
        <Empty description="尚未生成推荐" style={{ padding: 40 }} />
      )}

      {!loading && generateReport && Object.entries(groupedByType).map(([qtype, questions]) => {
        const unit = units.find(u =>
          (u.question_config || []).some(c => c.question_type === qtype)
        );
        const unitId = unit?.id || '';
        return (
          <Card
            key={qtype}
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <span>
                {QTYPE_LABELS[qtype] || qtype}
                <Tag style={{ marginLeft: 8 }}>{questions.length}题</Tag>
              </span>
            }
          >
            {questions.map((q, qi) => (
              <div
                key={q.question_id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '8px 0', borderBottom: qi < questions.length - 1 ? '1px solid #f5f5f5' : 'none',
                }}
              >
                <span style={{ color: '#999', fontSize: 12, minWidth: 24 }}>
                  {qi + 1}.
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>
                    {q.title}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Tag color={DIFF_COLORS[q.difficulty]} style={{ fontSize: 10 }}>
                      {DIFF_LABELS[q.difficulty]}
                    </Tag>
                    <Tag style={{ fontSize: 10 }}>{q.score}分</Tag>
                    {q.recommendation_tags.map((t, i) => (
                      <Tag key={i} color={t.includes('✓') ? 'success' : 'default'} style={{ fontSize: 10 }}>
                        {t}
                      </Tag>
                    ))}
                  </div>
                </div>
                <Space size="small" style={{ flexShrink: 0 }}>
                  <Tooltip title="换一题">
                    <Button
                      size="small"
                      icon={<SwapOutlined />}
                      loading={swapLoading[q.question_id]}
                      onClick={() => handleSwap(q.question_id, unitId)}
                    />
                  </Tooltip>
                  <Popconfirm title="移除此题？" onConfirm={() => handleRemove(unitId, q.question_id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 更新 PaperWizardPage 引用**

```tsx
// In frontend/src/pages/papers/PaperWizardPage.tsx:
// Replace: import SelectionStep from './steps/SelectionStep';
// With:    import RecommendStep from './steps/RecommendStep';
//
// In renderStep():
// case 2: return <RecommendStep />;
```

- [ ] **Step 3: 删除旧 SelectionStep**

```bash
rm frontend/src/pages/papers/steps/SelectionStep.tsx
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/papers/steps/RecommendStep.tsx frontend/src/pages/papers/PaperWizardPage.tsx
git rm frontend/src/pages/papers/steps/SelectionStep.tsx
git commit -m "feat: RecommendStep替代SelectionStep — 推荐结果展示+换题+约束仪表盘"
```

---

### Task 8: FinalizeStep 适配

**Files:**
- Modify: `frontend/src/pages/papers/steps/FinalizeStep.tsx`

- [ ] **Step 1: 适配 generateReport 数据源**

FinalizeStep 当前显示的是 units → questions。推荐引擎生成后，数据存储在 store 的 units[].questions 中（与之前相同），因此 FinalizeStep 的展示逻辑无需改动。只需确认约束仪表盘数据正确传递。

实际上 FinalizeStep 无需修改 — 它从 store 读取 paper.units，推荐引擎已经将结果写入 store。

- [ ] **Step 2: 确认不需要修改，跳过**

无需代码变更。FinalizeStep 数据源保持不变。

- [ ] **Step 3: 提交**

无需提交（跳过）。

---

### Task 9: 端到端验证

- [ ] **Step 1: 检查 TypeScript 编译**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: 无新增错误

- [ ] **Step 2: 检查后端 Python 语法**

```bash
cd backend && python -c "
import ast, os
for root,dirs,files in os.walk('app'):
    for f in files:
        if f.endswith('.py'):
            with open(os.path.join(root,f)) as fp:
                ast.parse(fp.read())
print('All OK')
"
```
Expected: All OK

- [ ] **Step 3: 运行后端测试**

```bash
cd backend && python -m pytest tests/test_recommendation_engine.py -v
```
Expected: All tests pass

- [ ] **Step 4: 种子数据验证**

```bash
cd backend && python seed_v35.py --force 2>&1 | tail -5
```
Expected: "导入完成" 无报错

- [ ] **Step 5: 提交最终修改**

```bash
git add -A
git commit -m "feat: 组卷向导V3.6 — 推荐引擎 + 单表结构 + 约束仪表盘"
```
