# 睿承教育平台 V3.5 正式发布说明

**发布日期:** 2026-05-27
**版本号:** V3.5
**代号:** 正式发布版

---

## 一、版本概述

V3.5 是睿承教育平台的正式发布版本，实现了完整的"测验 → 整理错题 → 订正 → 加深训练"教学闭环。平台支持学生、教师、题库管理员、系统管理员和家长五种角色，覆盖 K12 教育的主要教学场景。

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | FastAPI (Python 3.12) |
| 数据库 | PostgreSQL 16 + Redis |
| 异步任务 | Celery |
| 前端框架 | React 19 + TypeScript |
| UI 组件库 | Ant Design 6.4 |
| 状态管理 | Zustand 5 |
| 构建工具 | Vite |

---

## 二、核心功能模块

### 认证系统
- 多角色登录（学生/教师/题库管理员/系统管理员/家长）
- 双重认证（图形验证码 + SMS 短信验证码）
- JWT Token 认证 + Refresh Token 刷新
- 邀请码机制（家长通过学生邀请码关联）

### 题库管理
- 四种题型：单选、多选、填空、解答
- 题目 CRUD + 批量审批
- LLM 智能题目生成（Ollama/DeepSeek）
- OCR 题目识别（Tesseract + PaddleOCR 双引擎）
- SimHash 文本指纹去重
- 题目爬取采集（Web Scrape）
- 典型题标记与重点题管理

### 试卷管理
- 试卷 CRUD + 题目自由组卷
- Word/PDF 试卷导出
- 试卷发布（自动通知关联学生）
- 在线答题 + 自动批改

### 智能判分
- 规则引擎判分，无 LLM 依赖
- 单选：精确匹配 → 满分/0
- 多选：overlap / total_correct × max_score
- 填空：matched / total_blanks × max_score
- 主观：关键词匹配 80%/40% 阈值分级

### 错题本
- 自动收集错题
- 按知识点分类
- 错因分析（概念错误/计算错误/理解偏差/记忆错误/未作答）
- 推荐同类练习题

### 学习进度追踪
- 正确率趋势图（Recharts）
- 每日完成活动热力图
- 各科成绩分布
- 学习连续打卡

### 家长端
- 鼓励消息发送（5 种模板 + 自定义）
- 奖励目标设定与进度追踪
- 学习里程碑庆祝
- 成绩实时通知

### 讲题板 (Topic Board)
- Drawer 嵌入式交互讲解
- LLM 自动生成分步讲解
- 熊猫角色动画（idle/thinking/explaining/satisfied）
- 板书实时展示

### 知识树
- 版本化课纲管理
- 知识点树形结构
- 版本回滚 + 级联失效
- 按地区/年级/科目筛选

### 通知系统
- 11 种通知类型
- WebSocket 实时推送
- 30s 轮询降级
- 通知铃铛组件（未读计数）

### 教师工具
- 班级管理 + 学生管理
- 试卷/题目统计数据
- 互动评语 + 班级通知
- 题目推荐（定向推送给学生）

---

## 三、新增内容（相比 V3.0）

### V3.1
- 家长端完整功能（鼓励者角色）
- 讲题板（Drawer + LLM 自动讲解）
- 题目推荐系统
- 学习进度可视化（Recharts 图表）
- WebSocket 实时通知

### V3.5
- 完整的演示数据系统（80 道题目/6 份试卷/12 条答题记录/5 本错题本）
- 一键部署脚本（环境检查/自动安装/服务启动）
- 物理科目支持
- 知识点模型（Knowledge Point Model / ML Model）
- 鼓励消息模板系统
- 奖励目标追踪
- 学习庆典事件
- 多家长-学生关联
- 数据库兼容性修复
- 性能优化

---

## 四、快速开始

### 方式一：一键部署（推荐）

```bash
# 克隆项目后
chmod +x deploy-v35.sh
./deploy-v35.sh -y        # 自动部署
./deploy-v35.sh -y -d     # 自动部署 + 重建数据库
./deploy-v35.sh --docker  # Docker Compose 部署
```

### 方式二：Docker Compose

```bash
docker compose up -d
docker compose exec backend python seed_v35.py --force
```

### 方式三：手动部署

```bash
# 后端
cd backend
conda create -p ~/conda_workspace python=3.12 -y
conda activate ~/conda_workspace
pip install -r requirements.txt
cp .env.example .env    # 编辑配置
alembic upgrade head
python seed_v35.py --force
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 前端
cd frontend
npm install
npm run dev
```

---

## 五、演示数据

`backend/seed_v35.py` 提供全面的演示数据：

| 数据类别 | 数量 | 说明 |
|----------|------|------|
| 参考数据表 | 7 类 | 题型/难度/年级/状态/错因/来源/省份 |
| 科目 | 6 科 | 数学/语文/英语/物理/化学/生物 |
| 用户 | 18 人 | 1 管理员 + 5 教师 + 8 学生 + 4 家长 |
| 班级 | 5 个 | 跨 G7-G9，覆盖 4 科目 |
| 课纲 | 4 份 | 含 20+ 知识点节点 |
| 试题 | 80 道 | 单选 35 / 多选 10 / 填空 15 / 解答 20 |
| 试卷 | 6 份 | 期中/期末/单元测/模拟卷 |
| 答题记录 | 12 条 | 含答题明细 + 评分记录 |
| 错题本 | 5 本 | 含错题条目 + 推荐练习题 |
| 自学任务 | 8 条 | 已完成/进行中/待开始 |
| 通知 | 10 条 | 含已读/未读 |
| 家长模块 | 完整 | 鼓励/庆典/奖励目标 |
| 讲解板 | 5 个 | 含分步动画 |
| 推荐 | 8 条 | 教师→学生 |

### 演示账号速查

| 角色 | 用户名 | 密码 | 姓名 |
|------|--------|------|------|
| 系统管理员 | SYSAdmin | SYSPass | 系统管理员 |
| 数学教师 | t_math | Demo1234 | 王数学 |
| 语文教师 | t_chinese | Demo1234 | 李语文 |
| 英语教师 | t_english | Demo1234 | 张英语 |
| 物理教师 | t_physics | Demo1234 | 赵物理 |
| 题库管理员 | tk_qian | Demo1234 | 钱题库 |
| 学生 (G8) | zhang_ming | Demo1234 | 张明 |
| 学生 (G8) | li_hua | Demo1234 | 李华 |
| 学生 (G7) | wang_fang | Demo1234 | 王芳 |
| 学生 (G9) | chen_qiang | Demo1234 | 陈强 |
| 学生 (G8) | liu_li | Demo1234 | 刘丽 |
| 学生 (G7) | zhao_gang | Demo1234 | 赵刚 |
| 学生 (G9) | sun_yue | Demo1234 | 孙悦 |
| 学生 (G8) | zhou_jie | Demo1234 | 周杰 |
| 家长 | p_zhang_fu | Demo1234 | 张国华 |
| 家长 | p_li_mu | Demo1234 | 陈晓燕 |
| 家长 | p_wang_mu | Demo1234 | 刘淑芳 |
| 家长 | p_chen_fu | Demo1234 | 陈建国 |

---

## 六、项目结构

```
ruicheng-edu-system/
├── deploy-v35.sh              # 一键部署脚本
├── docker-compose.yml         # Docker Compose 配置
├── start.sh                   # 开发环境快速启动脚本
├── CLAUDE.md                  # Claude Code 项目指南
├── nDocs/                     # 设计文档
│   ├── 执行路线图.md
│   └── requirements-v3.0.md
├── backend/
│   ├── seed_v35.py            # V3.5 演示数据脚本（全新）
│   ├── demo_data.py           # 旧版演示数据（保留兼容）
│   ├── seed_reference.py      # 参考数据启动时自动种入
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── sysconfig.json
│   ├── .env.example
│   ├── alembic/               # 数据库迁移
│   ├── app/
│   │   ├── main.py            # FastAPI 入口
│   │   ├── api/v1/endpoints/  # 23 个端点模块
│   │   ├── models/            # 34 个 SQLAlchemy 模型
│   │   ├── schemas/           # Pydantic 模型
│   │   ├── services/          # 8 个核心服务
│   │   └── tasks/             # Celery 异步任务
│   └── tests/
└── frontend/
    ├── src/
    │   ├── router.tsx         # 路由配置
    │   ├── pages/             # 页面组件
    │   ├── components/        # 通用组件
    │   ├── stores/            # Zustand 状态
    │   └── api/               # API 客户端
    ├── tests/
    │   └── e2e/               # Playwright E2E 测试
    └── Dockerfile
```

---

## 七、API 端点一览

| 前缀 | 模块 | 端点 |
|------|------|------|
| `/api/v1/auth` | 认证 | login, register, captcha, sms, refresh |
| `/api/v1/subjects` | 科目 | CRUD |
| `/api/v1/questions` | 题目 | CRUD + search + typical + llm-explain |
| `/api/v1/question-admin` | 题库管理 | llm-gen, scrape, review, batch, dedup |
| `/api/v1/knowledge-tree` | 知识树 | 版本化 CRUD + 回滚 |
| `/api/v1/exam-papers` | 试卷 | CRUD + export(Word/PDF) + publish |
| `/api/v1/answers` | 答题 | submit → auto-grade → audit → notebook |
| `/api/v1/grading` | 评分 | records & audit |
| `/api/v1/ocr` | OCR | 双引擎识别 |
| `/api/v1/error-notebooks` | 错题本 | 生成 + 练习题抽取 |
| `/api/v1/self-study` | 自学 | 任务 CRUD |
| `/api/v1/classes` | 班级 | 班级 + 学生管理 |
| `/api/v1/teacher/stats` | 教师统计 | 数据统计 + 评语 + 通知 |
| `/api/v1/student` | 学生 | 进度追踪 + 图表数据 |
| `/api/v1/parent` | 家长 | 鼓励 + 奖励 + 庆典 (17 端点) |
| `/api/v1/topic-board` | 讲题板 | LLM 分步讲解 |
| `/api/v1/recommendations` | 推荐 | 教师→学生题目推荐 |
| `/api/v1/notifications` | 通知 | REST + WebSocket |
| `/api/v1/reference` | 参考数据 | 8 类参考数据 |
| `/api/v1/database` | 数据库 | 表结构查看 (sys-admin) |
| `/api/v1/admin/llm` | LLM 管理 | 模型配置 + 任务管理 |
| `/ws/notifications` | WebSocket | 实时消息推送 |

---

## 八、已知限制

1. **LLM 功能**：需要配置 Ollama 或 DeepSeek API Key，目前仅规则判分可用
2. **OCR 功能**：需要安装 Tesseract 和/或启动 PaddleOCR HTTP 服务
3. **Celery 异步任务**：需要 Redis + Celery Worker 配合使用
4. **生产部署**：当前配置为开发模式，生产环境需要修改 SECRET_KEY 和数据库密码
5. **长期基础设施**：MinIO 对象存储、Airflow 调度、MLflow 实验管理、Redis 缓存层待实现

---

## 九、变更记录

### V3.5 (2026-05-27)
- 全新一键部署脚本 `deploy-v35.sh`
- 全新综合演示数据脚本 `seed_v35.py`（80 题/6 卷/12 答题/5 错题本）
- 物理科目完整支持
- 知识点模型 (ML Model) 表支持
- 鼓励消息模板系统
- 奖励目标完整工作流
- 多家长-学生关联
- 数据库模型兼容性修复
- 系统配置与 LLM 配置分离
- 前端路由和登录流程优化

### V3.1 (2026-05)
- 家长端 (鼓励者角色) 完整功能
- 讲题板 (Drawer 嵌入式, LLM 自动分步讲解)
- 题目推荐 (教师→学生定向推荐)
- 学习进度可视化 (Recharts 图表)
- WebSocket 实时通知系统

### V3.0 (2026-04)
- 初始发布
- 五种角色认证系统
- 题库管理 + 试卷管理
- 在线答题 + 自动判分
- 错题本 + 自学任务
- 班级管理 + 教师统计
- 知识树版本化
- OCR 双引擎
- LLM 题目生成
