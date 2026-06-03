# 试卷新建/编辑系统 — 设计文档 V5.0

> **目标**：统一描述试卷新建和编辑的完整设计，合并 V4.3（草稿表）和 V4.4（去纸化）的架构决策。

## 1. 概述

试卷管理提供**新建试卷**和**编辑试卷**两种入口，共享同一个 4 步向导：

| Step | 名称 | 组件 | 说明 |
|------|------|------|------|
| 0 | 基本信息 | `BasicInfoStep` | 标题、学科、年级、难度比值、知识点 |
| 1 | 试卷结构 | `StructureStep` | 按题型/按单元配置题数、每题分值 |
| 2 | 选题 | `RecommendStep` | 智能推荐 + 换题 + 手工选题 + 约束仪表盘 |
| 3 | 预览保存 | `PreviewFinalizeStep` | 试卷概要 + 试卷预览 + 保存/发布 |

**核心原则**：新建试卷在 Step 3 保存之前，**不在 `exam_papers` 主表产生任何记录**。所有中间状态仅存草稿表（`exam_paper_drafts`，`paper_id=NULL`）。

---

## 2. 架构

### 2.1 数据流

```
新建流程:
  initNew() → Step 0~1 → autoSave → 草稿表 (paper_id=NULL)
             Step 2    → autoGenerate/swap → paperless API (不查 paper 表)
             Step 3    → saveAll → 建主表 → saveAll 写数据 → 删草稿
                                      ↑ 此时才首次写入 exam_papers

编辑流程:
  loadDraft(id) → 优先草稿表 → 兜底主表 preview API
  paper.id 始终存在，autoSave/swap/autoGenerate 与新建相同
  saveAll 直接写主表 → 删草稿
```

**两个流程在 Step 2 之后完全收敛**——版面、控件、方法、功能完全一致。唯一差异是"取消修改"按钮仅在编辑模式 `paper?.id` 存在时显示。

### 2.2 状态管理

状态由 `frontend/src/store/paperEditor.ts`（Zustand）集中管理：

```typescript
interface PaperEditorState {
  paper: PaperDraft | null;    // 试卷完整状态（含 units/questions）
  currentStep: number;          // 0~3
  loading: boolean;             // 选题加载中
  saving: boolean;              // 保存中
  lastSaved: Date | null;       // 最后保存时间
  dirty: boolean;               // 是否有未保存修改
  generateReport: GenerateReport | null;  // 选题约束仪表盘
  pendingDraft: any | null;     // 待恢复的草稿
  draftId: string | null;       // 当前草稿记录 ID（用于精确删除）
  // ...
}
```

新建时 `paper.id = null`，编辑时 `paper.id` 为已存在的试卷 ID。

### 2.3 草稿表

草稿表 `exam_paper_drafts` 与主表 `exam_papers` 职责分离：

| 表 | 用途 | 新建时 |
|----|------|--------|
| `exam_papers` | 已保存的正式试卷 | Step 3 保存后才写入 |
| `exam_paper_drafts` | 编辑中的中间状态 | Step 0 起即写入，`paper_id=NULL` |

```sql
CREATE TABLE exam_paper_drafts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES admins(id),
    paper_id UUID REFERENCES exam_papers(id),  -- NULL 表示新建中
    data JSONB NOT NULL,                        -- 完整试卷状态
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(user_id, paper_id)                   -- 编辑时一个用户一个试卷一个草稿
);
```

`paper_id=NULL` 时 PostgreSQL 将多个 NULL 视为互异，不存在唯一约束冲突。upsert 用 `ORDER BY updated_at DESC LIMIT 1` 取最近一条。

---

## 3. 数据模型

### 3.1 PaperDraft（前端）

```typescript
interface PaperDraft {
  id?: string;                    // 新建时为 null
  title: string;
  subject: string;
  grade_level: { scope: string; grades: string[] };
  duration_minutes: number | null;
  difficulty_ratio: { EASY: number; MEDIUM: number; HARD: number };
  total_score: number;
  status: string;                 // 'READY'
  subtitle: string;
  instructions: string;
  description: string;
  show_units: boolean;            // false=按题型, true=按单元
  per_unit_timer: boolean;
  units: ExamPaperUnit[];
  knowledge_node_ids: string[];
}
```

### 3.2 grade_level 归一化（关键）

Ant Design `Select` 单选模式返回字符串 `'G8'`，多选返回数组 `['G8','G9']`。系统中**所有读写 grade_level.grades 的位置**都必须归一化为 `string[]`：

| 位置 | 归一化方式 |
|------|-----------|
| `BasicInfoStep.handleValuesChange` | `Array.isArray ? raw : raw ? [raw] : []` |
| `PreviewFinalizeStep` 渲染前 | 同上 |
| `saveAll` 发送 API 前 | 同上，兜底 `['G8']` |
| `RecommendStep.fetchManualResults` | 同上 |

### 3.3 后端模型

```
exam_papers 1──N exam_paper_units 1──N exam_paper_unit_questions N──1 questions
```

- `ExamPaper`: 试卷元信息（title, subject, grade_level JSONB, status）
- `ExamPaperUnit`: 单元/题型分组（name, position, question_config JSONB, time_limit_minutes）
- `ExamPaperUnitQuestion`: 单元内题目关联（question_id FK, position, score）

---

## 4. API 端点

### 4.1 草稿

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/drafts` | 创建/覆盖草稿，`paper_id` 可为 null |
| GET | `/drafts` | 列出用户所有草稿（含 `paper_id=NULL`） |
| GET | `/drafts?paper_id=X` | 按试卷查草稿 |
| DELETE | `/drafts/{id}` | 删除草稿 |

### 4.2 试卷 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/exam-papers` | 创建试卷（仅元信息） |
| GET | `/exam-papers` | 列表查询 |
| GET | `/exam-papers/{id}` | 获取试卷详情 |
| PUT | `/exam-papers/{id}` | 更新元信息 |
| DELETE | `/exam-papers/{id}` | 删除试卷 |
| POST | `/exam-papers/{id}/save-all` | **原子覆盖**所有单元和题目 |
| POST | `/exam-papers/{id}/publish` | 发布试卷 |
| POST | `/exam-papers/{id}/copy` | 复制试卷 |
| GET | `/exam-papers/{id}/preview` | 获取完整预览数据 |

### 4.3 选题（paperless）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/exam-papers/auto-generate` | **paperless** 智能推荐，不依赖 paper_id |
| POST | `/questions/{qid}/swap` | **paperless** 换一题，不依赖 paper_id |

paperless 端点从请求体直取 `subject`/`grade_level`/`knowledge_node_ids`，不查询 `exam_papers` 表。原有带 `paper_id` 的端点保留不动，作为编辑流程兜底。

### 4.4 题目查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/questions` | 题目列表（支持 subject/grade/question_type/review_status/keyword 过滤） |

---

## 5. 流程详解

### 5.1 新建试卷

```
Step 0 (BasicInfoStep):
  - Ant Design Form + onValuesChange → updateMeta()
  - grade_level.grades 归一化为 string[]
  - 校验: title, subject, grades 必填

Step 0→1 转换:
  - handleNext 验证 → 通过
  - autoSave → draftApi.save(null, paper) → 草稿表 paper_id=NULL → 记录 draftId
  - setStep(1)

Step 1 (StructureStep):
  - 按题型模式: 平表，每行一个题型（题型 Select + 题数 + 分值）
  - 按单元模式: 卡片嵌套，每单元可含多个题型
  - 题型总分校验

Step 1→2 转换:
  - handleNext 验证 → 题数/分值非零 + 总分校验
  - autoSave → 保存含 units 的草稿
  - setStep(2)

Step 2 (RecommendStep):
  - useEffect → 检测 units 有 question_config → 自动选题
    - 无已有题目 → regenerateAll()
    - 有已有题目 + 缺口 → fillGaps()
  - regenerateAll/fillGaps → paperApi.autoGeneratePaperless({subject, difficulty_ratio, knowledge_node_ids, type_configs})
  - handleSwap → paperApi.swapQuestionPaperless(questionId, {subject, grade_level, knowledge_node_ids, exclude_ids})
  - 手工选题 → paperApi.getQuestions({question_type, subject, review_status})
  - 约束仪表盘: 难度分布 + 总分 + 缺题提示

Step 2→3 转换:
  - handleNext 验证 → 题数/分值匹配 + 非零
  - autoSave → 保存含 units+questions 的草稿
  - setStep(3)

Step 3 (PreviewFinalizeStep):
  - Tab "试卷信息": 概要 + 难度偏离 + 选题清单
  - Tab "试卷预览": 完整试卷渲染
  - [保存] → saveAll:
    1. paperApi.create({title, subject, grade_level: normalizeGradeLevel(gl), status: 'READY'}) → pid
    2. paperApi.saveAll(pid, cleanPaper)  — cleanPaper 含 normalizeGradeLevel
    3. draftApi.delete(draftId) → 清理草稿
  - [保存并发布] → saveAll → publish
  - [取消修改] → 隐藏（新建时 paper.id=null）
```

### 5.2 编辑试卷

```
Step 0:
  - loadDraft(id) → draftApi.getByPaper(id) → 有草稿用草稿
  - 无草稿 → paperApi.preview(id) → 规范化 units/questions 数据结构
  - paper.id 始终存在

Step 0~3:
  - 所有步骤与新建完全一致
  - autoSave → draftApi.save(paper.id, paper) — paper_id 为真实 ID

Step 3:
  - saveAll → 直接 paperApi.saveAll(paper.id, cleanPaper) → 删草稿
  - [取消修改] → 显示 → draftApi.delete → 导航回列表
```

### 5.3 草稿恢复

```
新建入口:
  1. 检查 draftApi.list() → 找到 paper_id=NULL 的草稿
  2. 弹窗 "发现未完成的试卷" → 继续编辑 / 重新开始
  3. 继续 → 恢复 draft.data 到 store → 回到 Step 0

编辑入口:
  1. draftApi.getByPaper(id) → 优先恢复草稿
  2. 无草稿 → 从主表加载
```

---

## 6. 关键设计决策

| # | 决策 | 理由 |
|---|------|------|
| 1 | 草稿表独立于主表 | 编辑中间状态不污染主表，列表显示干净 |
| 2 | paperless API 端点 | 新建时 paper_id 为 null，无法调用旧的 `/papers/{id}/auto-generate` |
| 3 | `autoSave` 不建主表记录 | 避免空壳试卷出现在列表中，Step 3 保存时才创建 |
| 4 | `saveAll` 三阶段（建表→写数据→删草稿） | 新建时先拿 id，再写完整数据，最后清理草稿 |
| 5 | `grade_level.grades` 全局归一化 | Ant Design Select 单选/多选返回值类型不一致 |
| 6 | 新建/编辑 Step 2+ 收敛 | 降低维护复杂度，共享所有组件和逻辑 |
| 7 | 双 ErrorBoundary 保护 | PaperWizardPage 层 + PreviewFinalizeStep 层 |
| 8 | `draftId` 精确追踪 | 避免 `find(d => d.paper_id === null)` 歧义 |

---

## 7. 已知限制

- **多标签页新建**：`paper_id=NULL` 草稿在 PostgreSQL 唯一约束中视为互异，同一用户可有多个 null 草稿。upsert 用 `LIMIT 1` 取最近一条，多标签页共享同一草稿。
- **草稿无自动过期**：长期未保存的草稿永久留存，无 TTL 清理机制。
- **题型修改不回填题目**：在 StructureStep 修改题型后，已选题目不会自动重新匹配题型。

---

## 8. 文件索引

| 层 | 文件 | 职责 |
|----|------|------|
| 前端 Store | `store/paperEditor.ts` | 全局状态 + 所有操作 |
| 前端 API | `api/papers.ts` | 试卷 CRUD + 选题 |
| 前端 API | `api/drafts.ts` | 草稿 CRUD |
| 前端页面 | `pages/papers/PaperWizardPage.tsx` | 向导容器 + 步骤转换 |
| 前端页面 | `pages/papers/steps/BasicInfoStep.tsx` | Step 0 |
| 前端页面 | `pages/papers/steps/StructureStep.tsx` | Step 1 |
| 前端页面 | `pages/papers/steps/RecommendStep.tsx` | Step 2 |
| 前端页面 | `pages/papers/steps/PreviewFinalizeStep.tsx` | Step 3 |
| 前端组件 | `components/ErrorBoundary.tsx` | 渲染错误边界 |
| 后端端点 | `endpoints/exam_papers.py` | 试卷 CRUD + paperless auto-generate |
| 后端端点 | `endpoints/drafts.py` | 草稿 CRUD |
| 后端端点 | `endpoints/questions.py` | 题目查询 + paperless swap |
| 后端模型 | `models/exam_paper.py` | ExamPaper + Unit + UnitQuestion |
| 后端模型 | `models/exam_paper_draft.py` | ExamPaperDraft |
| 后端 Schema | `schemas/exam_paper.py` | 请求/响应模型 |
| 后端 Schema | `schemas/exam_paper_draft.py` | 草稿请求/响应 |
| 后端迁移 | `alembic/versions/006_v43_drafts.py` | 草稿表 DDL |
