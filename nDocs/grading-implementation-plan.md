# 判卷服务设计文档

> 版本: V3.0 | 日期: 2026-05-25 | 状态: 规则引擎已完成，LLM 语义评分待二期

---

## 1. 概述

判卷服务负责自动评分学生答案。当前采用**纯规则引擎**，无 LLM 依赖。

**实现状态**:
- 客观题(单选/多选/填空): 已完成
- 主观题(关键词匹配): 已完成，但评分策略较简单
- LLM 语义评分: 待 Phase 2 (V3.2+)

---

## 2. 判卷引擎 (`app/services/judge_engine.py`)

### 2.1 架构

```python
class JudgeEngine:
    def grade(self, question, student_answer, max_score: float) -> GradingResult:
        match question.question_type:
            SINGLE_CHOICE → exact_match_grade(...)
            MULTIPLE_CHOICE → partial_match_grade(...)
            FILL_BLANK → blank_match_grade(...)
            SUBJECTIVE → keyword_match_grade(...)
```

### 2.2 各题型评分规则

#### 单选题 (SINGLE_CHOICE)

```python
def exact_match_grade(q, ans, max_score):
    return max_score if ans.strip().upper() == correct.strip().upper() else 0.0
```

#### 多选题 (MULTIPLE_CHOICE)

```python
def partial_match_grade(q, ans, max_score):
    student_set = set(ans)
    correct_set = set(correct_answer)
    overlap = len(student_set & correct_set)
    # 预期: return (overlap / len(correct_set)) * max_score
    # 当前 Bug: 二次缩放导致得分错误(待修复 R3.1-02)
```

**待修复**: 删除二次缩放步骤 `(score/max_score)*max_score`。

#### 填空题 (FILL_BLANK)

```python
def blank_match_grade(q, ans, max_score):
    matched = sum(1 for blank in correct_blanks if blank in student_answers)
    return (matched / len(correct_blanks)) * max_score
```

#### 主观题 (SUBJECTIVE)

```python
def keyword_match_grade(q, ans, max_score):
    ratio = keyword_overlap_ratio(ans, correct_keywords)
    if ratio >= 0.8: return max_score * 0.9
    elif ratio >= 0.4: return max_score * 0.5
    else: return max_score * 0.1
```

---

## 3. 判卷流程

```
学生提交答案 (POST /answers)
        ↓
创建 AnswerSubmission (status=SUBMITTED)
        ↓
遍历每道题目 → JudgeEngine.grade()
        ↓
创建 AnswerDetail (score, is_correct, feedback)
        ↓
更新 AnswerSubmission.total_score + status=GRADED
        ↓
创建 GradingRecord (审计记录)
        ↓
若有错题 → 触发错题本生成
        ↓
发送通知 (判分完成)
```

**事务保障**: 上述写入操作在 `async with db.begin()` 事务内完成。

---

## 4. 数据模型

### 4.1 GradingRecord (审计记录)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| submission_id | UUID FK | 关联提交 |
| model_used | VARCHAR(100) | "rule_engine" |
| status | VARCHAR(20) | PENDING / COMPLETED / FAILED |
| total_score | FLOAT | |
| details | JSONB | 每题得分明细 |
| created_at | DateTime(tz) | |

### 4.2 答案存储格式

题目 `correct_answer` JSONB 结构:

```json
// 单选
{"options": ["A. xxx", "B. xxx"], "correct_answer": "A"}

// 多选
{"options": [...], "correct_answer": ["A", "C"]}

// 填空
{"options": null, "correct_answer": ["答案1", "答案2"]}

// 主观
{"options": null, "correct_answer": {"keywords": ["关键概念1", "关键概念2"], "max_score": 10}}
```

---

## 5. API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/answers` | 提交答案 → 自动判分 → 审计记录 |
| GET | `/answers/{id}` | 作答详情 |
| GET | `/grading/{id}` | 判卷结果 |
| GET | `/grading/records` | 判卷历史列表 |

---

## 6. LLM 语义评分设计 (Phase 2 / V3.2)

### 6.1 触发条件

```python
if question.question_type == SUBJECTIVE and config.llm_grading_enabled:
    result = llm_grade(question, student_answer, max_score)
else:
    result = rule_grade(question, student_answer, max_score)
```

### 6.2 Prompt 设计

```
你是一位经验丰富的教师。请根据标准答案对学生答案进行评分。

题目: {question_content}
标准答案: {correct_answer}
学生答案: {student_answer}
满分: {max_score}

请输出 JSON 格式:
{
  "score": float,
  "feedback": "评分理由",
  "confidence": 0.0-1.0
}
```

### 6.3 模型选择

- 本地 Ollama (`qwen3-coder:30b` 或等效模型)
- 评分置信度 < 0.7 时标记为 NEEDS_REVIEW

---

## 7. 待实现项

| 项 | 优先级 | 说明 |
|----|--------|------|
| R3.1-02 修复多选题缩放 Bug | 紧急 | 删除二次缩放 |
| 主观题评分细化 | 低 | 更多评分维度(步骤分、逻辑分) |
| LLM 语义评分 | 长期 | V3.2，需 GPU 资源 |
| 批量判卷 | 长期 | Celery 异步队列 |
| 判卷模型 A/B 测试 | 长期 | 对比规则引擎 vs LLM 评分一致性 |

---

## 8. 与 V1.0 设计差异

| V1.0 设计 | V3.0 实际 |
|-----------|-----------|
| 规则引擎 + LLM 混合(一期即用LLM) | 纯规则引擎(LLM 待二期) |
| 消息队列削峰 | 同步判卷(待 Celery) |
| GPU 加速判卷 | CPU 执行 |
| 无审计记录 | 新增 `GradingRecord` |
| 多选题得分公式正确 | 存在二次缩放 Bug(待修复) |
