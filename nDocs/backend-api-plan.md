# 后端 API 设计文档

> 版本: V3.2 | 日期: 2026-05-26 | 状态: 与代码同步

---

## 1. 概述

本系统采用 FastAPI 构建 RESTful API，所有端点以 `/api/v1` 为前缀。
响应格式: `{code, message, data}`（由 `ApiResponseMiddleware` 统一包装，待接入）。

当前已注册 **20 个路由模块**，覆盖认证、题目、试卷、作答、判卷、错题本、OCR、通知、统计、家长鼓励等全链路。

---

## 2. 路由模块清单

| 模块 | 前缀 | 端点数量 | 实现状态 | 说明 |
|------|------|----------|----------|------|
| Auth V2 | `/auth` | 6 | 完成 | 学生/管理员登录、注册、刷新、验证码 |
| LLM Config | `/admin/llm` | 3 | 完成 | Ollama 端点配置、模型测试 |
| Subjects | `/subjects` | 5 | 完成 | 学科 CRUD |
| Questions | `/questions` | 12 | 完成 | 题目 CRUD、搜索、典型题标记、LLM 讲解生成、批量讲解检查 |
| Question Admin | `/question-admin` | 10 | 完成 | LLM 生成、审核、去重、批量审批(待实现) |
| Knowledge Tree | `/knowledge-tree` | 6 | 部分 | 树 CRUD、版本回滚(部分实现) |
| Exam Papers | `/exam-papers` | 8 | 部分 | CRUD、我的试卷、导出(Word/PDF 空壳) |
| Answers | `/answers` | 5 | 完成 | 提交答案、自动判分、创建审计记录 |
| OCR | `/ocr` | 5 | 部分 | 上传、Tesseract 处理、状态查询；PaddleOCR 待集成 |
| Grading | `/grading` | 5 | 完成 | 判卷记录、结果查看 |
| Error Notebooks | `/error-notebooks` | 6 | 完成 | 错题本生成、查看、删除 |
| Self Study | `/self-study` | 5 | 占位 | 端点存在，核心逻辑未实现 |
| Classes | `/classes` | 7 | 完成 | 班级 CRUD、学生增删 |
| Teacher Stats | `/teacher/stats` | 4 | 完成 | 试卷统计、题目统计 |
| Student | `/student` | 3 | 完成 | 统计 + 学习进度追踪(time-series) |
| Database | `/database` | 2 | 完成 | 表结构内省(sys-admin 只读) |
| Reference | `/reference` | 8 | 完成 | 参考数据 CRUD(题型、难度、年级、省份等) |
| Notifications | `/notifications` | 5 | 完成 | 列表、已读、未读数、删除 |
| Parent | `/parent` + `/encouragements` | 17 | 完成 | 家长注册/登录、亲子关联、鼓励消息、奖励目标、庆祝里程碑 |
| Teacher Interaction | `/teacher/interaction` | 2 | 完成 | 教师评语、班级通知(触达学生+家长) |
| Topic Board | `/topic-board` | 6 | 完成 | 讲题板 CRUD + 按题目查询 + 更新(PUT) |
| Recommendations | `/recommendations` | 5 | 完成 | 题目推荐 CRUD + 学生列表 + 教师推荐管理 |

**总计: ~133 个端点**

---

## 3. 核心模块详情

### 3.1 认证 (Auth V2)

采用 2 步验证流程：
1. 用户名/密码 + 图形验证码 → 获取 `captcha_token`
2. SMS 验证码(开发环境固定 `111111`) → 获取 JWT `access_token` + `refresh_token`

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| POST | `/auth/captcha` | 获取图形验证码(SVG) | 公开 |
| POST | `/auth/student/login` | 学生登录 | 学生 |
| POST | `/auth/student/register` | 学生注册 | 公开 |
| POST | `/auth/admin/login` | 管理员登录 | 管理员/教师 |
| POST | `/auth/refresh` | 刷新 access_token | 需 refresh_token |
| POST | `/auth/logout` | 登出(黑名单) | 需认证 |

JWT payload: `{sub: user_id, type: STUDENT|TEACHER|QUESTION_ADMIN|SYS_ADMIN, exp, iat}`

### 3.2 题目 (Questions)

| 方法 | 路径 | 功能 |
|------|------|------|
| GET/POST | `/questions` | 列表/创建 |
| GET/PUT/DELETE | `/questions/{id}` | 详情/更新/删除 |
| GET | `/questions/search` | 高级搜索(支持分页、筛选) |
| PUT | `/questions/{id}/typical` | 切换重点题标志 |
| GET | `/questions/typical` | 重点题列表(含 has_explanation) |
| POST | `/questions/generate-explanation` | LLM 生成讲解步骤 |
| GET | `/questions/has-explanations` | 批量检查讲解状态 |

答案存储格式(JSONB `correct_answer`):
- 单选: `{"options": [...], "correct_answer": "A"}`
- 多选: `{"options": [...], "correct_answer": ["A","C"]}`
- 填空: `{"options": null, "correct_answer": ["答案1", "答案2"]}`
- 主观: `{"options": null, "correct_answer": {"keywords": [...], "max_score": 10}}`

### 3.3 试卷 (Exam Papers)

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET/POST | `/exam-papers` | 列表/创建 | 完成 |
| GET/PUT/DELETE | `/exam-papers/{id}` | 详情/更新/删除 | 完成 |
| GET | `/exam-papers/my` | 学生自己的试卷 | 完成 |
| POST | `/exam-papers/{id}/export` | 导出 Word/PDF | **空壳** |

`grade_level` 字段(JSONB) 结构:
```json
{ "scope": "comprehensive|grade_comprehensive|chapter|knowledge_point",
  "grades": ["G7","G8"],
  "chapter": "二次函数",
  "knowledge_points": ["知识点1"] }
```

### 3.4 作答与判卷 (Answers + Grading)

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/answers` | 提交答案 → 自动判分 → 创建 GradingRecord |
| GET | `/answers/{id}` | 获取作答详情 |
| GET | `/answers/submission/{id}` | 获取提交记录 |
| GET | `/grading/{id}` | 判卷结果详情 |
| GET | `/grading/records` | 判卷历史列表 |

判卷引擎 (`judge_engine.py`):
- 单选: 精确匹配
- 多选: `overlap_count / total_correct_count * max_score`
- 填空: `matched_count / total_blank_count * max_score`
- 主观: 关键词匹配，按 80%/40% 阈值分级得分

**待修复**: 多选题存在二次缩放 Bug，得分计算错误。

### 3.5 OCR

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/ocr/upload` | 上传图片 → Tesseract 处理 | 完成(阶段 A) |
| GET | `/ocr/status/{id}` | 查询处理状态 | 完成 |
| GET | `/ocr/result/{id}` | 获取识别结果 | 完成 |
| GET | `/ocr/config` | 获取 OCR 配置 | 完成 |

状态流转: `PENDING → PROCESSING → COMPLETED | FAILED | NEEDS_REVIEW`

**待实现**: PaddleOCR GPU 加速(V3.1)。

### 3.6 通知 (Notifications)

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/notifications` | 当前用户通知列表 |
| POST | `/notifications/{id}/read` | 标记单条已读 |
| POST | `/notifications/read-all` | 标记全部已读 |
| DELETE | `/notifications/{id}` | 删除通知 |
| GET | `/notifications/count/unread` | 未读数 |

触发时机:
- 判分完成 → 通知学生
- 错题本生成完成 → 通知学生

**待实现**: 试卷发布 → 通知班级学生；WebSocket 实时推送(V3.1)。

### 3.7 数据库管理 (Database)

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| GET | `/database/tables` | 表列表(行数/大小) | SYS_ADMIN |
| GET | `/database/tables/{name}` | 表详情(列/约束/索引) | SYS_ADMIN |

**待实现**: 前端 DatabaseManagementPage。

### 3.8 家长鼓励 (Parent Encouragement)

家长作为"鼓励者"角色，可发送鼓励消息、设置奖励目标、庆祝里程碑、查看正面趋势数据。
家长注册采用手机号+短信验证码自助注册，通过学生生成的邀请码建立亲子关联。

#### 认证 (Auth)

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| POST | `/auth/parent/register` | 家长注册(手机号+短信) | 公开 |
| POST | `/auth/parent/login` | 家长登录(手机号+短信) | 公开 |

JWT payload 新增: `type: PARENT`

#### 亲子关联 (Link)

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| POST | `/parent/link-student` | 通过邀请码关联学生 | PARENT |
| DELETE | `/parent/unlink-student/{student_id}` | 解除亲子关联 | PARENT |

#### 数据查看 (Data)

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| GET | `/parent/children` | 获取已关联的学生列表 | PARENT |
| GET | `/parent/child/{id}/positive-stats` | 正面统计数据(进步/坚持/完成，无分数) | PARENT |
| GET | `/parent/celebration-opportunities` | 可庆祝的里程碑机会 | PARENT |

#### 鼓励消息 (Encouragements)

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| POST | `/parent/encouragements` | 发送鼓励消息(模板/自定义/庆祝型) | PARENT |
| GET | `/parent/encouragements` | 已发送的鼓励列表 | PARENT |
| GET | `/encouragements/received` | 收到的鼓励列表 | STUDENT |
| POST | `/encouragements/{id}/read` | 标记鼓励已读 | STUDENT |

#### 奖励目标 (Rewards)

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| POST | `/parent/reward-goals` | 创建奖励目标 | PARENT |
| GET | `/parent/reward-goals` | 奖励目标列表(含进度) | PARENT |
| PUT | `/parent/reward-goals/{id}` | 更新奖励目标 | PARENT |
| POST | `/parent/reward-goals/{id}/claim` | 确认奖励已兑现 | PARENT |

#### 模板 (Templates)

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| GET | `/parent/encouragement-templates` | 获取鼓励模板列表 | PARENT |

#### 邀请码 (Invite Code)

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| POST | `/students/generate-invite-code` | 生成6位邀请码(有效期7天) | STUDENT |

### 3.9 讲题板 (Topic Board)

讲题板从独立页面重构为嵌入式 Drawer 组件。教师标记重点题时 LLM 自动生成讲解步骤，教师审核后保存。

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| GET | `/topic-board` | 讲解列表(分页、按主题筛选) | 所有已登录用户 |
| GET | `/topic-board/by-question/{question_id}` | 按题目ID查讲解 | 所有已登录用户 |
| GET | `/topic-board/{session_id}` | 讲解详情(含步骤) | 所有已登录用户 |
| POST | `/topic-board` | 创建讲解(含步骤) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| PUT | `/topic-board/{session_id}` | 更新讲解(删旧步骤+建新步骤) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| DELETE | `/topic-board/{session_id}` | 软删除讲解 | TEACHER / QUESTION_ADMIN / SYS_ADMIN |

**题目讲解增强:**

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| GET | `/questions/typical` | 重点题列表(含 has_explanation) | 所有已登录用户 |
| POST | `/questions/generate-explanation` | LLM 生成讲解步骤(不保存) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| PUT | `/questions/{id}/typical` | 切换重点题(关闭时删除关联讲解) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| GET | `/questions/has-explanations?ids=...` | 批量检查讲解状态 | 所有已登录用户 |

### 3.10 题目推荐 (Recommendations)

教师为特定学生推荐题目，学生在"试题讲解"页的"推荐题"Tab 中查看。

| 方法 | 路径 | 功能 | 角色 |
|------|------|------|------|
| POST | `/recommendations` | 创建推荐(支持多学生) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| DELETE | `/recommendations/{id}` | 删除推荐 | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| GET | `/recommendations/my` | 学生获取被推荐题目(含 has_explanation) | STUDENT |
| GET | `/recommendations/by-question/{question_id}` | 查看某题推荐学生列表 | TEACHER / QUESTION_ADMIN / SYS_ADMIN |

---

## 4. 通用规范

### 4.1 分页参数

```python
class PaginationParams(BaseModel):
    skip: int = 0
    limit: int = 20  # 默认 20，上限 200，超过返回 400
```

### 4.2 权限依赖

```python
# 统一使用 user_type
require_role("TEACHER", "QUESTION_ADMIN")
require_role("SYS_ADMIN")
```

### 4.3 事务模式

```python
async with db.begin():
    # 多表写入操作
```

---

## 5. Pydantic Schema 规范

以下模型应在后端 `app/schemas/` 中实现，用于严格校验核心 JSON 字段。

### 5.1 CorrectAnswer (题目答案)

```python
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union, Literal
import json

class OptionItem(BaseModel):
    label: str = Field(..., max_length=10)
    text: str = Field(..., max_length=500)

class SingleChoiceAnswer(BaseModel):
    options: List[OptionItem] = Field(..., min_length=2)
    correct_answer: str = Field(..., max_length=10)

class MultipleChoiceAnswer(BaseModel):
    options: List[OptionItem] = Field(..., min_length=2)
    correct_answer: List[str] = Field(..., min_length=1)

class FillBlankAnswer(BaseModel):
    options: None = None
    correct_answer: List[str] = Field(..., min_length=1)

class SubjectiveAnswerCorrect(BaseModel):
    keywords: List[str] = Field(..., min_length=1)
    max_score: float = Field(..., gt=0)

class SubjectiveAnswer(BaseModel):
    options: None = None
    correct_answer: SubjectiveAnswerCorrect

CorrectAnswerUnion = Union[
    SingleChoiceAnswer,
    MultipleChoiceAnswer,
    FillBlankAnswer,
    SubjectiveAnswer,
]
```

使用方式:
```python
class QuestionBase(BaseModel):
    correct_answer: Optional[Union[str, CorrectAnswerUnion]] = None

    @field_validator("correct_answer", mode="before")
    @classmethod
    def parse_json_string(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("correct_answer must be valid JSON")
        return v
```

### 5.2 GradeLevel (试卷/题目适用范围)

```python
class GradeLevel(BaseModel):
    scope: Literal["comprehensive", "grade_comprehensive", "chapter", "knowledge_point"]
    grades: List[str] = Field(..., min_length=1)
    chapter: Optional[str] = Field(None, max_length=100)
    knowledge_points: Optional[List[str]] = None

    @field_validator("chapter")
    @classmethod
    def check_chapter(cls, v, info):
        scope = info.data.get("scope")
        if scope in ("chapter", "knowledge_point") and not v:
            raise ValueError("chapter is required when scope is chapter or knowledge_point")
        return v

    @field_validator("knowledge_points")
    @classmethod
    def check_knowledge_points(cls, v, info):
        scope = info.data.get("scope")
        if scope == "knowledge_point" and not v:
            raise ValueError("knowledge_points is required when scope is knowledge_point")
        return v
```

使用方式:
```python
class ExamPaperBase(BaseModel):
    grade_level: Optional[GradeLevel] = None

class QuestionBase(BaseModel):
    grade_level: Optional[GradeLevel] = None
```

---

## 6. 状态对照

| 文档版本 | 端点数 | 与代码同步日期 |
|----------|--------|----------------|
| V1.0 | 68 | 2026-05-17 |
| V3.0 | ~100 | 2026-05-25 |
