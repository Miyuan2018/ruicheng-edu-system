# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

睿承教育平台 — a B/S platform implementing the "测验 → 整理错题 → 订正 → 加深训练" closed loop. Supports students, teachers, question-admins, and sys-admins with online question authoring, answer submission (online or photo upload), auto-grading, mistake notebook generation, and LLM-powered question generation via Ollama.

Current version: **V2.4** (16 API endpoint modules, 25 models, ~8,300 lines Python, ~7,800 lines TSX/TS).

## Tech stack (actual)

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI 0.104.1, SQLAlchemy 2.0 (async), Alembic |
| Database | PostgreSQL 16 |
| Frontend | React 19.2, Vite 8, Ant Design 6.4, TypeScript 6.0, Zustand 5, React Router 7 |
| Auth | JWT (access 60min + refresh 30day), bcrypt, three user tables |
| LLM | Ollama API (`/api/generate`), configurable model endpoint |
| Container | Docker Compose (backend + frontend services) |

Note: Redis, Celery, PaddleOCR, vLLM, MinIO, Kubernetes, Airflow, and MLflow exist in requirements docs but are **not yet implemented**.

## Commands

### Quick start (recommended)
```bash
./start.sh          # Creates conda env, migrates DB, seeds admin, starts backend(:8000) + frontend(:3000)
```

### Backend (manual)
```bash
cd backend
conda activate ~/conda_workspace   # or use: conda run -p ~/conda_workspace
pip install -r requirements.txt
alembic upgrade head                              # migrate DB
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pytest                                            # run tests
```

### Frontend (manual)
```bash
cd frontend
npm install
npm run dev          # Vite dev server on :3000, proxies /api → localhost:8000
npm run build        # tsc -b && vite build
npm run lint         # ESLint
```

### Docker
```bash
docker-compose up -d   # backend :8000 + frontend :3000
```

### Database
```bash
cd backend
alembic upgrade head                           # apply migrations
alembic revision --autogenerate -m "description"  # create new migration
```

## Architecture

```
Browser (React + Ant Design, :3000)
  │  Vite proxy /api → localhost:8000
  │  Health: GET /health → {"status":"healthy"}
  ▼
FastAPI app (app/main.py)
  ├─ CORS middleware (allow all origins in dev)
  └─ api_router (/api/v1)
       ├─ /auth          — login, register, captcha, SMS
       ├─ /subjects      — subject CRUD
       ├─ /questions     — question CRUD with JSON adaptive answer format
       ├─ /question-admin — LLM question generation, syllabus, review pipeline, stats, batch-approve/reject
       ├─ /knowledge-tree — versioned knowledge node tree
       ├─ /exam-papers   — paper CRUD, /my (student's papers), export (Word/PDF), preview
       ├─ /answers       — answer submission → auto-grading → mistake book generation
       ├─ /grading       — grading results & review
       ├─ /ocr           — OCR upload (placeholder, PaddleOCR not integrated)
       ├─ /error-notebooks — mistake notebook generation
       ├─ /self-study    — self-study tasks (placeholder)
       ├─ /classes       — class management
       ├─ /teacher/stats — teacher statistics (paper & question)
       ├─ /reference     — reference data CRUD (question-types, difficulties, grade-levels, provinces, subjects, etc.)
       ├─ /database      — database table introspection & management (sys-admin only)
       └─ /admin/llm     — Ollama endpoint configuration
            │
            ▼
          AsyncSession → PostgreSQL
```

Note: `app/core/response.py` defines `ApiResponseMiddleware` (wraps `/api/*` in `{code, message, data}`) but it is **not wired** in `main.py` — endpoints return raw responses.

### Backend module layering
```
core/ (config, security, response middleware helpers)
  └── db/ (base, session — async engine + session factory)
        └── models/ (25 SQLAlchemy models)
              └── schemas/ (Pydantic request/response models)
                    └── services/ (judge_engine, llm_service, captcha, storage, config_service, mistake_service)
                          └── api/v1/endpoints/ (14 endpoint modules)
```

### User model (three separate tables, not one)
| Table | Role | Login入口 | Default account |
|-------|------|-----------|-----------------|
| `sys_admins` | System admin | /admin/login | SYSAdmin / SYSPass |
| `admins` (admin_type=0/1) | Teacher / Question admin | /admin/login | t01 / th0001, tk01 / tk0001 |
| `students` | Student | /login | Register via phone |

Auth flow: `app/core/security.py` — `get_current_user` dependency checks JWT `type` claim, queries the corresponding table, returns `CurrentUser(id, user_type)`. RBAC via `require_role(*roles)` dependency.

Login flow (auth_v2.py): 2-step process — (1) verify username/password + captcha, get `captcha_token` → (2) verify SMS code (dev: `111111`), receive JWT `access_token` + `refresh_token`. Student registration follows same SMS verification pattern.

### Grading engine (app/services/judge_engine.py)
Rule-based, no LLM dependency. Question types: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FILL_BLANK`, `SUBJECTIVE` (keyword matching). Answers stored as JSON in the `correct_answer` column — format varies by type:
- Single choice: `{"options": [...], "correct_answer": "A"}`
- Multiple choice: `{"options": [...], "correct_answer": ["A","C"]}`
- Fill blank: `{"options": null, "correct_answer": ["答案1", "答案2"]}`
- Subjective: `{"options": null, "correct_answer": {"keywords": [...], "max_score": 10}}`

### Frontend routing (src/router.tsx)
```
/login              — student login (public)
/admin/login        — admin/teacher login (public)
/dashboard          — role-based dashboard
/questions          — question list (teacher/admin)
/papers             — role-based: student → MyPapersPage, teacher/admin → PaperListPage
/my-papers          — student's own papers with answer/scan/mistake actions
/typical-questions  — typical question explanations (student)
/mistake-book       — mistake notebook (消灭错题)
/teacher/classes    — class management
/teacher/stats/paper    — paper statistics
/teacher/stats/question — question statistics
/admin/config       — system config (LLM, OCR, DB)
/admin/basic-config — reference data config (subjects, grades, app params)
/admin/sys-admin    — sys-admin management
/question-admin     — question admin center (LLM generation, review, scrape)
/syllabus           — syllabus + knowledge tree (tabs)
/profile            — user profile
/print-preview      — print preview (no auth required)
```

Student sidebar menu: 学习仪表盘 → 试题讲解 → 我的试卷 → 消灭错题

MyPapersPage actions per paper: 预览, 编辑, 打印, 在线答题, 拍照/扫描录入, 生成错题, 删除 (icon-only with Tooltip)

### API response format
`app/core/response.py` provides helpers for standardized responses, but they are NOT enforced automatically:
```json
{"code": 200, "message": "成功", "data": { ... }}
```
Error: `{"code": 4xx/5xx, "message": "...", "detail": "...", "data": null}`

### Configuration
- `backend/.env` — environment variables (DATABASE_TYPE, SECRET_KEY, etc.)
- `backend/sysconfig.json` — runtime config (LLM endpoint, subjects, export limits, reference data), read/written by `app/services/config_service.py`
- `app/core/config.py` — Pydantic Settings, reads env + .env file

## Key conventions
- All SQLAlchemy models use UUID primary keys (stored as String(36) or native UUID)
- Timestamps use `DateTime(timezone=True)` with `server_default=func.now()`
- Async database sessions throughout — use `AsyncSession` from `get_db` dependency
- Frontend API client (src/api/client.ts) — axios with automatic JWT refresh on 401, auto-unwraps `{code, data}` envelope
- Frontend state — Zustand store (src/store/auth.ts) for auth, local state for pages
- Backend conda environment path: `~/conda_workspace` (Python 3.12)
- Alembic uses PostgreSQL from `sysconfig.json` (env.py overrides alembic.ini SQLite default)
- `start.sh` runs `alembic upgrade head` before table creation, and `main.py` seeds reference data on startup
- Frontend pages use either JSX or `React.createElement` style — match the existing file's style
- All filter/search controls use `size="small"`, tables use `size="middle"`, action buttons use `type="link" size="small"`

## Recent schema additions (V2.4)
- `provinces` — reference table (黑龙江, 吉林, 辽宁, 上海, 江苏, 浙江)
- `subjects.code` — added code column (math, chinese, english, physics)
- `questions.is_typical` — boolean flag for marking typical questions (teachers use QuestionEditModal switch)
- Migrations: `002_add_provinces`, `003_add_is_typical`

## Known gotchas
- `AnswerSubmissionResponse.total_score` must be `Optional[float]` not `int` — grading engine returns floats
- `ExamPaperBase.grade_level` must be `Optional[dict]` not `str` — stored as JSONB
- Route order matters: `/exam-papers/my` must be defined before `/{exam_paper_id}` in FastAPI
- `DELETE /exam-papers/{id}` must delete child records first (FK constraints are NO ACTION)
- Question `correct_answer` JSON has two storage formats: wrapped `{"options":..., "correct_answer":...}` (LLM) and raw value (import)
