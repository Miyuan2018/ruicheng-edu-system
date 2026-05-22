# 睿承教育平台 — Release 2.1.1

**版本**: V2.1.1
**日期**: 2026-05-17
**状态**: 冒烟测试 27/27 通过

---

## 目录结构与文件说明

```
release/2.1.1/
│
├── README.md                          # 本文件 — 发布说明
├── RELEASE_MANIFEST.md                # 交付清单（每个文件的详细说明）
├── CHANGELOG.md                       # 版本变更历史
├── QUICKSTART.md                      # 5分钟快速启动指南
├── ARCHITECTURE.md                    # 系统架构说明
│
├── backend/                           # === 后端代码 ===
│   ├── requirements.txt               # Python 依赖列表
│   ├── Dockerfile                     # 后端容器镜像
│   ├── alembic.ini                    # 数据库迁移配置
│   ├── .env                           # 环境变量配置
│   │
│   ├── app/
│   │   ├── main.py                    # FastAPI 应用入口，CORS/路由注册
│   │   │
│   │   ├── core/
│   │   │   ├── config.py              # 全局配置（数据库/Redis/OCR）
│   │   │   └── security.py            # JWT认证/RBAC/密码哈希
│   │   │
│   │   ├── db/
│   │   │   ├── base.py                # SQLAlchemy Base/元数据
│   │   │   └── session.py             # 异步数据库会话管理
│   │   │
│   │   ├── models/                    # 数据库模型层（ORM）
│   │   │   ├── __init__.py            # 模型注册
│   │   │   ├── user.py                # 用户（STUDENT/TEACHER/QUESTION_ADMIN/ADMIN）
│   │   │   ├── question.py            # 试题（含审批状态/来源）
│   │   │   ├── exam_paper.py          # 试卷+试卷-题目关联
│   │   │   ├── answer_submission.py   # 答案提交
│   │   │   ├── answer_detail.py       # 每题答案详情
│   │   │   ├── grading_record.py      # 判卷记录
│   │   │   ├── error_notebook.py      # 错题本
│   │   │   ├── error_notebook_question.py  # 错题本-题目关联
│   │   │   ├── ocr_upload.py          # OCR上传记录
│   │   │   ├── school_class.py        # 班级
│   │   │   ├── knowledge_point.py     # 知识点
│   │   │   ├── knowledge_node.py      # [V2.1.1] 版本化知识树节点
│   │   │   ├── syllabus.py            # [V2.1] 考纲（含版本）
│   │   │   ├── llm_config.py          # [V2.1] 大模型配置
│   │   │   ├── question_task.py       # [V2.1] 异步任务（生成/抓取）
│   │   │   ├── notification.py        # 通知
│   │   │   ├── ml_model.py            # 模型管理（二期）
│   │   │   ├── self_study_task.py     # 自学任务（二期）
│   │   │   └── knowledge_point_model.py  # 知识点建模（二期）
│   │   │
│   │   ├── schemas/                   # Pydantic 请求/响应模型
│   │   │   ├── user.py                # 用户注册/登录/响应
│   │   │   ├── question.py            # 试题创建/更新/响应
│   │   │   ├── exam_paper.py          # 试卷创建/更新/响应
│   │   │   ├── answer.py              # 答案提交/响应
│   │   │   ├── grading.py             # 判卷记录
│   │   │   ├── error_notebook.py      # 错题本
│   │   │   ├── ocr.py                 # OCR上传
│   │   │   └── self_study.py          # 自学任务
│   │   │
│   │   ├── api/v1/
│   │   │   ├── api.py                 # 路由汇总注册
│   │   │   └── endpoints/             # API 端点实现
│   │   │       ├── auth.py            # 认证（注册/登录/刷新/登出）
│   │   │       ├── users.py           # 用户管理 CRUD
│   │   │       ├── questions.py       # 试题 CRUD/搜索/导入导出
│   │   │       ├── exam_papers.py     # 试卷 CRUD/组装/导出
│   │   │       ├── answers.py         # 答案提交 → 自动判卷 → 错题本
│   │   │       ├── grading.py         # 判卷服务（规则引擎触发）
│   │   │       ├── error_notebooks.py # 错题本生成/查询/导出
│   │   │       ├── ocr.py             # OCR上传/状态/结果
│   │   │       ├── question_admin.py  # [V2.1] 题库管理（考纲/生成/抓取/审核/去重）
│   │   │       ├── knowledge_tree.py  # [V2.1.1] 版本化知识树 API
│   │   │       └── self_study.py      # 自学调度（二期占位）
│   │   │
│   │   └── services/                  # 业务逻辑层
│   │       ├── judge_engine.py        # 规则匹配判卷引擎
│   │       ├── mistake_service.py     # 错题收集/知识点匹配/练习抽取
│   │       └── storage.py             # MinIO/本地文件存储
│   │
│   ├── alembic/                       # 数据库迁移
│   │   ├── env.py                     # Alembic 环境配置
│   │   └── versions/                  # 迁移脚本
│   │       ├── 001_initial_schema.py  # 初始表结构
│   │       ├── v2_1_question_admin.py # V2.1 新增表
│   │       └── v2_1_1_tree.py         # V2.1.1 知识树
│   │
│   └── tests/
│       └── smoke_test.py              # 冒烟测试套件（27项）
│
├── frontend/                          # === 前端代码 ===
│   ├── package.json                   # Node.js 依赖
│   ├── vite.config.ts                 # Vite 构建配置（含API代理）
│   ├── tsconfig.json                  # TypeScript 配置
│   ├── Dockerfile                     # 前端容器镜像
│   ├── index.html                     # HTML 入口
│   │
│   └── src/
│       ├── main.tsx                   # React 入口
│       ├── App.tsx                    # 根组件
│       ├── router.tsx                 # 路由配置（所有页面路由+权限守卫）
│       │
│       ├── api/
│       │   └── client.ts              # Axios 封装（JWT拦截/刷新）
│       │
│       ├── store/
│       │   └── auth.ts                # Zustand 认证状态管理
│       │
│       ├── components/
│       │   └── layout/
│       │       └── AppLayout.tsx       # 主布局（侧边栏+顶栏+角色菜单）
│       │
│       └── pages/
│           ├── auth/
│           │   └── LoginPage.tsx       # 登录/注册页
│           ├── dashboard/
│           │   └── DashboardPage.tsx   # 仪表盘
│           ├── questions/
│           │   ├── QuestionListPage.tsx    # 试题列表/搜索/过滤
│           │   ├── QuestionEditModal.tsx   # 试题编辑弹窗
│           │   └── BatchImportModal.tsx    # 批量导入弹窗
│           ├── papers/
│           │   ├── PaperListPage.tsx       # 试卷列表
│           │   ├── PaperEditModal.tsx      # 试卷编辑（基本信息+选题）
│           │   └── PaperPreviewDrawer.tsx  # 试卷预览抽屉
│           ├── submissions/
│           │   ├── SubmissionPage.tsx      # 在线答题（选择试卷→作答→提交→结果）
│           │   └── OcrUpload.tsx           # 拍照上传OCR
│           ├── mistake-book/
│           │   └── MistakeBookPage.tsx     # 错题本列表/生成/导出
│           ├── teacher/
│           │   ├── TeacherClassesPage.tsx  # 班级管理
│           │   └── TeacherStatsPage.tsx    # 答题统计
│           └── admin/
│               ├── AdminUsersPage.tsx      # 用户管理
│               ├── AdminConfigPage.tsx     # 系统配置
│               ├── QuestionAdminPage.tsx   # [V2.1] 题库管理中心
│               └── KnowledgeTreePage.tsx   # [V2.1.1] 知识树管理
│
├── docs/                              # === 设计文档 ===
│   ├── EDU_SYSTEM_REQUIREMENTS_V1.0   # 原始需求规格
│   ├── project-summary.md             # 项目总览与里程碑
│   ├── requirements-v2.0.md           # V2.0 需求分析
│   ├── requirements-v2.1.md           # V2.1 需求分析
│   ├── requirements-v2.1.1.md         # V2.1.1 需求分析（知识树版本化）
│   ├── backend-api-plan.md            # API 设计计划
│   ├── database-design.md             # 数据库设计
│   ├── frontend-component-plan.md     # 前端组件计划
│   ├── ocr-integration-plan.md        # OCR 集成计划
│   ├── grading-implementation-plan.md # 判卷服务计划
│   ├── error-notebook-design.md       # 错题本设计
│   └── self-study-scheduling-plan.md  # 自学调度规划
│
├── docker-compose.yml                 # Docker 开发环境
├── start.sh                           # 一键启动脚本
└── CLAUDE.md                          # 项目开发指引
```

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 后端框架 | FastAPI | 0.104 |
| ORM | SQLAlchemy | 2.0.23 |
| 数据库(开发) | SQLite | 3.51 |
| 数据库(生产) | PostgreSQL | - |
| 前端框架 | React | 18 |
| UI组件 | Ant Design | 5.x |
| 状态管理 | Zustand | - |
| 构建工具 | Vite | 8.x |
| 语言 | Python 3.12 / TypeScript 5.x |

## 核心功能矩阵

| 模块 | V1.0 | V2.0 | V2.1 | V2.1.1 |
|------|------|------|------|--------|
| 用户认证 | ✅ | ✅ | ✅ | ✅ |
| 试题CRUD | ✅ | ✅ | ✅ | ✅ |
| 试卷管理 | ✅ | ✅ | ✅ | ✅ |
| 在线作答 | ⚠️ | ✅ | ✅ | ✅ |
| 自动判卷 | ❌ | ✅ | ✅ | ✅ |
| 错题本 | ❌ | ✅ | ✅ | ✅ |
| 考纲管理 | - | - | ✅ | ✅ |
| LLM试题生成 | - | - | ✅ | ✅ |
| 试题审核 | - | - | ✅ | ✅ |
| 网络抓取 | - | - | ✅ | ✅ |
| 试题去重 | - | - | ✅ | ✅ |
| 知识树(版本化) | - | - | - | ✅ |
| 父子联动失效 | - | - | - | ✅ |
| 分支操作 | - | - | - | ✅ |

## API 端点统计

| 服务 | 端点数 |
|------|--------|
| Auth | 6 |
| Users | 8 |
| Questions | 11 |
| Exam Papers | 11 |
| Answers | 7 |
| OCR | 9 |
| Grading | 9 |
| Error Notebooks | 8 |
| Question Admin | 16 |
| Knowledge Tree | 10 |
| Self Study | 15 |
| **合计** | **110** |

## 快速启动

```bash
cd release/2.1.1
./start.sh
```

- 前端: http://localhost:3000
- API文档: http://localhost:8000/docs
- 默认账号: teacher@example.com / testpass123

## 测试

```bash
cd backend
conda run -n myenv python tests/smoke_test.py
# 预期: 27/27 passed, 0 failed
```

## 版本历史

| 版本 | 日期 | 关键变更 |
|------|------|----------|
| V1.0 | 2026-05-17 | 项目骨架、68 API、17表、20前端页面 |
| V2.0 | 2026-05-17 | 判卷引擎、错题本自动生成、OCR存储 |
| V2.1 | 2026-05-17 | 题库管理员、考纲、LLM生成、审核、去重 |
| V2.1.1 | 2026-05-17 | 版本化知识树、父子联动失效、分支操作 |
