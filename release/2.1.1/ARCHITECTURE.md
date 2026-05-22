# 系统架构说明

## 整体架构

```
┌──────────────────────────────────────────────────┐
│  浏览器 (React 18 + Ant Design + TypeScript)     │
│  localhost:3000                                   │
│  ├─ 认证 (LoginPage)                              │
│  ├─ 试题管理 (QuestionListPage/EditModal/Import)  │
│  ├─ 试卷管理 (PaperListPage/EditModal/Preview)    │
│  ├─ 在线作答 (SubmissionPage)                     │
│  ├─ 错题本 (MistakeBookPage)                      │
│  ├─ 班级管理 (TeacherClassesPage)                 │
│  ├─ 题库管理中心 (QuestionAdminPage)              │
│  └─ 知识树管理 (KnowledgeTreePage)                │
└──────────────────┬───────────────────────────────┘
                   │ HTTP/HTTPS (Vite proxy → :8000)
┌──────────────────▼───────────────────────────────┐
│  FastAPI (Python 3.12)                           │
│  localhost:8000                                   │
│  ├─ /api/v1/auth/*       认证服务                │
│  ├─ /api/v1/users/*      用户服务                │
│  ├─ /api/v1/questions/*  试题服务                │
│  ├─ /api/v1/exam-papers/*试卷服务                │
│  ├─ /api/v1/answers/*    答案服务 (→自动判卷)    │
│  ├─ /api/v1/grading/*    判卷服务                │
│  ├─ /api/v1/ocr/*        OCR服务                 │
│  ├─ /api/v1/error-notebooks/* 错题本服务         │
│  ├─ /api/v1/question-admin/*  [V2.1] 题库管理    │
│  └─ /api/v1/knowledge-tree/*  [V2.1.1] 知识树    │
└──────────────────┬───────────────────────────────┘
                   │ SQLAlchemy ORM (异步)
┌──────────────────▼───────────────────────────────┐
│  SQLite (开发) / PostgreSQL (生产)                │
│  edu_system.db                                    │
│  ├─ 18 张数据表                                   │
│  └─ Alembic 版本管理                              │
└──────────────────────────────────────────────────┘
```

## 核心数据流

### 判卷闭环 (V2.0)
```
教师出题 → 组卷 → 发布 → 学生作答 → 提交
  → 自动判卷(规则引擎) → 分数反馈 → 错题收集
  → 错题本生成 → 知识点匹配 → 强化练习
```

### 题库管理 (V2.1)
```
管理员配置LLM → 创建考纲 → 提取知识点
  → LLM生成试题 → 预览/修改 → 审核
  → 转为正式试题 (或驳回)
  
网络抓取 → 异步任务 → 存入预备试题 → 审核 → 正式试题
学生OCR上传 → 存入预备试题 → 审核 → 正式试题
```

### 知识树版本化 (V2.1.1)
```
考纲 v1 → 知识节点树(AREA→POINT)
  ↓ 修改父节点
考纲 v1 → 父节点变更 → 子节点自动失效(PARENT_MODIFIED)
  ↓ 分支恢复/修改/删除
考纲 v1 → 调整后的树
  ↓ 创建新版本
考纲 v2 → 仅复制 active 节点 → 新版本的干净树
```

## 模块依赖

```
core/ (config, security)
  └── db/ (base, session)
        └── models/ (18 models)
              └── schemas/ (Pydantic)
                    └── services/ (business logic)
                          └── api/v1/endpoints/ (110 endpoints)
```

## 安全模型

| 角色 | 权限范围 |
|------|----------|
| STUDENT | 仅自己的答案、错题本 |
| TEACHER | 自己创建的试题/试卷、班级管理 |
| QUESTION_ADMIN | 题库管理、考纲、知识树、审核 |
| ADMIN | 全部权限 |

- 认证: JWT (access 60min + refresh 30day)
- 密码: bcrypt 加盐哈希
- RBAC: `require_role()` 中间件
