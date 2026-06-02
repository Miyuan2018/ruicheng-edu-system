# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

**始终使用简体中文回复用户。** 所有对话、解释、代码注释默认使用中文。工具调用的 description 也使用中文。

## Behavioral guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.

### 3. Surgical Changes
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Remove imports/variables/functions that YOUR changes made unused.

### 4. Goal-Driven Execution
Transform tasks into verifiable goals. For multi-step tasks, state a brief plan with verification at each step.

---

## Project overview

睿承教育平台 — B/S 平台，实现"测验 → 整理错题 → 订正 → 加深训练"教学闭环。支持学生、教师、题库管理员、系统管理员和家长五种角色。

**技术栈**: FastAPI + PostgreSQL 16 + React 19 + Ant Design 6.4 + TypeScript + Zustand 5

### 文档层级

| 层级 | 位置 | 说明 |
|------|------|------|
| 执行层 | `nDocs/执行路线图.md` | 任务状态追踪，当前优先级 |
| 需求层 | `nDocs/requirements-v3.0.md` | 活文档，API/数据模型/安全/部署设计 |
| 设计层 | `nDocs/*.md` | API 端点、数据库表、前端组件详细设计 |
| 设计层 | `nDocs/paper-redesign-draft.md` | V3.51 组卷系统单元化改版设计 |
| 基线层 | `Raw_Customer_Requirements.md` | 只读，客户原始需求 |
| 历史 | `docs/` | 旧版需求文档，不再维护 |

**维护规则**: 代码变更后必须同步更新 nDocs/ 对应设计文档。

### Commands

```bash
# 后端
cd backend
conda activate ~/conda_workspace
pip install -r requirements.txt
alembic upgrade head                              # 数据库迁移
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
pytest                                            # 运行测试（3 个测试文件）
celery -A app.celery_app worker -Q default,llm --loglevel=info  # Celery Worker
python seed_v35.py                                # 种子数据（题目/试卷/知识树等）
python seed_encouragement_templates.py            # 种子数据（鼓励模板）
python seed_reference.py                          # 种子数据（参考数据）

# 前端
cd frontend
npm install
npm run dev          # Vite :3001, proxy /api → :8001
npm run build        # tsc -b && vite build
npm run lint         # ESLint

# Docker Compose
docker compose up -d                              # backend + frontend
docker compose --profile async up -d              # 含 Redis + Celery Worker
```

## Architecture

```
Browser (React 19 + Ant Design 6 + TypeScript, :3001)
  │  Vite proxy /api → localhost:8001
  │  WebSocket ws://localhost:8001/ws/notifications
  ▼
FastAPI app (app/main.py)
  ├─ ApiResponseMiddleware  — 统一包装 {code, message, data}
  ├─ CORS middleware
  └─ api_router (/api/v1)
       ├─ /auth          — login, register, captcha, SMS (含家长注册/登录)
       ├─ /subjects      — subject CRUD
       ├─ /questions     — question CRUD + search + typical + LLM 讲解生成
       ├─ /question-admin — LLM gen, scrape, review, batch-approve/reject, dedup (SimHash)
       ├─ /knowledge-tree — versioned tree (版本创建/回滚/级联失效)
       ├─ /exam-papers   — paper CRUD, export (Word/PDF), publish → notify
       ├─ /answers       — submit → auto-grade → audit record → 错题本 → 庆祝事件
       ├─ /grading       — grading records & audit
       ├─ /ocr           — Tesseract + PaddleOCR 双引擎, NEEDS_REVIEW 状态
       ├─ /error-notebooks — mistake notebook generation + 练习题抽取
       ├─ /self-study    — self-study tasks (后端完成, 前端完成)
       ├─ /classes       — class management
       ├─ /teacher/stats — teacher statistics + 互动评语/班级通知
       ├─ /student       — 学习进度追踪 (accuracy_trend + completion_activity + subject_performance)
       ├─ /parent        — 家长鼓励消息 + 奖励目标 + 庆祝里程碑 (17 端点)
       ├─ /topic-board   — 讲题板 (Drawer 嵌入式, LLM 自动生成步骤)
       ├─ /recommendations — 教师推荐题目给学生
       ├─ /notifications — app notifications + WebSocket 实时推送
       ├─ /reference     — reference data CRUD (8 类)
       ├─ /database      — table introspection (sys-admin 只读)
       └─ /admin/llm     — Ollama/DeepSeek config + 异步任务管理
            │
            ▼
     AsyncSession → PostgreSQL 16 + Redis + Celery
```

### Backend module layering
```
core/ (config, security, response middleware)
  └── db/ (base, session — async engine + session factory)
        └── models/ (33 SQLAlchemy models, PostgreSQL UUID PKs)
              └── schemas/ (Pydantic request/response models)
                    └── services/ (judge_engine, llm_service, ocr_service, notification_service,
                                   interaction_service, mistake_service, dedup_service, config_service)
                          └── api/v1/endpoints/ (23 endpoint modules)
                                └── tasks/ (llm_tasks)
```

### Key Services

| 服务 | 文件 | 功能 |
|------|------|------|
| JudgeEngine | `services/judge_engine.py` | 规则判分，无 LLM 依赖 |
| LLMService | `services/llm_service.py` | Ollama/DeepSeek 题目生成 + 讲解生成 |
| OCRService | `services/ocr_service.py` | Tesseract + PaddleOCR HTTP 双引擎路由 |
| NotificationService | `services/notification_service.py` | 11 种通知类型，触发推送 |
| InteractionService | `services/interaction_service.py` | 判分后自动触发: 庆祝检测 + 通知家长 + 更新奖励进度 |
| MistakeService | `services/mistake_service.py` | 错题收集 + 分类 + 练习题抽取 |
| DedupService | `services/dedup_service.py` | SimHash 文本指纹去重 |
| ConfigService | `services/config_service.py` | sysconfig.json + 环境变量读取 |

### Frontend layer

```
src/
├── api/client.ts       — axios 实例, 自动解包 {code, message, data}, 401 自动刷新 token
├── api/papers.ts       — 试卷 API (paperApi)
├── store/              — Zustand 5 stores
│   ├── auth.ts         — 认证状态 (token, user, login/logout)
│   ├── paperEditor.ts  — 试卷向导状态机 (最复杂, 含 units/questions/autoSave)
│   ├── notification.ts — 通知铃铛状态 (WebSocket 优先, 30s 轮询降级)
│   ├── useParentStore.ts     — 家长端状态
│   └── useTopicBoardStore.ts — 讲题板 Drawer 状态
├── types/paper.ts      — 试卷相关 TypeScript 类型定义
├── hooks/              — useExamTimer, useReferenceValues
├── components/         — layout/, notification/, topic-board/
├── pages/              — 按路由组织的页面组件
│   └── papers/         — 试卷向导 (5 步) + 列表/答题/完成页
│       └── steps/      — BasicInfoStep → StructureStep → RecommendStep → PreviewStep → FinalizeStep
└── router.tsx          — 前端路由配置
```

**试卷向导流程 (PaperWizardPage)**: 5 步顺序向导，状态由 `paperEditor.ts` (Zustand) 集中管理:
1. **BasicInfoStep** — 试卷名称、学科、年级、难度比值
2. **StructureStep** — 按题型分组设置单元，总分校验
3. **RecommendStep** — 推荐题目结果 + 换题 + 约束仪表盘
4. **PreviewStep** — 试卷预览 (含 PaperTemplatePreview)
5. **FinalizeStep** — 保存/发布

**API 客户端**: `api/client.ts` 拦截器自动处理:
- 请求注入 JWT Bearer token
- 响应自动解包 `{code, message, data}` → `data`
- 401 自动用 refresh_token 刷新，失败跳转登录页

### User models (4 张表)

| Table | Role | Login | Default account |
|-------|------|-------|-----------------|
| `sys_admins` | System admin | /admin/login | SYSAdmin / SYSPass |
| `admins` (admin_type=0/1) | Teacher / Question admin | /admin/login | th01 / th0001, tk01 / tk0001 |
| `students` | Student | /login | 手机号注册 |
| `parents` | Parent (鼓励者) | /parent/login | 手机号注册 + 学生邀请码关联 |

JWT payload: `{sub: user_id, type: STUDENT|TEACHER|QUESTION_ADMIN|SYS_ADMIN|PARENT}`

### 认证流程 (2-step SMS)
1. 用户名/密码 + 图形验证码 → 获取 verify_token
2. SMS 验证码 (开发环境固定 `111111`) → 获取 JWT access_token + refresh_token

### Grading engine
规则引擎，四种题型: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FILL_BLANK`, `SUBJECTIVE`
- 单选: 精确匹配 → 满分或 0
- 多选: `overlap / total_correct * max_score`
- 填空: `matched / total_blanks * max_score`
- 主观: 关键词匹配 80%/40% 阈值分级

答案 JSON 格式:
- 单选: `{"options": [{"label":"A","text":"..."}], "correct_answer": "A"}`
- 多选: `{"options": [...], "correct_answer": ["A","C"]}`
- 填空: `{"options": null, "correct_answer": ["答案1", "答案2"]}`
- 主观: `{"options": null, "correct_answer": {"keywords": [...], "max_score": 10}}`

### 数据库迁移

迁移文件使用顺序编号命名（非 alembic 默认的 hash 命名）:
- `001_v22_initial.py` — 初始 schema (V2.2)
- `002_v351_units.py` — V3.51 三层单元结构
- `003_cleanup_knowledge_tree.py` — 知识树清理
- `003_add_paper_difficulty.py` — 试卷难度比值字段

> 注意: 两个 `003_` 迁移各自独立于不同的表。创建新迁移时沿用此编号约定。

### Environment & Secrets
敏感配置通过 `backend/.env` 管理，不入 VCS:
```
SECRET_KEY=xxx
DATABASE_PASSWORD=xxx
DEEPSEEK_API_KEY=sk-xxx
```

非敏感配置在 `backend/sysconfig.json`，由 ConfigService 合并读取（环境变量优先）。

### Frontend routing (src/router.tsx)

| 路径 | 页面 | 角色 |
|------|------|------|
| `/login` | LoginPage | 公开 |
| `/parent/login` | ParentLoginPage | 公开 |
| `/admin/login` | AdminLoginPage | 公开 |
| `/dashboard` | DashboardPage (含进度图表+鼓励卡片) | 全部 |
| `/questions` | QuestionListPage (含推荐+讲解) | TEACHER/ADMIN |
| `/papers` | PaperListPage / MyPapersPage | 按角色 |
| `/my-papers` | MyPapersPage | STUDENT |
| `/typical-questions` | TypicalQuestionsPage (重点题+推荐题 Tab, Drawer 讲题板) | STUDENT |
| `/mistake-book` | MistakeBookPage (含讲解 Drawer) | STUDENT |
| `/self-study` | SelfStudyPage | STUDENT |
| `/topic-board` | TopicBoardPage | 全部 |
| `/teacher/classes` | TeacherClassesPage | TEACHER |
| `/teacher/stats/paper` | PaperStatsPage | TEACHER |
| `/teacher/stats/question` | QuestionStatsPage | TEACHER |
| `/teacher/recommendations` | RecommendationPage | TEACHER |
| `/admin/config` | AdminConfigPage (LLM/OCR/Celery) | SYS_ADMIN |
| `/admin/basic-config` | BasicConfigPage | SYS_ADMIN |
| `/admin/sys-admin` | SysAdminPage | SYS_ADMIN |
| `/question-admin` | QuestionAdminPage (含去重管理 Tab) | QUESTION_ADMIN |
| `/syllabus` | SyllabusPage + KnowledgeTreePage | TEACHER/ADMIN |
| `/parent/encourage` | ParentEncouragePage | PARENT |
| `/parent/reward-goals` | ParentRewardGoalsPage | PARENT |
| `/parent/celebrations` | ParentCelebrationsPage | PARENT |
| `/profile` | ProfilePage (含邀请码) | 全部 |
| `/print-preview` | PrintPreviewPage | 公开 |

### Notification system (11 种类型)
GRADING_COMPLETE, ERROR_NOTEBOOK_READY, EXAM_PUBLISHED, SYSTEM, ENCOURAGEMENT_RECEIVED, CELEBRATION_EVENT, REWARD_GOAL_UPDATE, TEACHER_FEEDBACK, CLASS_ANNOUNCEMENT 等

- REST: GET/POST/DELETE /notifications + 标记已读 + 未读数
- WebSocket: `ws://host:8001/ws/notifications?token=JWT` 实时推送
- 前端: NotificationBell 铃铛组件 (WebSocket 优先, 30s 轮询降级)

### 当前状态 (V3.5)

所有 P0/P1/P2 修复已完成，V3.0~V3.1 新功能全部实现。端到端可用模块:
认证、试题 CRUD、试卷管理、在线答题判分、错题本、班级管理、参考数据、LLM 题目生成、教师统计、系统管理、通知系统、题目去重(SimHash)、OCR(Tesseract+PaddleOCR)、Celery 异步任务、知识树版本化、试卷导出 Word/PDF、学生仪表盘、自学任务、数据库管理 UI、批量审批、家长端(鼓励者)、讲题板(Drawer+LLM)、题目推荐、学习进度可视化(Recharts)、WebSocket 实时推送。

技术债务: ESLint 0 错误, TypeScript 0 错误。长期基础设施 (MinIO, Airflow, MLflow, Redis 缓存层) 待实现。

详细实现状态和优先级见 `nDocs/执行路线图.md`。
