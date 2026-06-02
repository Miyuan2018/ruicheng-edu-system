# 数据库架构设计文档

> 版本: V3.5 | 日期: 2026-05-28 | 数据库: PostgreSQL 16 | ORM: SQLAlchemy 2.0 (async) | PK: UUID

---

## 1. 概述

系统使用 PostgreSQL 16 作为主数据库，通过 Alembic 管理迁移。
所有模型使用 PostgreSQL 原生 UUID 主键 (`UUID(as_uuid=True)`)，时间戳使用 `DateTime(timezone=True)`。

当前共 **30 张表**，分为: 用户(4)、内容(6)、作答(4)、错题本(2)、任务(2)、系统(4)、参考数据(3)、家长鼓励(5)。

---

## 2. 用户域 (4 表)

### 2.1 sys_admins (系统管理员)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| username | VARCHAR(50) | UNIQUE, NOT NULL | |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt |
| full_name | VARCHAR(100) | | |
| phone | VARCHAR(20) | | |
| email | VARCHAR(100) | | |
| avatar_url | VARCHAR(255) | | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | DateTime(tz) | server_default=now() | |
| updated_at | DateTime(tz) | server_default=now() | |
| last_login_at | DateTime(tz) | | |

内置账号: `SYSAdmin` / `SYSPass`

### 2.2 admins (教师 + 题库管理员)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| username | VARCHAR(50) | UNIQUE, NOT NULL | |
| password_hash | VARCHAR(255) | NOT NULL | |
| full_name | VARCHAR(100) | | |
| phone | VARCHAR(20) | | |
| email | VARCHAR(100) | | |
| **subjects** | **JSONB** | | 学科权限 `["数学","语文"]` 或 `["ALL"]` |
| **grade_level** | **JSONB** | | 年级上限展开数组 `["G5","G6","G7"]` |
| admin_type | INTEGER | | 0=教师, 1=题库管理员, 2=校长, 3=教务主任, 4=学管, 5=班主任 |
| created_by | UUID | FK → sys_admins.id | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | DateTime(tz) | | |
| updated_at | DateTime(tz) | | |
| last_login_at | DateTime(tz) | | |

### 2.3 students (学生)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| username | VARCHAR(50) | UNIQUE, NOT NULL | |
| password_hash | VARCHAR(255) | NOT NULL | |
| full_name | VARCHAR(100) | | |
| phone | VARCHAR(20) | | |
| email | VARCHAR(100) | | |
| grade | VARCHAR(20) | | 年级 |
| school | VARCHAR(100) | | 学校 |
| created_at | DateTime(tz) | | |
| updated_at | DateTime(tz) | | |
| last_login_at | DateTime(tz) | | |

### 2.4 parents (家长)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| username | VARCHAR(50) | UNIQUE | |
| password_hash | VARCHAR(255) | | |
| full_name | VARCHAR(100) | | |
| phone | VARCHAR(20) | | |
| email | VARCHAR(100) | | |
| created_at | DateTime(tz) | | |
| updated_at | DateTime(tz) | | |

**状态**: 模型存在，登录和权限逻辑未实现。

---

## 3. 内容域 (6 表)

### 3.1 subjects (学科)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| name | VARCHAR(100) | 学科名 |
| code | VARCHAR(20) | 编码: math, chinese, english... |
| category | VARCHAR(50) | 分类 |
| is_active | BOOLEAN | |

### 3.2 questions (题目)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| title | TEXT | 题目标题 |
| content | TEXT | 题干内容 |
| question_type | VARCHAR(20) | SINGLE_CHOICE, MULTIPLE_CHOICE, FILL_BLANK, SUBJECTIVE |
| correct_answer | JSONB | 答案结构(见 API 文档) |
| score | FLOAT | 默认分值 |
| difficulty | VARCHAR(20) | EASY, MEDIUM, HARD |
| subject_id | UUID FK | |
| knowledge_point_id | UUID FK | |
| created_by | UUID | 创建者(admins.id) |
| source | VARCHAR(20) | MANUAL / LLM_GENERATED / SCRAPED / OCR_UPLOAD |
| review_status | VARCHAR(20) | PENDING / APPROVED / REJECTED / NEEDS_REVIEW |
| is_typical | BOOLEAN | 是否典型题 |
| content_hash | String(64) | SimHash 文本指纹(用于去重) |
| created_at | DateTime(tz) | |
| updated_at | DateTime(tz) | |

**索引**: `ix_questions_content_hash` (B-tree, 去重查询)

### 3.3 exam_papers (试卷)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| title | VARCHAR(200) | |
| description | TEXT | |
| subject_id | UUID FK | |
| grade_level | JSONB | 适用范围(结构见 API 文档) |
| total_score | FLOAT | 总分 |
| duration | INTEGER | 时长(分钟) |
| created_by | UUID FK → admins.id | |
| created_at | DateTime(tz) | |
| updated_at | DateTime(tz) | |

关联题目通过中间表 `exam_paper_questions`（代码中内联处理）。

### 3.4 syllabi (考纲)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| title | VARCHAR(200) | |
| grade_level | VARCHAR(20) | |
| province | VARCHAR(50) | |
| content | JSONB | 考纲结构化内容 |
| status | VARCHAR(20) | DRAFT / ACTIVE / ARCHIVED |
| created_by | UUID FK | |
| created_at | DateTime(tz) | |

### 3.5 knowledge_nodes (知识节点树)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| syllabus_id | UUID FK | |
| parent_id | UUID FK | 自引用，树结构 |
| name | VARCHAR(100) | 节点名 |
| node_type | VARCHAR(20) | AREA / POINT |
| sort_order | INTEGER | 排序 |
| version | INTEGER DEFAULT 1 | |
| is_active | BOOLEAN DEFAULT true | |
| invalid_reason | VARCHAR(30) | PARENT_MODIFIED / MANUAL / VERSION_CUT |
| is_modified | BOOLEAN DEFAULT false | |
| description | TEXT | |
| metadata | JSONB | |
| created_at | DateTime(tz) | |
| updated_at | DateTime(tz) | |

**索引**: `idx_knowledge_nodes_syllabus` (syllabus_id, version), `idx_knowledge_nodes_parent` (parent_id)

### 3.6 question_tasks (题目生成/抓取任务)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| task_type | VARCHAR(20) | LLM_GENERATE / WEB_SCRAPE |
| status | VARCHAR(20) | PENDING / RUNNING / COMPLETED / FAILED / CANCELLED |
| progress | INTEGER DEFAULT 0 | 0-100 |
| total_items | INTEGER | |
| completed_items | INTEGER DEFAULT 0 | |
| parameters | JSONB | 任务参数 |
| result_summary | JSONB | 结果摘要 |
| error_message | TEXT | |
| model_used | VARCHAR(100) | |
| started_at | DateTime(tz) | |
| completed_at | DateTime(tz) | |
| created_by | UUID FK | |
| created_at | DateTime(tz) | |

---

## 4. JSON Schema 规范

本章节定义系统中两个核心 JSON 字段的严格结构。所有写入这些字段的数据必须符合以下 Schema，否则应返回 422 校验错误。

### 4.1 questions.correct_answer (Text 列，存储 JSON 字符串)

根据 `question_type` 不同，`correct_answer` 有四种互斥结构：

#### 单选题 (SINGLE_CHOICE)

```json
{
  "options": [
    {"label": "A", "text": "选项内容"},
    {"label": "B", "text": "选项内容"}
  ],
  "correct_answer": "A"
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `options` | `Array<{label: string, text: string}>` | 是 | 至少 2 项 |
| `correct_answer` | `string` | 是 | 必须是某选项的 `label` |

#### 多选题 (MULTIPLE_CHOICE)

```json
{
  "options": [
    {"label": "A", "text": "选项内容"},
    {"label": "B", "text": "选项内容"},
    {"label": "C", "text": "选项内容"}
  ],
  "correct_answer": ["A", "C"]
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `options` | `Array<{label: string, text: string}>` | 是 | 至少 2 项 |
| `correct_answer` | `Array<string>` | 是 | 每项必须是某选项的 `label`，至少 1 项 |

#### 填空题 (FILL_BLANK)

```json
{
  "options": null,
  "correct_answer": ["第一个空的答案", "第二个空的答案"]
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `options` | `null` | 是 | 固定为 `null` |
| `correct_answer` | `Array<string>` | 是 | 长度 = 空数，每项非空 |

#### 主观题 (SUBJECTIVE)

```json
{
  "options": null,
  "correct_answer": {
    "keywords": ["关键概念1", "关键概念2", "关键概念3"],
    "max_score": 10
  }
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `options` | `null` | 是 | 固定为 `null` |
| `correct_answer` | `Object` | 是 | 含 `keywords` 和 `max_score` |
| `correct_answer.keywords` | `Array<string>` | 是 | 至少 1 项，用于关键词匹配判分 |
| `correct_answer.max_score` | `number` | 是 | > 0，与题目 `score` 字段一致 |

**校验规则汇总**:
- `question_type` 与 `correct_answer` 结构必须匹配
- `options` 仅在单选/多选时非空
- 判卷引擎读取时，若结构不匹配应抛明确的 `ValueError`

### 4.2 exam_papers.grade_level (JSONB 列)

```json
{
  "scope": "comprehensive",
  "grades": ["G7", "G8", "G9"],
  "chapter": "二次函数",
  "knowledge_points": ["知识点1", "知识点2"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scope` | `string` | 是 | `comprehensive` / `grade_comprehensive` / `chapter` / `knowledge_point` |
| `grades` | `Array<string>` | 是 | 年级编码数组，如 `["G7","G8"]` |
| `chapter` | `string` | 条件必填 | `scope=chapter` 或 `knowledge_point` 时必须 |
| `knowledge_points` | `Array<string>` | 条件必填 | `scope=knowledge_point` 时必须 |

**四种范围示例**:

```json
// 综合 — 跨年级统考
{ "scope": "comprehensive", "grades": ["G5","G6","G7","G8","G9"] }

// 年级综合 — 单年级综合测试
{ "scope": "grade_comprehensive", "grades": ["G8"] }

// 章节 — 章节测试
{ "scope": "chapter", "grades": ["G8"], "chapter": "二次函数" }

// 知识点 — 针对特定知识点的测试
{ "scope": "knowledge_point", "grades": ["G8"], "chapter": "二次函数", "knowledge_points": ["顶点式", "配方法"] }
```

**校验规则**:
- `scope` 必须在合法枚举内
- `grades` 非空，每项需匹配参考数据 `grade_levels` 中的编码
- `scope=chapter` 时 `chapter` 必填
- `scope=knowledge_point` 时 `chapter` 和 `knowledge_points` 都必填

### 4.3 questions.grade_level (JSONB 列)

与 `exam_papers.grade_level` 结构一致，用于标记题目自身的适用范围。允许为 `null`（表示未指定）。

---

## 5. 作答域 (4 表)

### 5.1 answer_submissions (作答提交)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| student_id | UUID FK → students.id | |
| exam_paper_id | UUID FK → exam_papers.id | |
| status | VARCHAR(20) | **待迁移**: SUBMITTED / GRADED / RE_GRADED (当前部分中文值残留) |
| total_score | FLOAT | 总分 |
| started_at | DateTime(tz) | |
| submitted_at | DateTime(tz) | |

**索引**: `ix_submissions_student_status` (student_id, status)

### 5.2 answer_details (作答详情)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| submission_id | UUID FK | |
| question_id | UUID FK | |
| student_answer | JSONB | 学生答案 |
| score | FLOAT | 得分 |
| is_correct | BOOLEAN | |
| feedback | TEXT | 反馈 |

### 5.3 grading_records (判卷审计记录)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| submission_id | UUID FK | |
| model_used | VARCHAR(100) | "rule_engine" / LLM 模型名 |
| status | VARCHAR(20) | PENDING / COMPLETED / FAILED |
| total_score | FLOAT | |
| details | JSONB | 每题得分明细 |
| created_at | DateTime(tz) | |

### 5.4 ocr_uploads (OCR 上传记录)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| student_id | UUID FK | |
| exam_paper_id | UUID FK | |
| file_path | VARCHAR(500) | 图片路径 |
| status | VARCHAR(20) | PENDING / PROCESSING / COMPLETED / FAILED / NEEDS_REVIEW |
| recognized_text | TEXT | 识别结果 |
| confidence | FLOAT | 置信度 |
| created_at | DateTime(tz) | |
| updated_at | DateTime(tz) | |

---

## 6. 错题本域 (2 表)

### 6.1 error_notebooks (错题本)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| student_id | UUID FK | |
| title | VARCHAR(200) | |
| description | TEXT | |
| exam_paper_id | UUID FK | 可选 |
| question_count | INTEGER | |
| status | VARCHAR(20) | DRAFT / GENERATED / EXPORTED |
| generated_at | DateTime(tz) | |
| completed_at | DateTime(tz) | |

### 5.2 error_notebook_questions (错题本题目关联)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| notebook_id | UUID FK | |
| question_id | UUID FK | 原错题 |
| practice_question_id | UUID FK | 强化练习题 |
| error_type | VARCHAR(50) | |
| notes | TEXT | 学生笔记 |

---

## 6. 任务与通知 (2 表)

### 6.1 self_study_tasks (自学任务)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| title | VARCHAR(200) | |
| description | TEXT | |
| task_type | VARCHAR(20) | KNOWLEDGE_EXTRACTION / QUESTION_GENERATION / MODEL_TRAINING / DATA_SYNC |
| status | VARCHAR(20) | PENDING / RUNNING / COMPLETED / FAILED / CANCELLED |
| priority | INTEGER | 1-10 |
| parameters | JSONB | |
| schedule | VARCHAR(100) | cron 或一次性时间 |
| created_by | UUID FK | |
| created_at | DateTime(tz) | |

**状态**: 模型和占位端点存在，核心调度逻辑未实现。

### 6.2 notifications (通知)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| recipient_id | UUID | 接收者 |
| recipient_type | VARCHAR(20) | STUDENT / TEACHER / ADMIN / SYS_ADMIN |
| title | VARCHAR(200) | |
| content | TEXT | |
| type | VARCHAR(20) | GRADING_COMPLETE / ERROR_NOTEBOOK_READY / EXAM_PUBLISHED / SYSTEM |
| is_read | BOOLEAN DEFAULT false | |
| related_id | UUID | 关联业务 ID |
| related_type | VARCHAR(50) | |
| created_at | DateTime(tz) | |

**索引**: `ix_notifications_recipient_status` (recipient_id, is_read)

---

## 7. 系统域 (4 表)

### 7.1 llm_configs (大模型配置)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| name | VARCHAR(100) | |
| provider | VARCHAR(50) | ollama / vllm / openai / custom |
| endpoint | VARCHAR(500) | API 地址 |
| model_name | VARCHAR(100) | |
| is_local | BOOLEAN DEFAULT true | |
| is_active | BOOLEAN DEFAULT true | |
| config | JSONB | 温度/top_p 等 |
| created_at | DateTime(tz) | |

### 7.2 ml_models (模型注册)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| name | VARCHAR(100) | |
| version | VARCHAR(50) | |
| model_path | VARCHAR(500) | |
| status | VARCHAR(20) | ACTIVE / ARCHIVED |
| metrics | JSONB | |
| created_at | DateTime(tz) | |

**状态**: 模型存在，MLflow 集成未实现。

### 7.3 roles (角色)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| name | VARCHAR(50) | |
| permissions | JSONB | |

**状态**: 表存在，但实际权限检查使用 `user_type` 字符串比较。

### 7.4 reference_data (参考数据)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| data_type | VARCHAR(50) | question_type / difficulty / grade_level / province ... |
| code | VARCHAR(50) | 编码 |
| name | VARCHAR(100) | 名称 |
| sort_order | INTEGER | |
| is_active | BOOLEAN | |
| metadata | JSONB | |

---

## 8. 家长鼓励域 (5 表)

> 家长作为"鼓励者"角色，通过发送鼓励消息、设置奖励目标、庆祝里程碑来正向激励学生。
> 家长只能查看正面趋势数据（进步、坚持、完成），不可查看分数和错题详情。

### 8.1 parent_student_links (亲子关联)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| parent_id | UUID | FK → parents.id, NOT NULL | |
| student_id | UUID | FK → students.id, NOT NULL | |
| relationship | VARCHAR(20) | nullable | 关系(父亲/母亲/其他) |
| invite_code_used | VARCHAR(6) | NOT NULL | 关联时使用的邀请码 |
| is_active | BOOLEAN | DEFAULT true | |
| linked_at | DateTime(tz) | server_default=now() | |
| unlinked_at | DateTime(tz) | nullable | |

**唯一约束**: `UniqueConstraint(parent_id, student_id)`

### 8.2 encouragements (鼓励消息)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| parent_id | UUID | FK → parents.id, NOT NULL | |
| student_id | UUID | FK → students.id, NOT NULL | |
| encouragement_type | VARCHAR(20) | CHECK: TEMPLATE/CUSTOM/CELEBRATION/REWARD_COMPLETE | 鼓励类型 |
| title | VARCHAR(200) | nullable | |
| message | TEXT | NOT NULL | |
| template_id | UUID | FK → encouragement_templates.id, nullable | 使用模板时关联 |
| celebration_event_id | UUID | FK → celebration_events.id, nullable | 庆祝型鼓励时关联 |
| is_read | BOOLEAN | DEFAULT false | |
| read_at | DateTime(tz) | nullable | |
| created_at | DateTime(tz) | server_default=now() | |

**索引**: `ix_encouragements_student_read` (student_id, is_read), `ix_encouragements_parent` (parent_id)

### 8.3 reward_goals (奖励目标)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| parent_id | UUID | FK → parents.id, NOT NULL | |
| student_id | UUID | FK → students.id, NOT NULL | |
| title | VARCHAR(200) | NOT NULL | |
| description | TEXT | nullable | |
| reward_description | VARCHAR(500) | NOT NULL | 奖励内容描述 |
| metric_type | VARCHAR(30) | CHECK: PAPERS_COMPLETED/PRACTICE_SESSIONS/STREAK_DAYS/ERRORS_CLEARED/ACCURACY_IMPROVEMENT | 追踪指标类型 |
| target_value | INTEGER | NOT NULL | 目标值 |
| current_value | INTEGER | DEFAULT 0 | 当前进度 |
| status | VARCHAR(20) | CHECK: ACTIVE/COMPLETED/CANCELLED/EXPIRED | |
| deadline | DateTime(tz) | nullable | |
| completed_at | DateTime(tz) | nullable | |
| is_reward_claimed | BOOLEAN | DEFAULT false | 奖励是否已兑现 |
| claimed_at | DateTime(tz) | nullable | |
| created_at | DateTime(tz) | server_default=now() | |
| updated_at | DateTime(tz) | server_default=now() | |

**索引**: `ix_reward_goals_student_status` (student_id, status), `ix_reward_goals_parent` (parent_id)

### 8.4 celebration_events (庆祝里程碑)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| student_id | UUID | FK → students.id, NOT NULL | |
| event_type | VARCHAR(30) | CHECK: PAPER_COMPLETED/STREAK_MILESTONE/ACCURACY_IMPROVED/ERRORS_CLEARED/SUBJECT_MASTERY | 事件类型 |
| title | VARCHAR(200) | NOT NULL | |
| description | TEXT | NOT NULL | |
| metric_value | INTEGER | nullable | 相关指标数值 |
| parent_notified | BOOLEAN | DEFAULT false | |
| parent_acknowledged | BOOLEAN | DEFAULT false | |
| encouragement_sent | BOOLEAN | DEFAULT false | |
| created_at | DateTime(tz) | server_default=now() | |

**索引**: `ix_celebration_events_student` (student_id)

### 8.5 encouragement_templates (鼓励模板)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| category | VARCHAR(20) | CHECK: EFFORT/PROGRESS/PERSISTENCE/COMPLETION/GENERAL | 模板分类 |
| title | VARCHAR(100) | NOT NULL | |
| message_template | TEXT | NOT NULL | 模板内容(支持 `{student_name}` 占位) |
| is_active | BOOLEAN | DEFAULT true | |
| usage_count | INTEGER | DEFAULT 0 | 使用次数 |
| created_at | DateTime(tz) | server_default=now() | |

### 8.6 students 表变更

新增字段:

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| invite_code | VARCHAR(6) | UNIQUE, nullable | 邀请码(6位，家长关联用) |
| invite_code_expires_at | DateTime(tz) | nullable | 邀请码过期时间 |

### 8.7 parents 表废弃字段

`parents` 表的 `student_ids` JSON 列标记为 **废弃(deprecated)**，新逻辑通过 `parent_student_links` 表管理亲子关系，支持一对多关联。

---

## 9. 讲题板与推荐域 (3 表)

> 讲题板从独立页面重构为嵌入式 Drawer，教师标记重点题时 LLM 自动生成讲解。推荐机制允许教师为特定学生推荐题目。

### 9.1 explanation_sessions (讲解会话)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| question_id | UUID | FK → questions.id, UNIQUE, nullable | 关联题目 |
| title | VARCHAR(500) | NOT NULL | 讲解标题 |
| topic | VARCHAR(100) | nullable | 主题标签 |
| difficulty_label | VARCHAR(50) | nullable | 难度标签 |
| problem_statement | Text | nullable | 题目原文 |
| graph_config | JSONB | nullable | 函数图形配置 |
| is_active | BOOLEAN | default true | 软删除标志 |
| created_by | UUID | FK → admins.id, nullable | 创建教师 |
| created_at | TIMESTAMP(tz) | server_default now() | |
| updated_at | TIMESTAMP(tz) | on update | |

### 9.2 explanation_steps (讲解步骤)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| session_id | UUID | FK → explanation_sessions.id (CASCADE) | 所属会话 |
| step_order | INTEGER | NOT NULL, UNIQUE(session_id, step_order) | 步骤序号 |
| text | Text | NOT NULL | 讲解文本 |
| panda_emotion | VARCHAR(20) | CHECK IN ('idle','thinking','explaining','satisfied') | 表情 |
| board_line | Text | nullable | 板书内容 |
| created_at | TIMESTAMP(tz) | server_default now() | |

### 9.3 question_recommendations (题目推荐) — V3.1 新增

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| question_id | UUID | FK → questions.id, NOT NULL, indexed | 推荐题目 |
| student_id | UUID | FK → students.id, NOT NULL, indexed | 被推荐学生 |
| recommended_by | UUID | FK → admins.id, NOT NULL | 推荐教师 |
| created_at | TIMESTAMP(tz) | server_default now() | |

**唯一约束**: `(question_id, student_id)` — 同一题目对同一学生只能推荐一次

**迁移**: `010_add_question_recommendations.py`

---

## 10. 关联关系图

```
sys_admins ──┐
             ├──→ admins ──→ classes ──→ school_class_students ←── students
             │                │                               │
             │                └──→ exam_papers ──→ answer_submissions ──→ answer_details
             │                       │                  │
             │                       │                  └──→ grading_records
             │                       │
             │                       └──→ error_notebooks ──→ error_notebook_questions
             │
             ├──→ llm_configs
             ├──→ question_tasks
             └──→ syllabi ──→ knowledge_nodes ──→ questions ──→(关联 exam_papers)
                                                    │
                                                    ├──→ explanation_sessions ──→ explanation_steps
                                                    └──→ question_recommendations ←── students
```

---

## 10. 迁移历史

| 版本 | 说明 |
|------|------|
| 001 | 初始建表 |
| 002 | 添加 provinces 表 |
| 003 | 添加 questions.is_typical |
| 004 | V3.0 修复(待执行): content_hash, status 枚举迁移, 索引 |
| 005 | OCR NEEDS_REVIEW 状态 |
| 006 | 题目去重 content_hash |
| 007 | 通知系统: notifications |
| 008 | 讲题板: explanation_sessions + explanation_steps |
| 009 | 家长鼓励域: parent_student_links + encouragements + reward_goals + celebration_records + parents |
| 010 | 题目推荐: question_recommendations |
| 011 | **UUID 类型统一**: 全表主键/外键 String(36)→PostgreSQL UUID(16 bytes) |

---

## 12. 与旧版设计差异

| 旧版(V1.0) | 当前(V3.0) |
|-----------|-----------|
| 单 `users` 表 | 三表分离: `sys_admins` + `admins` + `students` |
| SQLite | PostgreSQL 16 |
| `role` 字段字符串 | `admin_type` 整数 + JWT `type` claim |
| 无审计表 | 新增 `grading_records` |
| 无通知表 | 新增 `notifications` |
| 无去重字段 | `questions.content_hash` |
| 无版本字段 | `knowledge_nodes.version` |
| 无家长鼓励 | 家长鼓励域 5 表 + students 邀请码 |
| 无讲题板 | explanation_sessions + explanation_steps (互动讲解) |
| 无推荐机制 | question_recommendations (教师为学生推荐题目) |
| String(36) 主键 | PostgreSQL 原生 UUID (16 bytes, 二进制索引) |
