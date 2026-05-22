# edu_system 数据库架构和迁移计划

> **V1.0 状态**: ✅ 17张表全部创建, SQLite 运行中, Alembic 迁移可用。
> V2.0: PostgreSQL 迁移 + JSONB 替换 + 全文检索 + 分区。
> 详见 `docs/requirements-v2.0.md`

## 1. 数据库概述

本项目使用 PostgreSQL 作为主要关系数据库，配合 SQLAlchemy ORM 进行对象关系映射。数据库设计遵循以下原则：
- 使用适当的索引提高查询性能
- 使用 JSONB 字段存储灵活属性（知识点、标签等）
- 实施适当的外键关系确保数据完整性
- 考虑对大表进行分区（如答案提交表）
- 遵循范式化设计，适度反范式化以提高读取性能

## 2. 表结构设计

### 2.1 用户表 (users)
存储系统中所有用户的信息，包括学生、老师和管理员。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 用户唯一标识 |
| username | VARCHAR(50) | NOT NULL, UNIQUE | 用户名 |
| email | VARCHAR(100) | NOT NULL, UNIQUE | 电子邮件 |
| password_hash | VARCHAR(255) | NOT NULL | 加密后的密码 |
| full_name | VARCHAR(100) | NOT NULL | 姓名 |
| role | VARCHAR(20) | NOT NULL, CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN')) | 用户角色 |
| phone | VARCHAR(20) |  | 手机号码 |
| avatar_url | VARCHAR(255) |  | 头像URL |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 账户是否激活 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |
| last_login_at | TIMESTAMP WITH TIME ZONE |  | 上次登录时间 |

索引：
- 主键索引 (id)
- 唯一索引 (username)
- 唯一索引 (email)
- 角色索引 (role)
- 活跃状态索引 (is_active)

### 2.2 班级表 (classes)
老师创建和管理的班级信息。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 班级唯一标识 |
| name | VARCHAR(100) | NOT NULL | 班级名称 |
| description | TEXT |  | 班级描述 |
| teacher_id | UUID | NOT NULL, FOREIGN KEY (users.id) | 班级老师 |
| grade_level | VARCHAR(20) |  | 年级（如：一年级，高三） |
| subject | VARCHAR(50) |  | 学科（如：数学，英语） |
| start_date | DATE |  | 开始日期 |
| end_date | DATE |  | 结束日期 |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 是否激活 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 教师索引 (teacher_id)
- 年级索引 (grade_level)
- 学科索引 (subject)
- 活跃状态索引 (is_active)

### 2.3 班级学生关系表 (class_students)
记录学生所属的班级（多对多关系）。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 关系唯一标识 |
| class_id | UUID | NOT NULL, FOREIGN KEY (classes.id) | 班级ID |
| student_id | UUID | NOT NULL, FOREIGN KEY (users.id) | 学生ID |
| joined_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 加入时间 |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 是否仍在班级中 |

索引：
- 主键索引 (id)
- 班级ID索引 (class_id)
- 学生ID索引 (student_id)
- 唯一约束 (class_id, student_id) 防止重复加入

### 2.4 知识点表 (knowledge_points)
存储题目涉及的知识点，支持层级结构。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 知识点唯一标识 |
| code | VARCHAR(50) | NOT NULL, UNIQUE | 知识点编码（如：MATH001） |
| name | VARCHAR(100) | NOT NULL | 知识点名称 |
| description | TEXT |  | 知识点描述 |
| parent_id | UUID | FOREIGN KEY (knowledge_points.id) | 父知识点ID（支持层级） |
| subject | VARCHAR(50) | NOT NULL | 所属学科 |
| grade_level | VARCHAR(20) |  | 适用年级 |
| difficulty_level | VARCHAR(10) | CHECK (difficulty_level IN ('EASY', 'MEDIUM', 'HARD')) | 默认难度 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 唯一索引 (code)
- 学科索引 (subject)
- 年级索引 (grade_level)
- 难度索引 (difficulty_level)
- 父知识点索引 (parent_id)

### 2.5 题目表 (questions)
存储题目库中的题目信息。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 题目唯一标识 |
| title | VARCHAR(500) | NOT NULL | 题目标题/内容 |
| question_type | VARCHAR(20) | NOT NULL, CHECK (question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'FILL_BLANK', 'SUBJECTIVE')) | 题目类型 |
| difficulty | VARCHAR(10) | NOT NULL, CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')) | 题目难度 |
| subject | VARCHAR(50) | NOT NULL | 所属学科 |
| grade_level | VARCHAR(20) |  | 适用年级 |
| score | INTEGER | NOT NULL, CHECK (score > 0) | 题目分值 |
| correct_answer | TEXT |  | 正确答案（对于客观题） |
| explanation | TEXT |  | 题目解析 |
| meta_data | JSONB |  | 存储灵活属性（标签、来源等） |
| created_by | UUID | NOT NULL, FOREIGN KEY (users.id) | 出题人 |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 是否激活 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 学科索引 (subject)
- 年级索引 (grade_level)
- 题目类型索引 (question_type)
- 难度索引 (difficulty)
- 出题人索引 (created_by)
- 活跃状态索引 (is_active)
- GIN索引 on meta_data (为了JSONB查询)

### 2.6 题目知识点关系表 (question_knowledge_points)
题目和知识点的多对多关系。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 关系唯一标识 |
| question_id | UUID | NOT NULL, FOREIGN KEY (questions.id) | 题目ID |
| knowledge_point_id | UUID | NOT NULL, FOREIGN KEY (knowledge_points.id) | 知识点ID |
| weight | DECIMAL(3,2) | DEFAULT 1.0, CHECK (weight > 0 AND weight <= 1.0) | 知识点在题目中的权重 |

索引：
- 主键索引 (id)
- 题目ID索引 (question_id)
- 知识点ID索引 (knowledge_point_id)
- 唯一约束 (question_id, knowledge_point_id)

### 2.7 试卷表 (exam_papers)
存储试卷信息。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 试卷唯一标识 |
| title | VARCHAR(200) | NOT NULL | 试卷标题 |
| description | TEXT |  | 试卷描述 |
| subject | VARCHAR(50) | NOT NULL | 所属学科 |
| grade_level | VARCHAR(20) |  | 适用年级 |
| total_score | INTEGER | NOT NULL, CHECK (total_score > 0) | 试卷总分 |
| time_limit | INTEGER |  | 时间限制（分钟） |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')), DEFAULT 'DRAFT' | 试卷状态 |
| created_by | UUID | NOT NULL, FOREIGN KEY (users.id) | 创建人 |
| is_randomized | BOOLEAN | NOT NULL, DEFAULT false | 是否随机抽题 |
| question_count | INTEGER | NOT NULL, CHECK (question_count >= 0) | 题目数量 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |
| published_at | TIMESTAMP WITH TIME ZONE |  | 发布时间 |

索引：
- 主键索引 (id)
- 学科索引 (subject)
- 年级索引 (grade_level)
- 状态索引 (status)
- 创建人索引 (created_by)
- 发布时间索引 (published_at)

### 2.8 试卷题目关系表 (exam_paper_questions)
存储试卷包含的具体题目及其顺序和分值。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 关系唯一标识 |
| exam_paper_id | UUID | NOT NULL, FOREIGN KEY (exam_papers.id) | 试卷ID |
| question_id | UUID | NOT NULL, FOREIGN KEY (questions.id) | 题目ID |
| question_order | INTEGER | NOT NULL, CHECK (question_order >= 0) | 在试卷中的顺序 |
| question_score | INTEGER | NOT NULL, CHECK (question_score > 0) | 题目在试卷中的分值 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |

索引：
- 主键索引 (id)
- 试卷ID索引 (exam_paper_id)
- 题目ID索引 (question_id)
- 唯一约束 (exam_paper_id, question_order) 确保顺序唯一
- 唯一约束 (exam_paper_id, question_id) 防止重复添加同一题目

### 2.9 答案提交表 (answer_submissions)
存储学生的答案提交（包括在线作答和OCR上传）。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 答案提交唯一标识 |
| student_id | UUID | NOT NULL, FOREIGN KEY (users.id) | 学生ID |
| exam_paper_id | UUID | NOT NULL, FOREIGN KEY (exam_papers.id) | 试卷ID |
| submission_type | VARCHAR(20) | NOT NULL, CHECK (submission_type IN ('ONLINE', 'OCR')) | 提交类型 |
| ocr_upload_id | UUID | FOREIGN KEY (ocr_uploads.id) | 如果是OCR提交，关联的OCR上传记录 |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('SUBMITTED', 'GRADING', 'GRADED', 'RETURNED')), DEFAULT 'SUBMITTED' | 答案状态 |
| started_at | TIMESTAMP WITH TIME ZONE |  | 开始作答时间（在线作答） |
| submitted_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 提交时间 |
| graded_at | TIMESTAMP WITH TIME ZONE |  | 判卷完成时间 |
| total_score | DECIMAL(5,2) |  | 获得的总分 |
| percentage | DECIMAL(5,2) |  | 得分百分比 |
| meta_data | JSONB |  | 存储批改详情等灵活信息 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 学生ID索引 (student_id)
- 试卷ID索引 (exam_paper_id)
- 提交类型索引 (submission_type)
- 状态索引 (status)
- 提交时间索引 (submitted_at)
- 判卷时间索引 (graded_at)
- 复合索引 (student_id, exam_paper_id) 用于查询学生某试卷的答案

### 2.10 答案详情表 (answer_details)
存储学生对每个题目的具体答案。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 答案详情唯一标识 |
| answer_submission_id | UUID | NOT NULL, FOREIGN KEY (answer_submissions.id) | 答案提交ID |
| question_id | UUID | NOT NULL, FOREIGN KEY (questions.id) | 题目ID |
| student_answer | TEXT |  | 学生的答案 |
| is_correct | BOOLEAN |  | 是否正确（对于客观题） |
| score_obtained | DECIMAL(5,2) |  | 获得的分数 |
| feedback | TEXT |  | 老师或系统的反馈 |
| meta_data | JSONB |  | 存储批改过程等灵活信息 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 答案提交ID索引 (answer_submission_id)
- 题目ID索引 (question_id)
- 唯一约束 (answer_submission_id, question_id) 确保每题只有一个答案
- 是否正确索引 (is_correct)
- 分数索引 (score_obtained)

### 2.11 OCR上传表 (ocr_uploads)
存储OCR图片上传记录和处理状态。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | OCR上传唯一标识 |
| student_id | UUID | NOT NULL, FOREIGN KEY (users.id) | 上传学生ID |
| exam_paper_id | UUID | NOT NULL, FOREIGN KEY (exam_papers.id) | 关联的试卷ID |
| file_name | VARCHAR(255) | NOT NULL | 原始文件名 |
| file_path | VARCHAR(500) | NOT NULL | 存储路径（在MinIO中的路径） |
| file_size | INTEGER | NOT NULL, CHECK (file_size > 0) | 文件大小（字节） |
| file_type | VARCHAR(50) | NOT NULL | 文件类型（image/jpeg, image/png等） |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')), DEFAULT 'PENDING' | 处理状态 |
| ocr_engine | VARCHAR(50) |  | 使用的OCR引擎（paddleocr, tesseract等） |
| confidence_score | DECIMAL(5,4) |  | OCR识别置信度 |
| processed_text | TEXT |  | OCR识别出的纯文本 |
| structured_data | JSONB |  | 结构化的识别结果（按题目分割的答案） |
| error_message | TEXT |  | 如果失败，错误信息 |
| started_at | TIMESTAMP WITH TIME ZONE |  | 开始处理时间 |
| completed_at | TIMESTAMP WITH TIME ZONE |  | 处理完成时间 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 学生ID索引 (student_id)
- 试卷ID索引 (exam_paper_id)
- 状态索引 (status)
- 创建时间索引 (created_at)
- 完成时间索引 (completed_at)
- OCR引擎索引 (ocr_engine)

### 2.12 判卷记录表 (grading_records)
存储自动判卷的过程和结果。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 判卷记录唯一标识 |
| answer_submission_id | UUID | NOT NULL, FOREIGN KEY (answer_submissions.id) | 答案提交ID |
| model_used | VARCHAR(100) |  | 使用的判卷模型名称和版本 |
| model_version | VARCHAR(50) |  | 模型具体版本 |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')), DEFAULT 'PENDING' | 判卷状态 |
| started_at | TIMESTAMP WITH TIME ZONE |  | 开始判卷时间 |
| completed_at | TIMESTAMP WITH TIME ZONE |  | 判卷完成时间 |
| total_score | DECIMAL(5,2) |  | 自动判卷得到的总分 |
| percentage | DECIMAL(5,2) |  | 自动判卷得分百分比 |
| details | JSONB |  | 详细判卷结果（每题得分、反馈等） |
| error_message | TEXT |  | 如果失败，错误信息 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 答案提交ID索引 (answer_submission_id)
- 状态索引 (status)
- 模型使用索引 (model_used)
- 开始时间索引 (started_at)
- 完成时间索引 (completed_at)

### 2.13 错题本表 (error_notebooks)
存储学生的错题本记录。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 错题本唯一标识 |
| student_id | UUID | NOT NULL, FOREIGN KEY (users.id) | 学生ID |
| title | VARCHAR(200) | NOT NULL | 错题本标题（如：2026年5月数学错题本） |
| description | TEXT |  | 错题本描述 |
| exam_paper_id | UUID | FOREIGN KEY (exam_papers.id) | 关联的试卷ID（如果是从特定试卷生成） |
| generated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 生成时间 |
| question_count | INTEGER | NOT NULL, CHECK (question_count >= 0) | 错题本中的题目数量 |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('DRAFT', 'GENERATED', 'EXPORTED')), DEFAULT 'DRAFT' | 错题本状态 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 学生ID索引 (student_id)
- 生成时间索引 (generated_at)
- 状态索引 (status)
- 试卷ID索引 (exam_paper_id)

### 2.14 错题本题目关系表 (error_notebook_questions)
错题本中包含的具体错题和对应的强化练习题。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 关系唯一标识 |
| error_notebook_id | UUID | NOT NULL, FOREIGN KEY (error_notebooks.id) | 错题本ID |
| original_question_id | UUID | NOT NULL, FOREIGN KEY (questions.id) | 原错题ID |
| practice_question_id | UUID | FOREIGN KEY (questions.id) | 对应的强化练习题ID（可为空） |
| error_type | VARCHAR(50) |  | 错误类型（概念错误、计算错误等） |
| explanation | TEXT |  | 错误原因说明 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |

索引：
- 主键索引 (id)
- 错题本ID索引 (error_notebook_id)
- 原错题ID索引 (original_question_id)
- 强化练习题ID索引 (practice_question_id)
- 唯一约束 (error_notebook_id, original_question_id) 防止重复添加同一错题

### 2.15 自学任务表 (self_study_tasks)
存储自学调度服务创建的自学任务。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 自学任务唯一标识 |
| title | VARCHAR(200) | NOT NULL | 任务标题 |
| description | TEXT |  | 任务描述 |
| task_type | VARCHAR(30) | NOT NULL, CHECK (task_type IN ('KNOWLEDGE_EXTRACTION', 'QUESTION_GENERATION', 'MODEL_TRAINING', 'DATA_SYNC')) | 任务类型 |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')), DEFAULT 'PENDING' | 任务状态 |
| priority | INTEGER | NOT NULL, CHECK (priority >= 1 AND priority <= 10), DEFAULT 5 | 优先级（1最高，10最低） |
| assigned_to | UUID | FOREIGN KEY (users.id) | 分配给的用户（如果是人工任务） |
| parameters | JSONB |  | 任务参数配置 |
| result_data | JSONB |  | 任务结果数据 |
| started_at | TIMESTAMP WITH TIME ZONE |  | 开始执行时间 |
| completed_at | TIMESTAMP WITH TIME ZONE |  | 完成时间 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 任务类型索引 (task_type)
- 状态索引 (status)
- 优先级索引 (priority)
- 开始时间索引 (started_at)
- 完成时间索引 (completed_at)
- 分配用户索引 (assigned_to)

### 2.16 知识点建模表 (knowledge_point_models)
存储从爬取内容中提取的知识点建模结果。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 知识点模型唯一标识 |
| source_url | VARCHAR(500) | NOT NULL | 爬取来源URL |
| source_title | VARCHAR(200) |  | 来源标题 |
| content_hash | VARCHAR(64) | NOT NULL | 内容哈希（用于去重） |
| extracted_knowledge_points | JSONB | NOT NULL | 提取的知识点列表 |
| confidence_score | DECIMAL(5,4) |  | 提取置信度 |
| subject | VARCHAR(50) | NOT NULL | 所属学科 |
| grade_level | VARCHAR(20) |  | 适用年级 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 内容哈希索引 (content_hash) 用于去重检测
- 学科索引 (subject)
- 年级索引 (grade_level)
- 创建时间索引 (created_at)
- 置信度索引 (confidence_score)

### 2.17 模型管理表 (ml_models)
存储机器学习模型的版本和部署信息。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 模型唯一标识 |
| name | VARCHAR(100) | NOT NULL | 模型名称（如：qwen3-coder-grading） |
| version | VARCHAR(50) | NOT NULL | 模型版本 |
| model_type | VARCHAR(30) | NOT NULL, CHECK (model_type IN ('GRADING', 'OCR', 'QUESTION_GEN', 'KNOWLEDGE_EXT')) | 模型类型 |
| framework | VARCHAR(30) | NOT NULL | 使用的框架（如：vllm, ollama, huggingface） |
| storage_path | VARCHAR(500) | NOT NULL | 模型存储路径（在MinIO中的路径） |
| hash_sha256 | VARCHAR(64) | NOT NULL | 模型文件SHA256哈希（用于验证） |
| size_bytes | BIGINT | NOT NULL, CHECK (size_bytes > 0) | 模型文件大小 |
| is_active | BOOLEAN | NOT NULL, DEFAULT false | 是否当前激活使用的版本 |
| is_deprecated | BOOLEAN | NOT NULL, DEFAULT false | 是否已废弃 |
| performance_metrics | JSONB |  | 模型性能指标（准确率、延迟等） |
| created_by | UUID | NOT NULL, FOREIGN KEY (users.id) | 创建者 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |
| deployed_at | TIMESTAMP WITH TIME ZONE |  | 部署时间 |

索引：
- 主键索引 (id)
- 名称和版本唯一约束 (name, version)
- 模型类型索引 (model_type)
- 框架索引 (framework)
- 激活状态索引 (is_active)
- 类型和激活状态复合索引 (model_type, is_active) 用于快速查找当前激活的特定类型模型
- 创建时间索引 (created_at)

### 2.18 通知表 (notifications)
存储系统发送的通知记录。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UUID | PRIMARY KEY | 通知唯一标识 |
| recipient_id | UUID | NOT NULL, FOREIGN KEY (users.id) | 接收者用户ID |
| sender_id | UUID | FOREIGN KEY (users.id) | 发送者用户ID（如果适用） |
| notification_type | VARCHAR(30) | NOT NULL, CHECK (notification_type IN ('EXAM_REMINDER', 'GRADING_COMPLETE', 'ERROR_NOTEBOOK_READY', 'SYSTEM_UPDATE', 'WELCOME', 'PASSWORD_RESET')) | 通知类型 |
| title | VARCHAR(200) | NOT NULL | 通知标题 |
| content | TEXT | NOT NULL | 通知内容 |
| channel | VARCHAR(20) | NOT NULL, CHECK (channel IN ('EMAIL', 'WECHAT', 'DINGTALK', 'IN_APP')) | 发送渠道 |
| status | VARCHAR(20) | NOT NULL, CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'READ')), DEFAULT 'PENDING' | 发送状态 |
| related_entity_type | VARCHAR(30) |  | 关联实体类型（如：exam_paper, error_notebook） |
| related_entity_id | UUID |  | 关联实体ID |
| sent_at | TIMESTAMP WITH TIME ZONE |  | 实际发送时间 |
| read_at | TIMESTAMP WITH TIME ZONE |  | 读取时间 |
| expires_at | TIMESTAMP WITH TIME ZONE |  | 过期时间（如果适用） |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | 更新时间 |

索引：
- 主键索引 (id)
- 接收者ID索引 (recipient_id)
- 发送者ID索引 (sender_id)
- 通知类型索引 (notification_type)
- 渠道索引 (channel)
- 状态索引 (status)
- 关联实体类型和ID复合索引 (related_entity_type, related_entity_id)
- 发送时间索引 (sent_at)
- 读取时间索引 (read_at)
- 过期时间索引 (expires_at)
- 创建时间索引 (created_at)

## 3. 数据库分区策略

对于预计会变得非常大的表，考虑使用分区来提高查询性能和管理便利性：

### 3.1 答案提交表 (answer_submissions) 分区
按月份分区，因为答案提交具有明显的时间特征，且经常需要查询某段时间内的提交。

```sql
-- 创建分区表
CREATE TABLE answer_submissions_2026_05 PARTITION OF answer_submissions
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE answer_submissions_2026_06 PARTITION OF answer_submissions
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- 以此类推...
```

或者使用PostgreSQL的声明分区：
```sql
CREATE TABLE answer_submissions (
    -- 字段定义同上
) PARTITION BY RANGE (submitted_at);
```

### 3.2 判卷记录表 (grading_records) 分区
同样按月份分区，因为判卷也具有时间特征。

### 3.3 OCR上传表 (ocr_uploads) 分区
按月份分区，OCR上传也具有时序性。

## 4. 索引策略

除了上面表格中提到的索引外，还考虑以下特殊索引：

### 4.1 覆盖索引
对于经常一起查询的列组合，创建覆盖索引以避免回表查询。

例如，对于查询学生的试卷答案和得分：
```sql
CREATE INDEX idx_answer_submissions_student_exam_score 
ON answer_submissions (student_id, exam_paper_id) 
INCLUDE (total_score, percentage, status, submitted_at);
```

### 4.2 部分索引
对于只查询特定状态的数据，创建部分索引以减小索引大小。

例如，只索引活跃的用户：
```sql
CREATE INDEX idx_users_active ON users (id) WHERE is_active = true;
```

### 4.3 表达式索引
对于JSONB字段中的特定键查询，创建表达式索引。

例如，按知识点代码查询题目：
```sql
CREATE INDEX idx_questions_meta_knowledge_points 
ON questions ((meta_data ->> 'knowledge_point_codes'));
```

## 5. 外键约束和级联操作

设计外键约束时考虑数据完整性和业务逻辑：

### 5.1 严格约束
- 用户删除时，禁止删除如果有关联的答案提交、试卷创建等（RESTRICT）
- 班级删除时，禁止删除如果有学生（RESTRICT）
- 题目删除时，禁止删除如果被试卷使用（RESTRICT）

### 5.2 级联约束
- 试卷删除时，级联删除试卷题目关系（CASCADE）
- 错题本删除时，级联删除错题本题目关系（CASCADE）
- 自学任务删除时，级联删除相关的知识点建模记录等（取决于具体业务）

### 5.3 置空约束
- 题目的创建用户删除时，将创建人设置为NULL（SET NULL）
- 知识点的父节点删除时，将子节点的父ID设置为NULL（SET NULL）

## 6. 数据库迁移计划

使用 Alembic 进行数据库版本控制和迁移管理。

### 6.1 初始化
```bash
# 安装Alembic
pip install alembic

# 初始化Alembic环境
alembic init alembic

# 配置alembic.ini中的数据库连接
# 修改env.py以支持自动生成
```

### 6.2 迁移流程
1. 修改SQLAlchemy模型
2. 运行 `alembic revision --autogenerate -m "描述"` 生成迁移脚本
3. 审查生成的迁移脚本，确保正确
4. 运行 `alembic upgrade head` 应用迁移
5. 在开发过程中频繁提交迁移脚本

### 6.3 迁移脚本示例
```python
"""初始数据库架构

Revision ID: 001
Revises: 
Create Date: 2026-05-16 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # 创建所有表
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(50), nullable=False, unique=True),
        sa.Column('email', sa.String(100), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('phone', sa.String(20)),
        sa.Column('avatar_url', sa.String(255)),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, default=sa.text('NOW()')),
        sa.Column('last_login_at', sa.DateTime(timezone=True)),
        sa.CheckConstraint("role IN ('STUDENT', 'TEACHER', 'ADMIN')", name='check_user_role')
    )
    
    # 创建其他表的代码...
    # 按照上面表格的顺序创建所有表
    
    # 创建索引
    op.create_index('idx_users_username', 'users', ['username'])
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_role', 'users', ['role'])
    op.create_index('idx_users_is_active', 'users', ['is_active'])
    
    # 创建其他索引...

def downgrade():
    # 按相反顺序删除所有表
    op.drop_table('notifications')
    op.drop_table('ml_models')
    # 按相反顺序删除所有表
    op.drop_table('users')
```

### 6.4 数据迁移策略
对于需要迁移现有数据的情况：
1. 编写数据迁移脚本（Python或SQL）
2. 在迁移过程中备份数据
3. 分阶段进行，先迁移不影响服务的表
4. 低峰期进行主要数据迁移
5. 迁移后验证数据完整性

## 7. 性能优化建议

### 7.1 查询优化
- 使用EXPLAIN ANALYZE分析慢查询
- 为经常一起查询的列创建复合索引
- 避免SELECT *，只选择需要的列
- 使用 LIMIT 和 OFFSET 进行分页（或更好的键值分页）

### 7.2 连接池配置
- 使用SQLAlchemy的连接池
- 根据并发量调整池大小
- 启用连接回收以防止连接泄漏

### 7.3 缓存策略
- 使用Redis缓存频繁访问的数据（如用户会话、热门试题）
- 对于判卷结果等计算密集型操作适用缓存
- 实施缓存失效策略（时间基础或事件基础）

### 7.4 监控和告警
- 监控数据库连接使用率
- 监控查询响应时间
- 监控磁盘使用率和连接数
- 设置慢查询日志阈值
- 监控复制延迟（如果使用主从架构）

## 8. 安全考虑

### 8.1 数据保护
- 在传输层使用SSL/TLS加密连接
- 在存储层考虑使用PostgreSQL TDE（透明数据加密）或列级加密存储敏感数据
- 定期备份数据并测试恢复流程
- 实施最小权限原则：数据库用户只拥有必要的权限

### 8.2 输入验证
- 在应用层进行严格的输入验证，防止SQL注入
- 使用参数化查询或ORM的安全特性
- 对用户输入进行长度、类型和范围验证

### 8.3 审计日志
- 启用PostgreSQL的审计功能或使用pg audit扩展
- 记录关键操作（如用户登录、权限更改、敏感数据访问）
- 定期审查审计日志

## 9. 备份和恢复策略

### 9.1 备份计划
- 每日完全备份
- 每小时增量备份（使用WAL归档）
- 将备份存储到异地位置（如对象存储MinIO）
- 定期测试备份恢复

### 9.2 恢复演练
- 每季度进行一次完整的灾难恢复演练
- 记录恢复时间目标（RTO）和恢复点目标（RPO）
- 优化恢复流程以减少停机时间

## 10. 实施时间表

| 阶段 | 工作内容 | 预计时间 | 里程碑 |
|------|----------|----------|---------|
| 第1周 | 基础表设计和创建（用户、班级、知识点、题目） | 3天 | 基础数据模型完成 |
| 第1周 | 关系表设计（班级学生、题目知识点、试卷题目） | 2天 | 关系模型完成 |
| 第2周 | 业务表设计（答案提交、OCR上传、判卷记录） | 3天 | 核心业务模型完成 |
| 第2周 | 辅助表设计（错题本、自学任务、模型管理、通知） | 2天 | 完整数据模型完成 |
| 第3周 | 索引设计和优化 | 2天 | 性能索引完成 |
| 第3周 | 分区策略制定 | 1天 | 分区方案完成 |
| 第3周 | 外键约束和级联操作设计 | 1天 | 数据完整性保障完成 |
| 第4周 | Alembic迁移环境搭建 | 2天 | 迁移工具就绪 |
| 第4周 | 初始迁移脚本生成和测试 | 2天 | 可重复部署流程 |
| 第4周 | 性能基准测试和优化 | 2天 | 系统性能验证 |
| 第4周 | 安全审计和备份策略制定 | 1天 | 安全和可靠性保障 |

总预计时间：4周（20个工作日）

## 11. 验收标准

1. 所有必需的表格按照设计创建完成
2. 所有索引按照性能需求创建完成
3. 外键约束正确设置，确保数据参照完整性
4. Alembic迁移能够在干净的数据库上成功执行
5. 性能基准测试达到预期目标（简单查询<100ms，复杂报表查询<2s）
6. 安全扫描未发现高危漏洞
7. 备份和恢复流程经过测试验证有效

## 12. 相关文件

- 后端API设计计划：docs/backend-api-plan.md
- 前端组件开发计划：docs/frontend-component-plan.md（假设存在）
- 系统架构说明：CLAUDE.md 第119-154节
- 开发指南数据库设计部分：CLAUDE.md 第186-190节