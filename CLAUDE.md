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

Current version: **V2.2** (~110 API endpoints, 22 DB tables, 68 Python files, 37 TSX/TS files).

## Tech stack (actual)

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI 0.104.1, SQLAlchemy 2.0 (async), Alembic |
| Database | SQLite (dev) / PostgreSQL (prod), via `DATABASE_TYPE` env |
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
conda activate /home/zhanglijun/conda_workspace   # or use: conda run -p /home/zhanglijun/conda_workspace
pip install -r requirements.txt
alembic upgrade head                              # migrate DB
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pytest                                            # run tests
```

### Frontend (manual)
```bash
cd frontend
npm install
npm run dev          # Vite dev server on :3000, proxies /api → localhost:8001
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
  ▼
FastAPI app (app/main.py)
  ├─ CORS middleware (allow all origins in dev)
  └─ api_router (/api/v1)
       ├─ /auth          — login, register, captcha, SMS
       ├─ /subjects      — subject CRUD
       ├─ /questions     — question CRUD with JSON adaptive answer format
       ├─ /question-admin — LLM question generation, syllabus, review pipeline
       ├─ /knowledge-tree — versioned knowledge node tree
       ├─ /exam-papers   — 4-step paper creation wizard
       ├─ /answers       — answer submission → auto-grading
       ├─ /grading       — grading results & review
       ├─ /ocr           — OCR upload (placeholder, PaddleOCR not integrated)
       ├─ /error-notebooks — mistake notebook generation
       ├─ /self-study    — self-study tasks (placeholder)
       ├─ /classes       — class management
       ├─ /teacher/stats — teacher statistics (paper & question)
       └─ /admin/llm     — Ollama endpoint configuration
            │
            ▼
          AsyncSession → SQLite (edu_system.db) or PostgreSQL
```

Note: `app/core/response.py` defines `ApiResponseMiddleware` (wraps `/api/*` in `{code, message, data}`) but it is **not wired** in `main.py` — endpoints return raw responses.

### Backend module layering
```
core/ (config, security, response middleware helpers)
  └── db/ (base, session — async engine + session factory)
        └── models/ (22 SQLAlchemy models)
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
/dashboard          — student/teacher dashboard
/questions          — question list
/papers             — role-based: student → StudentPapersPage (3 tabs), teacher/admin → PaperListPage
/mistake-book       — mistake notebook with preview, practice generation, print
/teacher/classes    — class management
/teacher/stats/paper    — paper statistics
/teacher/stats/question — question statistics
/admin/users        — user management
/admin/config       — system config (LLM, subjects, export limits)
/admin/sys-admin    — sys-admin management
/question-admin     — question admin center (LLM generation, review)
/knowledge-tree     — knowledge tree management
/syllabus           — syllabus management
/profile            — user profile
/print-preview      — print preview (no auth required)
```

StudentPapersPage tabs:
- 在线作答 (OnlineAnswerTab) — top: pending papers + start answering, bottom: all papers with rowSelection → add to pending
- 拍照扫描 (PhotoScanTab) — upload/scan paper, AI recognition, view results with scores & mistakes
- 生成纸质错题练习本 (GenerateMistakeBookTab) — select paper → generate mistake practice book

### API response format
`app/core/response.py` provides helpers for standardized responses, but they are NOT enforced automatically:
```json
{"code": 200, "message": "成功", "data": { ... }}
```
Error: `{"code": 4xx/5xx, "message": "...", "detail": "...", "data": null}`

### Configuration
- `backend/.env` — environment variables (DATABASE_TYPE, SECRET_KEY, etc.)
- `backend/sysconfig.json` — runtime config (LLM endpoint, subjects, export limits), managed via `app/services/config_service.py`
- `app/core/config.py` — Pydantic Settings, reads env + .env file

## Key conventions
- All SQLAlchemy models use UUID primary keys (stored as String(36))
- Timestamps use `DateTime(timezone=True)` with `server_default=func.now()`
- Async database sessions throughout — use `AsyncSession` from `get_db` dependency
- Frontend API client (src/api/client.ts) — axios with automatic JWT refresh on 401
- Frontend state — Zustand store (src/store/auth.ts) for auth, local state for pages
- Backend conda environment path: `/home/zhanglijun/conda_workspace` (Python 3.12)
