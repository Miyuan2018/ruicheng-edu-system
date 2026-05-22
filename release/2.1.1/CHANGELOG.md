# 变更日志

## V2.1.1 (2026-05-17) — 版本化知识树

### 新增
- **KnowledgeNode 模型**: 支持 AREA(知识领域)/POINT(知识点) 两级节点
- **版本化知识树 API** (10个端点):
  - `GET /knowledge-tree/syllabi/{id}/tree` — 获取版本化树
  - `POST /knowledge-tree/syllabi/{id}/nodes` — 新增节点
  - `PUT /knowledge-tree/syllabi/{id}/nodes/{id}` — 修改节点（触发子孙失效）
  - `DELETE /knowledge-tree/syllabi/{id}/nodes/{id}` — 软删除分支
  - `POST .../nodes/{id}/set-branch-active` — 分支批量有效/无效
  - `POST /knowledge-tree/syllabi/{id}/new-version` — 创建新版本
  - `GET /knowledge-tree/syllabi/{id}/versions` — 版本列表
- **父子联动失效**: 修改父节点→所有子孙节点自动设为 invalid_reason='PARENT_MODIFIED'
- **分支操作**: 选中节点→整个子树批量 set active/inactive
- **版本管理**: 每个考纲支持多版本，新版本从当前 active 节点复制
- **前端知识树页面**: Tree 组件 + 右键菜单 + 节点详情面板 + 状态可视化
- **冒烟测试套件**: 27项全链路测试

### 修改
- Syllabus 模型新增 version/is_current/parent_syllabus_id 字段
- User 模型角色新增 QUESTION_ADMIN
- Question 模型新增 source/review_status/reviewed_by/source_task_id

---

## V2.1 (2026-05-17) — 题库管理中心

### 新增
- **QUESTION_ADMIN 角色**: 专用题库管理员
- **考纲管理**: 创建/列表/详情/编辑
- **知识点提取**: 从考纲自动提取（LLM驱动，mock实现）
- **LLM 试题生成**: 按知识点+难度+题型批量生成
- **网络抓取**: 异步抓取后台任务
- **试题审核流程**: PENDING→APPROVED/REJECTED 状态机
- **批量审核**: 批量通过/驳回
- **试题去重**: 按标题相似度分组
- **LlmConfig 模型**: 大模型配置（本地/在线）
- **QuestionTask 模型**: 异步任务管理
- **前端题库管理中心**: 4 Tab（考纲/生成/抓取/审核）

---

## V2.0 (2026-05-17) — 判卷与错题本

### 新增
- **规则匹配判卷引擎** (`judge_engine.py`):
  - 单选题: 精确匹配
  - 多选题: 部分给分
  - 填空题: 多答案+模糊匹配
  - 解答题: 关键词重叠评分
- **自动判卷流程**: 提交答案→立即判卷→写入分数反馈
- **错题本自动生成**: 判卷后检测错题→自动创建错题本
- **知识点匹配**: 基于学科+难度匹配强化练习题
- **错误分类**: 概念错误/记忆错误/理解偏差
- **MinIO 存储集成** (`storage.py`)
- **OCR 上传页面** (`OcrUpload.tsx`)

### 修复
- UUID 类型不兼容 → 全局 `uuid.UUID` 类型注解
- Pydantic v2 兼容 (`regex`→`pattern`, `orm_mode`→`from_attributes`)
- bcrypt 5.x 与 passlib 不兼容 → 降级 bcrypt 4.3.0
- SQLite 迁移语法 (batch mode + server_default)
- 字段名不一致 (schema↔model)

---

## V1.0 (2026-05-17) — 项目启动

### 初始交付
- 项目脚手架（FastAPI + React + Ant Design）
- 17张数据库表，Alembic 迁移框架
- 68个 API 端点（8个服务模块）
- 20个前端页面（登录/仪表盘/试题/试卷/答题/错题本/班级/管理）
- JWT 认证 + RBAC 三角色权限
- Docker Compose 开发环境
- 一键启动脚本
