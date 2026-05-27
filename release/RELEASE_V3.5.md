# 睿承教育平台 V3.5 发布说明

**发布日期：** 2026-05-27  
**Alembic 迁移版本：** 011  
**技术栈：** FastAPI + PostgreSQL 16 + React 19 + Ant Design 6

---

## 本次发布亮点

### 新功能模块

| 模块 | 说明 |
|------|------|
| **演讲板（Topic Board）** | 黑板动画 + 熊猫教授气泡 + LLM 逐步讲解，支持步骤回放与编辑 |
| **家长端** | 家长注册/登录、绑定学生、查看成绩、发送鼓励消息、设置奖励目标、庆典事件 |
| **通知系统** | 站内消息推送，WebSocket 实时连接，支持批改完成/错题就绪/考试提醒等类型 |
| **题目推荐引擎** | 教师基于错题本向学生推荐典型练习题 |
| **自学任务页面** | 学生自学任务独立管理页面 |
| **教师互动服务** | 教师与学生互动记录 API |

### 技术升级

| 类别 | 内容 |
|------|------|
| 数据库迁移 | 新增 005~011 共 7 个 Alembic 迁移（OCR状态、内容哈希、自学重构、讲解会话、家长鼓励、推荐、通知类型） |
| 新增模型 | explanation_session/step、encouragement、celebration_event、reward_goal、question_recommendation、parent_student_link |
| 异步框架 | Celery 异步任务框架（celery_app.py + llm_tasks.py，基础框架已就绪） |
| 新增服务 | dedup_service、notification_service、ocr_service、ws_manager、interaction_service |
| docker-compose | 升级为 PostgreSQL 16，增加 healthcheck 和服务依赖等待 |

### 演示数据脚本

新增 `backend/demo_data.py`，支持一键清除旧数据并导入完整演示数据，覆盖全部 26 张业务表。

---

## 演示账号

| 角色 | 用户名 | 密码 | 备注 |
|------|--------|------|------|
| 系统管理员 | SYSAdmin | SYSPass | 后台超管 |
| 教师（数学） | t_math | Demo1234 | 王数学，八年级A班 |
| 教师（语文） | t_chinese | Demo1234 | 李语文，七年级B班 |
| 教师（英语） | t_english | Demo1234 | 张英语，九年级A班 |
| 题目管理员 | tk_zhao | Demo1234 | 赵题库 |
| 学生（八年级） | zhang_ming | Demo1234 | 张明，有错题本和讲解记录 |
| 学生（八年级） | li_hua | Demo1234 | 李华，有答题记录 |
| 学生（七年级） | wang_fang | Demo1234 | 王芳，语文86分 |
| 学生（九年级） | chen_qiang | Demo1234 | 陈强，英语模拟卷 |
| 学生（八年级） | liu_li | Demo1234 | 刘丽 |
| 家长 | p_zhang_fu | Demo1234 | 张明之父，已绑定 |
| 家长 | p_li_mu | Demo1234 | 李华之母，已绑定 |

> **登录说明：** 学生端 `/login`，管理/教师/家长端 `/admin/login`。  
> 开发模式下短信验证码固定为 `111111`。

---

## 演示数据概览

| 表 | 数据量 | 说明 |
|----|--------|------|
| subjects | 4 | 数学/语文/英语/物理 |
| admins | 4 | 3名教师 + 1名题目管理员 |
| students | 5 | 七/八/九年级各角色 |
| parents | 2 | 含家长-学生绑定关系 |
| classes | 3 | 三个班级，5条学生关联 |
| syllabi | 2 | 数学+语文课纲 |
| knowledge_nodes | 9 | 树形知识点节点 |
| questions | 50 | 数学25/语文11/英语14，四种题型，含典型题标记 |
| exam_papers | 4 | 期中/单元测/语文期中/英语模拟，均已发布 |
| exam_paper_questions | 54 | 试卷题目关联 |
| answer_submissions | 5 | 含答题明细、自动评分、评分记录 |
| answer_details | 13 | 各题作答明细 |
| grading_records | 2 | 自动评分记录 |
| error_notebooks | 2 | 错题本（含错题条目及推荐练习） |
| self_study_tasks | 5 | 覆盖 PENDING/IN_PROGRESS/COMPLETED 三种状态 |
| notifications | 5 | 批改完成/错题就绪/考试提醒 |
| celebration_events | 3 | 完成首次答题/正确率提升等庆典事件 |
| encouragements | 2 | 家长鼓励消息（含自定义+模板两种类型） |
| reward_goals | 2 | 家长设置的学习奖励目标 |
| question_recommendations | 4 | 教师向学生推荐典型题 |
| explanation_sessions | 3 | 讲解板会话（数学2个/英语1个） |
| explanation_steps | 13 | 各会话步骤详情 |
| question_tasks | 2 | LLM 题目生成任务记录 |

---

## 启动方式

### 方式一：本地开发（推荐）

```bash
./start.sh
```

脚本自动完成：创建 conda 环境 → Alembic 迁移 → 创建超管账号 → 启动后端（:8000）+ 前端（:3000）

### 方式二：Docker 容器化

```bash
docker-compose up -d
# 等待服务就绪后导入演示数据
docker-compose exec backend python demo_data.py
```

### 方式三：手动导入演示数据

```bash
# 在 start.sh 启动服务后执行
cd backend
~/conda_workspace/bin/python demo_data.py
```

---

## 访问地址

| 端 | 地址 |
|----|------|
| 学生端 | http://localhost:3000/login |
| 管理/教师/家长端 | http://localhost:3000/admin/login |
| API 文档 | http://localhost:8000/docs |

---

## 已知问题

| 优先级 | 问题 |
|--------|------|
| P0 | 试卷导出（Word/PDF）端点为空壳，功能不可用 |
| P0 | 学生仪表盘部分统计数据为 Mock |
| P1 | OCR 拍照录入为占位符，功能不可用（ocr_service.py 框架已就绪，待集成 PaddleOCR） |
| P1 | Celery 异步任务框架已就绪，需配置 Redis 后方可使用 |
| P2 | 知识树版本化逻辑未完整实现 |
| P2 | WebSocket 实时通知在多进程部署下需要接入 Redis Pub/Sub |

---

## 打包

```bash
cd release
bash release.sh
# 输出：ruicheng-edu-v3.5-YYYYMMDD.tar.gz + SHA256
```
