# 组卷向导 V3.6 重设计

**日期**: 2026-06-01
**状态**: 设计中
**依赖**: 知识树清理 (已完成) → 组卷算法 → UI 重构

## 一、背景

### 问题
当前组卷向导存在以下问题：
1. 自动选题算法过于简单（随机洗牌，无法保证配平精度和题目质量）
2. UI 暴露"单元"概念，教师理解困难，操作混乱
3. 难度比例在试卷级和题型配置级两处定义，互相冲突
4. 知识点筛选靠 ILIKE 模糊匹配，不精准
5. 知识树系统存在两套并存、版本复制 bug、题目-知识点脱节等问题

### 目标
教师输入基本约束 → 系统一次生成完整试卷 → 教师预览微调 → 发布。整个过程对教师透明、可理解、可干预。

## 二、约束模型

### 试卷级（BasicInfoStep 唯一设置）
| 字段 | 说明 |
|------|------|
| 总分 (total_score) | 整卷满分 |
| 难度比例 (difficulty_ratio) | EASY:MEDIUM:HARD 的百分比，合计必须100% |
| 知识点范围 (knowledge_point_ids) | 从知识树选择 POINT 节点，可多选 |
| 适用范围 (grade_level) | 年级综合 / 跨年级综合 |
| 考试时长 (duration_minutes) | 分钟 |

### 结构级（StructureStep 设置）
| 字段 | 说明 |
|------|------|
| 题型 (question_type) | SINGLE_CHOICE / MULTIPLE_CHOICE / FILL_BLANK / SUBJECTIVE |
| 题数 (count) | 该题型出多少道 |
| 每题分值 (score_per_question) | 该题型每题几分 |

结构总分 `Σ(count × score_per_question)` 必须等于试卷总分。

## 三、推荐引擎设计

### 核心思路
不叫"算法"，叫"智能推荐引擎"。对教师来说就是一个按钮，按了出结果。

### 工作流程
```
教师点击"智能生成"
  → 系统按约束从题库选出一套最合适的题
  → 返回完整试卷 + 每道题的推荐理由
```

### 内部两步（教师无感）

**第一步：配额分解**
- 输入：试卷难度比例 + 各题型配置
- 输出：每个题型各需要多少道 EASY/MEDIUM/HARD 题
- 逻辑：按比例分配，取整后余数归入 MEDIUM

**第二步：加权选题**
每道候选题目计算匹配得分：
- 知识点匹配度（通过 question_knowledge_nodes 表 JOIN，命中越多分越高）
- 题目质量分（is_typical 典型题加权、review_status=APPROVED）
- 新鲜度（近期未被选用的题目优先）
- 难度精确匹配

按权重排序，取高分题。同分题随机打乱（保证多样性）。

### 评分函数

```python
def score_question(question, config, paper_knowledge_node_ids, used_ids, recency_window):
    s = 0.0
    # 知识点匹配 (0-40分) — 通过 question_knowledge_nodes JOIN 查询
    matched = len(set(question.kn_ids) & paper_knowledge_node_ids)
    total = len(paper_knowledge_node_ids)
    if total > 0:
        s += 40.0 * (matched / total)
    # 题目质量 (0-30分)
    if question.is_typical:
        s += 30.0
    elif question.review_status == "APPROVED":
        s += 15.0
    # 新鲜度 (0-20分) — 近期未选用优先
    if question.id not in used_ids:
        s += 20.0
    # 难度匹配 (0-10分) — 仅在需要的难度桶内加分
    if question.difficulty == config.target_difficulty:
        s += 10.0
    return s
```

### 配额分解算法

```
输入: types=[{question_type, count, score_per_question}, ...], ratio={EASY, MEDIUM, HARD}
输出: [{question_type, count, score, target_difficulty}, ...]

对每个题型:
  total = count
  for diff in [EASY, MEDIUM, HARD]:
    quota[diff] = floor(total * ratio[diff])
  remainder = total - sum(quota.values())
  quota["MEDIUM"] += remainder  # 余数归 MEDIUM
  对每个 diff，生成 quota[diff] 条目标记录
```

### 换题逻辑

```
POST /exam-papers/{id}/questions/{qid}/swap
  → 查询同题型、同难度桶的未选题
  → 按评分函数排序，返回 top 3 备选
  → 用户选一个替换，原题放回候选池
```

### 推荐理由透明化
每道被选中的题标注可见标签：
- `知识点匹配 ✓` — 命中了设定的知识点
- `典型题` — 高频考点题
- `难度匹配 ✓` — 符合配额要求

### 备选题池
每道题旁有"换一题"按钮，展示3道备选（次高分题），教师可一键替换。备选题排除已选中的题，保证不重复。

### 约束仪表盘（实时）
```
难度分布 ████░░  EASY 3/10 ✓ | MEDIUM 5/10 ✓ | HARD 2/10 ✓
知识点覆盖 ●●○  勾股定理 ✓ | 一次函数 ✓ | 不等式 ✗
总分      100/100 ✓
```
红色告警=约束未满足，绿色=已满足。

## 四、向导步骤重构

保持5步，职责更清晰：

### 第1步：基本信息
- 试卷标题、副标题、描述
- 学科、适用范围、考试时长
- **难度比例**：三个输入框（简单/中等/困难），合计须为100%
- **知识点范围**：从知识树选择 POINT 节点（多选）

### 第2步：试卷结构
不暴露"单元"概念，就是一张简洁的题型配置表：

```
┌──────────┬──────┬──────────┬────────┐
│ 题型     │ 题数 │ 每题分值 │ 小计   │
├──────────┼──────┼──────────┼────────┤
│ 单选题   │  10  │    3分   │  30分  │
│ 填空题   │   5  │    4分   │  20分  │
│ 解答题   │   5  │   10分   │  50分  │
├──────────┼──────┼──────────┼────────┤
│ 合计     │ 20题 │          │ 100分  │
└──────────┴──────┴──────────┴────────┘
```

- 每行：题型下拉 + 题数 + 分值
- 底部：合计题数 + 总分 vs 目标总分（不匹配红色提示）
- 快捷预设："按题型分组"一键填充默认值
- 支持添加/删除行

### 第3步：智能推荐
- 顶部约束仪表盘（实时）
- 按题型分组展示推荐结果
- 每道题：题卡 + 推荐理由标签 + [换一题] [移除] 按钮
- "换一题"展开备选列表
- "全部重新生成"按钮

### 第4步：预览
- A4模拟预览
- 跨题型连续编号
- 导出 Word/PDF
- 打印（独立窗口）

### 第5步：入库
- 试卷概要卡片
- 草稿/发布切换
- 选择班级发布

## 五、知识树清理（已完成）

### 删除
- `knowledge_points` 表及模型
- `knowledge_point_models` 表及模型
- `syllabi.knowledge_tree` JSON 列
- `_mock_extract_knowledge()` 及相关端点
- 501 存根端点 × 10

### 新增
- `question_knowledge_nodes` 表（题目-知识点多对多结构关联）
- 三级知识树演示数据（AREA→TOPIC→POINT，60+节点）
- 80道题目全部关联知识点

### 修复
- 版本复制时 parent_id 重映射 bug

## 六、数据模型变更

### ExamPaper 模型（保持不变）
现有 `ExamPaper → ExamPaperUnit → ExamPaperUnitQuestion` 三层结构不变。

### QuestionConfigItem 简化
```diff
- knowledge_points: list[str]    # 移除（收归试卷级）
- difficulty_ratio: dict         # 移除（收归试卷级）
  question_type: str
  count: int
  score_per_question: int
```

### 后端 API 变更
- 修改 `_auto_select_for_config`：知识点筛选改为 JOIN `question_knowledge_nodes`
- 新增 `POST /exam-papers/{id}/auto-generate`：一次生成完整试卷（替代逐单元 auto-select）
- 新增 `GET /exam-papers/{id}/recommendation-report`：返回推荐理由和约束仪表盘数据
- 新增 `POST /exam-papers/{id}/questions/{qid}/swap`：换题接口，返回备选列表

## 七、实施计划

### Phase 1: 推荐引擎（后端核心）
1. 实现配额分解逻辑
2. 实现加权选题逻辑（评分函数 + 排序 + 去重）
3. 实现 `auto-generate` 端点
4. 实现 `recommendation-report` 端点
5. 实现 `swap` 端点
6. 单元测试验证配平精度

### Phase 2: UI 重构（前端）
1. BasicInfoStep 添加知识点选择器（接知识树 API）
2. StructureStep 简化为单表视图
3. SelectionStep 替换为 RecommendStep（推荐结果展示 + 换题）
4. PreviewStep / FinalizeStep 适配

### Phase 3: 验收
1. 端到端流程测试
2. 约束配平验证
3. 种子数据验证
