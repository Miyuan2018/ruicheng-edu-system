# 睿承教育平台 V3.0 需求及设计文档

> 版本: V3.0
> 日期: 2026-05-25
> 基于: V2.4 代码深度审查 + 原始客户需求 + V2.0~V2.4 全版本需求文档回溯

---

## 目录

1. [审查摘要与核心发现](#1-审查摘要与核心发现)
2. [V2.4 现状评估](#2-v24-现状评估)
3. [V3.0 需求清单](#3-v30-需求清单)
4. [技术架构设计](#4-技术架构设计)
5. [数据库设计增量](#5-数据库设计增量)
6. [API 设计增量](#6-api-设计增量)
7. [前端设计增量](#7-前端设计增量)
8. [安全与合规设计](#8-安全与合规设计)
9. [部署与运维设计](#9-部署与运维设计)
10. [版本路线图](#10-版本路线图)

---

## 1. 审查摘要与核心发现

### 1.1 深度审查范围

| 层 | 检查项 | 发现 |
|---|--------|------|
| 数据库 | 25 模型 + 全部关系 + 约束 | 状态字段中英混用、缺少事务回滚、FK 约束部分缺失 |
| 后端 API | 16 模块 ~100+ 端点 | 中间件未接入、角色检查不一致、无分页上限 |
| 业务逻辑 | 7 个 Service | 评分引擎得分缩放 Bug、去重未实现、OCR 为占位符 |
| 前端页面 | 27 页面文件 + 路由 | 学生仪表盘 Mock 数据、createElement/JSX 混用、Zustand/localStorage 双轨 |
| 需求文档 | V1.0~V2.4 全部 | 多版需求互有矛盾、Phase2 延迟但文档未同步标注 |

### 1.2 按严重度分级的问题清单

#### 严重 (P0) — 影响核心功能正确性

| # | 问题 | 现象 | 影响 |
|---|------|------|------|
| P0-1 | **ApiResponseMiddleware 未接入** | `app/core/response.py` 定义了 `{code, message, data}` 包装器，但 `main.py` 未添加中间件；端点返回裸数据 | 前端 `client.ts` 按 `{code, data}` 自动解包，部分端点格式不一致导致前端崩溃 |
| P0-2 | **多选题得分缩放 Bug** | `judge_engine.py` 多选题先将得分归一化到 0~1，再执行 `(score/max_score)*max_score` 缩放；当 max_score≠1 时得分计算错误 | 学生得分不准确，尤其影响总分 |
| P0-3 | **Paper Export 空壳** | `/exam-papers/{id}/export` 端点返回成功但无文件生成；python-docx/WeasyPrint 未集成 | 教师无法导出试卷，核心教学流程断裂 |
| P0-4 | **AnswerSubmission 状态中英混用** | `status` 字段值 `"已判分"/"已生成"/"重新判"` (中文) vs GradingRecord `"PENDING"/"COMPLETED"` (英文) | 跨表查询失败，前端状态映射困难 |
| P0-5 | **学生仪表盘全部 Mock 数据** | DashboardPage 学生视图 12 份试卷/85.5% 正确率/23 错题/98 最高分 — 均为硬编码 | 学生看到虚假数据 |

#### 高 (P1) — 影响安全性或完整性

| # | 问题 | 现象 | 影响 |
|---|------|------|------|
| P1-1 | **角色/权限检查不一致** | JWT `type` 字段 (SYS_ADMIN/TEACHER/QUESTION_ADMIN/STUDENT) vs `current_user.role` 属性 vs `admin_type` 字段 (0~5)；部分端点用 `role` 部分用 `user_type` | 权限绕过风险 |
| P1-2 | **DeepSeek API Key 明文存储** | `sysconfig.json` 中 `sk-...` 直接写入；`config_service.py` 还尝试从 `~/.claude/settings.local.json` 读取 | 配置泄露即暴露密钥 |
| P1-3 | **部分操作无事务回滚** | `create_exam_paper` 先 flush 再插入题目，若题目插入失败，试卷已存在但无题目 | 产生孤立记录 |
| P1-4 | **自动判分不创建 GradingRecord** | `/answers` 端点自动判分但不写审计记录；仅 `/grading/start` 创建 | 无判分审计轨迹 |
| P1-5 | **分页无上限** | `/questions/search` limit 默认 100 无最大值约束；`/exam-papers/my` 同理 | 潜在 DoS 或性能瓶颈 |

#### 中 (P2) — 影响功能完整性

| # | 问题 | 现象 | 影响 |
|---|------|------|------|
| P2-1 | **OCR 未实际集成** | PaddleOCR/Tesseract 均未接入；上传端点存在但返回占位符 | 拍照答题功能不可用 |
| P2-2 | **知识树版本逻辑缺失** | `KnowledgeNode.version` 字段存在但无版本创建/回滚逻辑 | 版本控制承诺未兑现 |
| P2-3 | **题目去重未实现** | `/question-admin/dedup` 端点存在但无实现；LLM service 有简单标题去重 | 重复题目积累 |
| P2-4 | **前端 Auth 双轨** | Zustand `auth.ts` store 定义了 `login/logout/fetchUser`；但所有页面直接读写 localStorage | 状态不一致，store 与 localStorage 分裂 |
| P2-5 | **前端 createElement/JSX 混用** | 旧页面 (Dashboard, MistakeBook) 用 `React.createElement`；新页面 (QuestionList, Profile) 用 JSX/TSX | 维护困难、类型安全缺失 |
| P2-6 | **Notification 推送未实现** | 数据模型存在，仅 SMTP 框架，无 WebSocket/实际推送 | 通知功能不可用 |

---

## 2. V2.4 现状评估

### 2.1 已完成功能矩阵

| 功能模块 | 后端 | 前端 | 端到端可用 |
|----------|------|------|-----------|
| 用户认证 (2-step SMS) | ✅ | ✅ | ✅ |
| 试题 CRUD | ✅ | ✅ | ✅ |
| 试卷管理 | ✅ | ✅ | ✅ |
| 在线答题 → 自动判分 | ✅ | ✅ | ✅ |
| 错题本生成 | ✅ | ✅ | ✅ |
| 班级管理 | ✅ | ✅ | ✅ |
| 参考数据管理 | ✅ | ✅ | ✅ |
| LLM 题目生成 | ✅ | ✅ | ✅ |
| 教师统计 | ✅ | ✅ | ✅ |
| 系统管理 (用户/配置) | ✅ | ✅ | ✅ |
| 试卷导出 Word/PDF | ⚠️ 端点空壳 | ✅ UI 入口 | ❌ |
| OCR 拍照录入 | ⚠️ 占位符 | ⚠️ Mock | ❌ |
| 知识树版本化 | ⚠️ 模型存在 | ⚠️ 部分页面 | ❌ |
| 通知推送 | ⚠️ 数据模型 | ❌ 无 UI | ❌ |
| 自学任务 | ⚠️ 端点存在 | ❌ 无路由 | ❌ |
| 数据库 introspection UI | ⚠️ 端点存在 | ❌ 无 UI | ❌ |

### 2.2 技术债务统计

| 类别 | 数量 | 详情 |
|------|------|------|
| P0 严重问题 | 5 | 中间件、得分Bug、导出空壳、状态混用、Mock仪表盘 |
| P1 高级问题 | 5 | 权限不一致、密钥泄露、无事务、无审计、无分页上限 |
| P2 中级问题 | 6 | OCR、版本逻辑、去重、Auth双轨、风格混用、通知 |
| 前端未对齐后端 | 4 | 自学、DB管理、批量审批、高级筛选 |
| 已声明但未实现 | 6 | Redis缓存、Celery异步、MinIO、K8s、Airflow、MLflow |

---

## 3. V3.0 需求清单

### 3.1 P0 修复 — 必须优先完成

#### R3.1-01: 统一 API 响应格式

**需求**: 所有 `/api/v1/*` 端点统一返回 `{code, message, data}` 格式。

**设计**:
- 在 `app/main.py` 中添加 `ApiResponseMiddleware` 到中间件栈
- 所有端点返回值被自动包装
- 前端 `client.ts` 的自动解包逻辑保持不变
- 错误响应统一为 `{code: 4xx/5xx, message, detail, data: null}`
- 对已手动返回 `{code, ...}` 格式的端点（如 `/reference/all`）做兼容处理，避免双重包装

**验收**: 所有端点响应可被 `client.ts` 正确解包；Postman/curl 验证格式一致性。

#### R3.1-02: 修复评分引擎得分缩放

**需求**: 多选题得分计算正确，且所有题型得分计算公式清晰统一。

**设计**:
- 单选题: `score_obtained = max_score` (全对) 或 `0` (错)
- 多选题: `score_obtained = overlap_count / total_correct_count * max_score`
- 填空题: `score_obtained = matched_count / total_blank_count * max_score`
- 主观题: 关键词匹配 → 按 80%/40% 阈值分级得分 → `* max_score`
- 删除 `judge_engine.py` 中的二次缩放步骤 `(score/max_score)*max_score`
- 为每道题增加 `max_score` 参数传入判分函数（从 `ExamPaperQuestion.score` 或 `Question.score` 获取）

**验收**: 构造多选题 max_score=5 的测试用例，验证得分不再错误缩放。

#### R3.1-03: 试卷导出 Word/PDF 实现完整

**需求**: 教师可以导出试卷为 Word (.docx) 和 PDF 文件，包含完整排版。

**设计**:
- 集成 `python-docx` 生成 Word 文档
  - 标题/副标题/科目/年级/总分/时长 元信息区
  - 按题型分组的题目区 (填空 → 单选 → 多选 → 主观)
  - 每题含序号、题干、选项、分值
  - 答案区 (可选: 附答案页)
- 集成 `WeasyPrint` 从 HTML 生成 PDF
  - 用同一 HTML 模板同时服务于 Print Preview 和 PDF 导出
  - 支持中文字体 (SimSun/NotoSansCJK)
- 导出端点返回文件流 (`Content-Disposition: attachment`)
- 前端下载使用 `fetch → Blob → saveAs`

**验收**: 导出的 Word/PDF 打开无乱码、排版完整、题目内容正确。

#### R3.1-04: 统一状态字段为英文枚举

**需求**: 所有状态字段使用英文枚举值，前端统一映射为中文标签。

**设计**:
- `AnswerSubmission.status`: `SUBMITTED | GRADED | RE_GRADED` (替换中文)
- 数据库迁移: UPDATE 现有记录的中文值为英文枚举
- 前端: 状态映射表 `{GRADED: "已判分", RE_GRADED: "重新判", SUBMITTED: "已提交"}`
- 其他已使用英文枚举的表保持不变
- 所有新增枚举值在 model 的 `CheckConstraint` 中声明合法值集合

**验收**: 数据库无中文状态值残留；前端显示无变化（仍为中文标签）。

#### R3.1-05: 学生仪表盘真实数据

**需求**: 学生仪表盘展示真实统计数据，而非硬编码 Mock。

**设计**:
- 新增后端端点 `GET /api/v1/student/stats`
  - 返回: `{completed_papers, accuracy_rate, error_count, highest_score, recent_papers[], subject_distribution[]}`
  - 数据来源: `answer_submissions` 表聚合查询
- 前端 `DashboardPage` 学生视图: 替换硬编码数据为 API 调用
- 增加"最近完成试卷"列表 (5 条) 和"科目分布"饼图

**验收**: 学生仪表盘数据与实际答题记录一致；无硬编码值。

---

### 3.2 P1 修复 — 安全与完整性

#### R3.2-01: 统一角色权限检查

**需求**: 所有端点使用统一的角色/权限检查机制，消除 `role` vs `user_type` vs `admin_type` 混淆。

**设计**:
- JWT payload 保持 `type` 字段: `SYS_ADMIN | TEACHER | QUESTION_ADMIN | STUDENT`
- `CurrentUser` 对象增加 `role` 属性 → 直接返回 `user_type` 值 (一致性)
- `require_role(*roles)` 统一检查 `current_user.user_type`
- `admin_type` 字段仅在 Admin 表内部使用 (区分 Teacher/QuestionAdmin/校长等)
- 删除所有端点中对 `current_user.role` 的直接字符串比较 (已不一致)
- 代码审计: 全量扫描 `current_user.role` 和 `current_user.user_type` 用法

**验收**: 权限测试矩阵 — 每个角色 × 每个受限端点 → 预期通过/拒绝结果全部正确。

#### R3.2-02: 密钥安全存储

**需求**: API Key、数据库密码、SECRET_KEY 不出现在 `sysconfig.json` 或代码中。

**设计**:
- 所有敏感配置迁移至 `backend/.env` (或环境变量)
  - `SECRET_KEY`, `DATABASE_PASSWORD`, `DEEPSEEK_API_KEY`
- `sysconfig.json` 仅存储非敏感运行时配置 (LLM endpoint URL、模型名、导出上限等)
- `config_service.py` 读取敏感值时优先从环境变量获取
- `.env` 加入 `.gitignore`；提供 `.env.example` 模板
- 删除 `~/.claude/settings.local.json` 读取逻辑

**验收**: `sysconfig.json` 中无 `sk-*` 或密码值；环境变量可覆盖所有敏感配置。

#### R3.2-03: 事务完整性保障

**需求**: 涉及多表写入的操作使用数据库事务，失败时回滚。

**设计**:
- `create_exam_paper`: 整个操作 (试卷 + 题目关联) 在同一事务中
- `generate_mistake_book`: ErrorNotebook + ErrorNotebookQuestion 在同一事务中
- `submit_answers`: AnswerSubmission + AnswerDetail 在同一事务中
- `delete_exam_paper`: 删除子记录 + 试卷在同一事务中
- 使用 FastAPI 依赖注入的 `AsyncSession` + `async with session.begin()` 模式
- 所有端点增加异常处理 → 事务自动回滚

**验收**: 测试用例模拟中途失败 → 验证无孤立记录产生。

#### R3.2-04: 自动判分审计记录

**需求**: 每次自动判分操作均创建 `GradingRecord` 审计记录。

**设计**:
- 在 `submit_answers` 端点中，判分完成后同步创建 `GradingRecord`
  - `model_used`: `"rule_engine"` (规则引擎)
  - `status`: `"COMPLETED"`
  - `total_score`: 判分总分
  - `details`: 每题得分明细 JSON
- 保留 `/grading/start` 端点用于 LLM 判分场景
- 前端判分结果页可跳转查看审计记录

**验收**: 每次答题提交后 `grading_records` 表有对应记录；审计可追溯。

#### R3.2-05: 分页上限与默认值

**需求**: 所有列表端点设定合理的 `limit` 上限和默认值。

**设计**:
- 全局默认: `skip=0`, `limit=20`
- 全局上限: `limit ≤ 200` (超过 200 返回 400 错误)
- 高频端点: `/questions/search` → 默认 20, 上限 100
- 影响端点: 所有含 `skip/limit` 参数的 GET 端点
- 实现方式: Pydantic schema 中 `limit: int = 20, Field(ge=1, le=200)`

**验收**: 传入 `limit=9999` → 返回 400 错误；默认请求返回 20 条。

---

### 3.3 P2 修复 — 功能完整性

#### R3.3-01: OCR 集成 (Tesseract 第一阶段)

**需求**: 学生可通过拍照上传答卷，系统识别后自动判分。

**设计** (分阶段):
- **阶段 A (V3.0)**: Tesseract OCR 集成
  - 上传 → Tesseract 处理 → 结构化文本 → 人工校对 → 提交判分
  - 低置信度 (< 0.7) 自动标记需人工审核
  - 前端: OCR 结果可编辑修正后再提交
- **阶段 B (V3.1)**: PaddleOCR GPU 加速
  - 替换 Tesseract → PaddleOCR (更高中文识别率)
  - 自动置信度阈值判定
  - 支持 GPU 加速 (需要 DGX Spark 或本地 GPU)
- 文件存储: 本地文件系统 (阶段 A)；MinIO (阶段 B)
- `OcrUpload.status` 增加 `NEEDS_REVIEW` 状态

**验收** (阶段 A): 上传一张答卷照片 → OCR 提取文字 → 编辑界面 → 提交 → 判分结果正确。

#### R3.3-02: 知识树版本化完整实现

**需求**: 教师可对知识树节点进行版本创建、回滚、父子级联失效。

**设计**:
- `POST /knowledge-tree/{node_id}/version`: 创建新版本
  - 复制当前版本所有活跃节点到新版本
  - 新版本号 = 当前版本号 + 1
  - 旧版本节点保留但 `is_current=false`
- `PUT /knowledge-tree/{node_id}/rollback`: 回滚到指定版本
- 修改父节点 → 子节点自动失效 (`invalid_reason=PARENT_MODIFIED`)
- 前端: 树节点颜色编码 (绿=有效, 橙=父级修改, 红=手动失效, 灰=版本裁剪)
- 右键菜单: 修改、失效、创建版本、回滚

**验收**: 修改父节点 → 子节点自动变橙；创建新版本 → 旧版本保留；回滚 → 恢复历史版本。

#### R3.3-03: 题目去重实现

**需求**: 系统可检测并合并相似/重复题目。

**设计**:
- **快速去重**: 标题完全相同 → 自动标记
- **语义去重**: SimHash 文本指纹 + 相似度阈值 (> 0.85)
  - 计算 `questions.content_hash` (新增字段)
  - `/question-admin/dedup` 端点: 执行去重扫描 → 返回相似组列表
  - 前端: 并排对比视图 → 确认合并或保留
  - 合并: 保留一道，其余 `is_active=false`，`meta_data.dedup_merged=true`
- 新增迁移: `questions` 表添加 `content_hash` 列 (String(64))

**验收**: 导入两道高度相似题目 → 去重扫描检测 → 并排对比 → 合并成功。

#### R3.3-04: 前端 Auth 状态统一

**需求**: 所有页面使用 Zustand store 作为唯一 auth 状态源。

**设计**:
- `auth.ts` store 增强:
  - `login()` → 写入 store + localStorage (双写)
  - `logout()` → 清除 store + localStorage
  - `fetchUser()` → 从 API 获取最新用户信息
  - 暴露 `user_type`, `user_id`, `full_name` 等派生属性
- 所有页面: 删除直接 `localStorage.getItem('user_type')` 调用 → 替换为 `useAuthStore()`
- `AppLayout` 从 store 读取角色 → 生成侧栏菜单
- 401 refresh 逻辑保留在 `client.ts` (axios interceptor)

**验收**: 登录后刷新页面 → store 恢复 → 页面无白屏；logout → store 清空 → 路由跳转。

#### R3.3-05: 前端代码风格统一 (JSX + TypeScript)

**需求**: 所有页面组件使用 JSX + TypeScript，消除 `React.createElement` 风格。

**设计**:
- 逐页迁移: Dashboard → MistakeBook → MyPapers → 其他 createElement 页面
- 保留组件逻辑不变，仅转换表达方式
- 添加类型声明: 每个 API 响应定义 TypeScript interface
- 目标: `npm run build` (tsc + vite) 零错误

**验收**: ESLint + TypeScript 编译零错误；所有页面功能不变。

#### R3.3-06: 通知系统基础实现

**需求**: 系统可向用户发送应用内通知。

**设计** (V3.0 仅应用内通知):
- 后端: 新增 `GET /api/v1/notifications` 端点 (当前用户的通知列表)
- 后端: `POST /api/v1/notifications/{id}/read` (标记已读)
- 触发时机:
  - 判分完成 → 通知学生
  - 错题本生成完成 → 通知学生
  - 试卷发布 → 通知班级学生
- 前端: `AppLayout` Header 通知铃铛图标 + 下拉面板 (最近 10 条)
- 前端: 通知列表页 `/notifications`
- WebSocket 实时推送 → 延迟至 V3.1

**验收**: 教师发布试卷 → 班级学生收到通知铃铛提醒 → 点击查看详情。

---

### 3.4 新功能需求 — V3.0 新增

#### R3.4-01: 自学任务前端实现

**需求**: 学生可在"自学任务"页面查看教师分配的学习任务并完成。

**设计**:
- 前端路由: `/self-study` → `SelfStudyPage`
- 学生侧栏增加: "自学任务"菜单项
- 页面功能:
  - 任务列表: 标题、类型 (知识提取/题目生成/模型训练)、状态、优先级
  - 任务详情: 描述、参数、结果数据
  - 完成按钮: `POST /self-study/{id}/complete`
- 教师/管理员可从 Dashboard 或专门页面创建自学任务分配给学生

**验收**: 教师创建自学任务 → 学生在自学任务页看到 → 完成并查看结果。

#### R3.4-02: 数据库管理 UI (SysAdmin)

**需求**: 系统管理员可在前端查看和管理数据库表结构。

**设计**:
- 前端路由: `/admin/database` → `DatabaseManagementPage`
- SysAdmin 侧栏增加: "数据库管理"菜单项
- 页面功能:
  - 表列表: 表名、行数、大小、列数
  - 表详情: 列名、类型、约束、索引
  - 不提供直接数据编辑 (安全考虑)

**验收**: SysAdmin 登录 → 数据库管理页 → 选择表 → 查看完整 schema。

#### R3.4-03: 批量审批/拒绝题目

**需求**: Question Admin 可一次审批或拒绝多道待审题目。

**设计**:
- 后端新增端点:
  - `POST /api/v1/question-admin/batch-approve` (body: `{question_ids: []}`)
  - `POST /api/v1/question-admin/batch-reject` (body: `{question_ids: [], reason: string}`)
- 前端 `QuestionAdminPage`:
  - 待审列表增加多选 checkbox
  - 工具栏: "批量通过" / "批量拒绝" 按钮
  - 拒绝时弹出原因输入框

**验收**: 选择 5 道待审题目 → 批量通过 → 状态变 APPROVED。

#### R3.4-04: 高级筛选增强

**需求**: 前端题目/试卷搜索支持后端已有的全部筛选参数。

**设计**:
- `QuestionListPage`: 新增 `review_status`、`knowledge_point`、`source`、`is_typical` 筛选
- `PaperListPage`: 新增 `created_by`、`grade_level` 精确筛选
- `MyPapersPage`: 新增日期范围筛选
- 筛选 UI: Ant Design `Select`/`DatePicker` + 折叠式高级筛选面板

**验收**: 使用 `review_status=PENDING` 筛选 → 仅显示待审题目。

#### R3.4-05: 学习进度追踪与可视化

**需求**: 学生和教师可追踪学习进度、知识点掌握度、错误趋势。

**设计**:
- 后端新增端点:
  - `GET /api/v1/student/progress`: 学生学习进度概要
    - 返回: `{overall_accuracy, subject_progress[], knowledge_point_mastery[], error_trend[]}`
  - `GET /api/v1/teacher/student-progress/{student_id}`: 教师查看学生进度
- 前端:
  - 学生 Dashboard: 进度环形图 + 知识点雷达图 + 错误趋势折线图
  - 教师视图: 班级学生进度排行榜 + 个体详情
- 数据来源: `answer_submissions` + `answer_details` + `error_notebooks` 聚合

**验收**: 学生答题 5 次 → 进度页显示正确率趋势 + 知识点掌握度变化。

#### R3.4-06: 家长端 — 鼓励者角色

**需求**: 家长作为鼓励者参与学生学习过程，可发送鼓励消息、设定奖励目标、庆祝成长里程碑。

**核心原则**:
- 家长只看正面趋势（努力指标、成长趋势），不看具体分数和错题
- 家长通过鼓励消息和奖励目标激励学生，而非监控学习过程
- 系统自动检测正面成就事件，提示家长发送祝贺

**注册与关联**:
- 家长自助注册：手机号 + SMS 验证码（与学生注册流程一致）
- 亲子关联：学生生成6位邀请码（7天有效），家长输入邀请码完成关联
- 每位学生最多关联4位家长

**功能设计**:
1. 鼓励消息：模板 + 自定义 → 出现在学生仪表盘
2. 奖励目标：家长设定可达目标+奖励描述 → 系统自动追踪进度
3. 庆祝里程碑：系统检测正面事件 → 提示家长发送鼓励
4. 正面趋势：只看努力指标和成长，不看分数和错题

**后端端点** (17个):
- POST `/auth/parent/register` — 家长注册
- POST `/auth/parent/login` — 家长登录
- POST `/parent/link-student` — 输入邀请码关联子女
- DELETE `/parent/unlink-student/{student_id}` — 解除关联
- GET `/parent/children` — 关联子女列表
- GET `/parent/child/{student_id}/positive-stats` — 正面趋势数据
- GET `/parent/celebration-opportunities` — 待庆祝事件
- POST `/parent/encouragements` — 发送鼓励
- GET `/parent/encouragements` — 已发送鼓励列表
- GET `/encouragements/received` — 学生收到鼓励 (STUDENT)
- POST `/encouragements/{id}/read` — 标记已读 (STUDENT)
- POST `/parent/reward-goals` — 创建奖励目标
- GET `/parent/reward-goals` — 奖励目标列表
- PUT `/parent/reward-goals/{id}` — 更新奖励目标
- POST `/parent/reward-goals/{id}/claim` — 标记已兑现
- GET `/parent/encouragement-templates` — 鼓励语模板
- POST `/students/generate-invite-code` — 生成邀请码 (STUDENT)

**前端页面** (6个):
- `/parent/login` — ParentLoginPage (登录+注册)
- `/parent/dashboard` — ParentDashboardPage (正面统计+庆祝横幅)
- `/parent/encourage` — ParentEncouragePage (模板+自定义+历史)
- `/parent/rewards` — ParentRewardGoalsPage (创建+进度+兑现)
- `/parent/celebrations` — ParentCelebrationsPage (成就时间线)
- `/parent/profile` — ParentProfilePage (个人信息+关联管理)

**验收**: 家长注册 → 输入邀请码关联 → 查看正面趋势 → 发送鼓励 → 设定奖励目标 → 学生端收到鼓励 → 目标达成后自动通知双方。

---

## 4. 技术架构设计

### 4.1 整体架构 (V3.0)

```
Browser (React 19 + Ant Design 6 + TypeScript, :3000)
  │  Vite proxy /api → localhost:8000
  │
  ▼
FastAPI app (app/main.py)
  ├─ ApiResponseMiddleware ← NEW: 统一响应包装
  ├─ CORS middleware
  ├─ Rate limit middleware ← NEW: 100 req/min per IP
  └─ api_router (/api/v1)
       ├─ /auth          — login, register, captcha, SMS, profile
       ├─ /subjects      — subject CRUD
       ├─ /questions     — question CRUD + search + typical
       ├─ /question-admin — LLM gen, scrape, review, batch-approve/reject, dedup ← NEW
       ├─ /knowledge-tree — versioned tree ← ENHANCED
       ├─ /exam-papers   — paper CRUD, export (Word/PDF) ← FIXED
       ├─ /answers       — submit → auto-grade → audit record ← FIXED
       ├─ /grading       — grading results & review & audit
       ├─ /ocr           — OCR upload + Tesseract processing ← NEW
       ├─ /error-notebooks — mistake book generation
       ├─ /self-study    — self-study tasks ← NEW frontend
       ├─ /classes       — class management
       ├─ /teacher/stats — teacher statistics
       ├─ /student/stats — student statistics ← NEW
       ├─ /student/progress — learning progress ← NEW
       ├─ /parent        — parent encouragement (鼓励者)
       ├─ /notifications — app notifications ← NEW
       ├─ /reference     — reference data CRUD
       ├─ /database      — table introspection (sys-admin)
       └─ /admin/llm     — Ollama/DeepSeek config
            │
            ▼
          AsyncSession → PostgreSQL 16
```

### 4.2 中间件栈 (修改后)

```python
# app/main.py
app = FastAPI(title="睿承教育平台", version="3.0")

# NEW: 统一响应包装
app.add_middleware(ApiResponseMiddleware)

# 保留: CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

# NEW: 速率限制 (简单实现)
app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)
```

### 4.3 评分引擎重构设计

```
judge_engine.py 重构:

class JudgeEngine:
    def grade(self, question, student_answer, max_score: float) -> GradingResult:
        match question.question_type:
            SINGLE_CHOICE → exact_match_grade(question, student_answer, max_score)
            MULTIPLE_CHOICE → partial_match_grade(question, student_answer, max_score)
            FILL_BLANK → blank_match_grade(question, student_answer, max_score)
            SUBJECTIVE → keyword_match_grade(question, student_answer, max_score)

    def exact_match_grade(q, ans, max_score):
        return max_score if ans.lower() == correct.lower() else 0.0

    def partial_match_grade(q, ans, max_score):
        overlap = len(student_set ∩ correct_set)
        return (overlap / len(correct_set)) * max_score  # 直接乘 max_score

    def blank_match_grade(q, ans, max_score):
        matched = sum(1 for blank in correct_blanks if blank in student_answers)
        return (matched / len(correct_blanks)) * max_score

    def keyword_match_grade(q, ans, max_score):
        ratio = keyword_overlap_ratio(ans, correct_keywords)
        if ratio >= 0.8: return max_score * 0.9
        elif ratio >= 0.4: return max_score * 0.5
        else: return max_score * 0.1
```

### 4.4 试卷导出架构

```
exam_papers/export 端点重构:

Word 导出流程:
  ExamPaper + Questions → python-docx Document
    → 标题区 (title, subtitle, subject, grade, total_score, duration)
    → 题目区 (按题型分组, 每题: 序号 + 题干 + 选项 + 分值)
    → 答案区 (可选)
  → StreamingResponse(docx_bytes, media_type="application/vnd.openxmlformats")

PDF 导出流程:
  ExamPaper + Questions → Jinja2 HTML template
    → WeasyPrint HTML → PDF
  → StreamingResponse(pdf_bytes, media_type="application/pdf")

共用 HTML 模板:
  PrintPreviewPage + PDF Export 共用同一模板
  → 前端打印预览直接渲染 HTML
  → 后端 PDF 导出用 WeasyPrint 渲染同一 HTML
```

---

## 5. 数据库设计增量

### 5.1 新增字段

| 表 | 新增列 | 类型 | 说明 |
|----|--------|------|------|
| `questions` | `content_hash` | String(64) | SimHash 文本指纹，用于去重 |
| `answer_submissions` | `status` | 修改值域 | `SUBMITTED|GRADED|RE_GRADED` 替换中文 |
| `ocr_uploads` | `status` | 修改值域 | 增加 `NEEDS_REVIEW` 状态 |

### 5.2 新增索引

| 表 | 索引 | 类型 | 说明 |
|----|------|------|------|
| `questions` | `ix_questions_content_hash` | B-tree | 去重查询加速 |
| `answer_submissions` | `ix_submissions_student_status` | Composite | 学生+状态组合查询 |
| `notifications` | `ix_notifications_recipient_status` | Composite | 收件人+状态查询 |

### 5.3 迁移计划

```
alembic revision --autogenerate -m "004_v3_fixes"

内容:
1. questions.content_hash 新增列 (nullable, 后续批量填充)
2. answer_submissions.status 值域变更 (数据迁移 SQL)
3. ocr_uploads.status 值域扩展 (增加 NEEDS_REVIEW)
4. 新增索引
```

---

## 6. API 设计增量

### 6.1 新增端点

| 模块 | 方法 | 路径 | 说明 | 角色 |
|------|------|------|------|------|
| student/stats | GET | `/student/stats` | 学生统计数据 | STUDENT |
| student/progress | GET | `/student/progress` | 学习进度追踪 | STUDENT |
| teacher/student-progress | GET | `/teacher/student-progress/{student_id}` | 教师查看学生进度 | TEACHER |
| parent | POST | `/parent/link-student` | 输入邀请码关联子女 | PARENT |
| parent | DELETE | `/parent/unlink-student/{id}` | 解除关联 | PARENT |
| parent | GET | `/parent/children` | 关联子女列表 | PARENT |
| parent | GET | `/parent/child/{id}/positive-stats` | 正面趋势数据 | PARENT |
| parent | GET | `/parent/celebration-opportunities` | 待庆祝事件 | PARENT |
| parent | POST | `/parent/encouragements` | 发送鼓励 | PARENT |
| parent | GET | `/parent/encouragements` | 已发送鼓励列表 | PARENT |
| encouragements | GET | `/encouragements/received` | 学生收到鼓励 | STUDENT |
| encouragements | POST | `/encouragements/{id}/read` | 标记已读 | STUDENT |
| parent | POST | `/parent/reward-goals` | 创建奖励目标 | PARENT |
| parent | GET | `/parent/reward-goals` | 奖励目标列表 | PARENT |
| parent | PUT | `/parent/reward-goals/{id}` | 更新奖励目标 | PARENT |
| parent | POST | `/parent/reward-goals/{id}/claim` | 标记已兑现 | PARENT |
| parent | GET | `/parent/encouragement-templates` | 鼓励语模板 | PARENT |
| students | POST | `/students/generate-invite-code` | 生成邀请码 | STUDENT |
| notifications | GET | `/notifications` | 当前用户通知列表 | ALL |
| notifications | POST | `/notifications/{id}/read` | 标记已读 | ALL |
| question-admin | POST | `/question-admin/batch-approve` | 批量通过 | QUESTION_ADMIN |
| question-admin | POST | `/question-admin/batch-reject` | 批量拒绝 | QUESTION_ADMIN |
| question-admin | POST | `/question-admin/dedup` | 执行去重扫描 | QUESTION_ADMIN |

### 6.2 修改端点

| 模块 | 路径 | 修改 | 说明 |
|------|------|------|------|
| exam-papers | `/exam-papers/{id}/export` | 实现文件生成 | 从空壳改为返回 docx/pdf 流 |
| answers | `/answers` (POST) | 增加 GradingRecord | 自动判分后写入审计记录 |
| knowledge-tree | `/knowledge-tree/{id}/version` | 实现版本逻辑 | 从占位改为完整版本创建 |
| knowledge-tree | `/knowledge-tree/{id}/rollback` | 新增端点 | 版本回滚 |
| ocr | `/ocr/upload` | 实现 Tesseract 处理 | 从占位改为实际 OCR |
| 所有列表端点 | `skip/limit` | 添加上限约束 | `limit ≤ 200` |

---

## 7. 前端设计增量

### 7.1 新增路由

| 路径 | 页面组件 | 角色 | 说明 |
|------|----------|------|------|
| `/self-study` | `SelfStudyPage` | STUDENT | 自学任务 |
| `/notifications` | `NotificationListPage` | ALL | 通知列表 |
| `/admin/database` | `DatabaseManagementPage` | SYS_ADMIN | 数据库管理 |
| `/parent/login` | `ParentLoginPage` | PARENT (公开) | 家长登录+注册 |
| `/parent/dashboard` | `ParentDashboardPage` | PARENT | 鼓励仪表盘 |
| `/parent/encourage` | `ParentEncouragePage` | PARENT | 发送鼓励 |
| `/parent/rewards` | `ParentRewardGoalsPage` | PARENT | 奖励目标管理 |
| `/parent/celebrations` | `ParentCelebrationsPage` | PARENT | 成长里程碑 |
| `/parent/profile` | `ParentProfilePage` | PARENT | 个人信息+关联 |

### 7.2 侧栏菜单更新

**学生侧栏** (更新后):
```
学习仪表盘 → 试题讲解 → 我的试卷 → 消灭错题 → 自学任务 → 通知
```

**教师侧栏** (增加):
```
仪表盘 → 试卷管理 → 班级管理 → 统计分析 → 学生进度 → 通知
```

**Question Admin 侧栏** (增加):
```
仪表盘 → 题库管理 → 出题管理 → 大纲/知识树 → 通知
```

**SysAdmin 侧栏** (增加):
```
仪表盘 → 系统配置 → 基础数据 → 管理员管理 → 数据库管理 → 通知
```

### 7.3 AppLayout 通知铃铛

- Header 右侧增加通知铃铛图标 (Badge 显示未读数)
- 点击展开下拉面板 (最近 10 条通知)
- 通知类型图标区分: 试卷/判分/错题/系统

### 7.4 组件迁移计划

| 原文件 | 迁移目标 | 变更 |
|--------|----------|------|
| `DashboardPage.tsx` (createElement) | JSX + TypeScript | 完整重写，接入真实 API |
| `MistakeBookPage.tsx` (createElement) | JSX + TypeScript | 语法转换，逻辑不变 |
| `MyPapersPage.tsx` (createElement) | JSX + TypeScript | 语法转换，逻辑不变 |
| `TeacherClassesPage.tsx` (createElement) | JSX + TypeScript | 语法转换，逻辑不变 |

---

## 8. 安全与合规设计

### 8.1 敏感配置隔离

```
backend/.env (不入 VCS):
  SECRET_KEY=xxx
  DATABASE_PASSWORD=xxx
  DEEPSEEK_API_KEY=sk-xxx
  REDIS_PASSWORD=xxx

backend/.env.example (入 VCS):
  SECRET_KEY=change-me-in-production
  DATABASE_PASSWORD=change-me
  DEEPSEEK_API_KEY=sk-your-key-here

sysconfig.json (入 VCS, 仅非敏感配置):
  database.server, database.port, database.database, database.user
  llm.current, llm.ollama.endpoint, llm.ollama.model
  export_max, system.log_level
```

### 8.2 速率限制

- 全局: 100 requests/min per IP (简单滑动窗口)
- 认证端点: 5 requests/min per IP (防暴力破解)
- LLM 生成端点: 2 requests/min per user (防滥用)

### 8.3 JWT 增强

- Access Token 有效期从 8 天调整为 60 分钟 (原 CLAUDE.md 声明 60min 但代码实际为 8 天)
- Refresh Token 保持 30 天
- JWT payload 增加 `session_id` 字段 (支持后续强制登出)

### 8.4 数据权限矩阵

| 资源 | STUDENT | TEACHER | QUESTION_ADMIN | SYS_ADMIN | PARENT |
|------|---------|---------|---------------|-----------|--------|
| 自己的试卷 | CRUD | — | — | — | — |
| 自己的答案 | Read | — | — | — | — |
| 自己的错题本 | Read/Create/Delete | — | — | — | — |
| 自己的进度 | Read | — | — | — | — |
| 子女进度 | — | — | — | — | Read |
| 子女错题本 | — | — | — | — | Read |
| 教师试卷 | — | CRUD(自己的) | Read | CRUD(全部) | — |
| 班级管理 | — | CRUD(自己的) | — | Read | — |
| 题目 | Read | Create/Edit | CRUD+Review | Read | — |
| 知识树 | — | Read | CRUD | Read | — |
| LLM 配置 | — | — | — | CRUD | — |
| 数据库管理 | — | — | — | Read | — |

---

## 9. 部署与运维设计

### 9.1 Docker Compose (V3.0)

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    depends_on: [postgres]
    volumes: ["./backend/sysconfig.json:/app/sysconfig.json"]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]

  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: edu_system
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]
```

### 9.2 健康检查增强

- `GET /health` 扩展返回:
  ```json
  {
    "status": "healthy",
    "version": "3.0",
    "database": "connected",
    "llm": {"provider": "deepseek", "model": "deepseek-v4-pro", "reachable": true},
    "uptime_seconds": 12345
  }
  ```

### 9.3 日志规范

- 结构化日志: JSON format
- 日志级别: DEBUG/INFO/WARNING/ERROR
- 关键操作日志:
  - 登录/登出 (含 IP)
  - 答题提交 + 判分结果
  - LLM 生成请求 + 结果
  - 配置变更
  - 错题本生成

---

## 10. 版本路线图

### V3.0 — 稳定化 + 核心功能补全

**目标**: 修复所有 P0/P1 问题，补全核心断裂功能，使平台可用于真实教学场景。

| 批次 | 内容 | 需求编号 |
|------|------|----------|
| Batch 1: P0 修复 | API 中间件、评分 Bug、导出实现、状态统一、仪表盘 | R3.1-01~05 |
| Batch 2: P1 修复 | 角色统一、密钥安全、事务、审计、分页 | R3.2-01~05 |
| Batch 3: P2 核心补全 | OCR (Tesseract)、Auth 统一、通知基础 | R3.3-01,04,06 |
| Batch 4: 前端新功能 | 自学任务 UI、DB 管理 UI、批量审批、高级筛选 | R3.4-01~04 |

### V3.1 — 深化功能

| 批次 | 内容 |
|------|------|
| Batch 5: 知识树版本化 | R3.3-02 完整实现 |
| Batch 6: 去重实现 | R3.3-03 完整实现 |
| Batch 7: 学习进度 | R3.4-05 可视化实现 |
| Batch 8: 家长端 — 鼓励者 | R3.4-06 完整实现 (鼓励/奖励/庆祝) |
| Batch 9: OCR 升级 | PaddleOCR GPU 集成 |
| Batch 10: 前端风格统一 | R3.3-05 全量 createElement 迁移 |
| Batch 11: WebSocket 通知 | 实时推送 |

### V3.2 — Phase 2 自学闭环 (长期)

| 内容 | 说明 |
|------|------|
| Celery 异步任务 | 替代当前同步 LLM 生成 |
| Redis 缓存层 | 热数据缓存 (题目、参考数据) |
| Airflow DAG | 自学任务编排 |
| LLM 微调 (LoRA) | 基于错题数据微调判分模型 |
| MLflow 模型管理 | 版本控制 + 性能追踪 |
| MinIO 对象存储 | OCR 文件 + 导出文件持久化 |

---

## 附录 A: 需求编号速查表

| 编号 | 优先级 | 简述 | 状态 |
|------|--------|------|------|
| R3.1-01 | P0 | 统一 API 响应格式 | 新增 |
| R3.1-02 | P0 | 修复评分引擎得分缩放 Bug | 新增 |
| R3.1-03 | P0 | 试卷导出 Word/PDF 实现完整 | 新增 |
| R3.1-04 | P0 | 统一状态字段为英文枚举 | 新增 |
| R3.1-05 | P0 | 学生仪表盘真实数据 | 新增 |
| R3.2-01 | P1 | 统一角色权限检查 | 新增 |
| R3.2-02 | P1 | 密钥安全存储 | 新增 |
| R3.2-03 | P1 | 事务完整性保障 | 新增 |
| R3.2-04 | P1 | 自动判分审计记录 | 新增 |
| R3.2-05 | P1 | 分页上限与默认值 | 新增 |
| R3.3-01 | P2 | OCR 集成 Tesseract | 新增 |
| R3.3-02 | P2 | 知识树版本化完整实现 | 新增 |
| R3.3-03 | P2 | 题目去重实现 | 新增 |
| R3.3-04 | P2 | 前端 Auth 状态统一 | 新增 |
| R3.3-05 | P2 | 前端代码风格统一 | 新增 |
| R3.3-06 | P2 | 通知系统基础实现 | 新增 |
| R3.4-01 | 新功能 | 自学任务前端实现 | 新增 |
| R3.4-02 | 新功能 | 数据库管理 UI | 新增 |
| R3.4-03 | 新功能 | 批量审批/拒绝题目 | 新增 |
| R3.4-04 | 新功能 | 高级筛选增强 | 新增 |
| R3.4-05 | 新功能 | 学习进度追踪与可视化 | 新增 |
| R3.4-06 | 新功能 | 家长端 — 鼓励者角色 | 新增 (重新设计) |

## 附录 B: 现有文档矛盾点清单

| # | 文档 A | 文档 B | 矛盾内容 | V3.0 处理 |
|---|--------|--------|----------|-----------|
| 1 | CLAUDE.md (access_token 60min) | 实际代码 (8天 = 60*24*8) | Access Token 有效期不一致 | 按 CLAUDE.md 修正为 60min |
| 2 | V2.0 需求 (OCR "已集成") | CLAUDE.md (PaddleOCR not integrated) | OCR 完成度描述矛盾 | 以代码为准，标注为未完成 |
| 3 | V2.1 需求 (去重端点) | 实际代码 (空实现) | 去重功能声称完成但未实现 | 以代码为准，R3.3-03 补全 |
| 4 | V2.1.1 需求 (版本化逻辑) | 实际代码 (模型存在逻辑缺失) | 版本化声称完成但逻辑缺失 | 以代码为准，R3.3-02 补全 |
| 5 | 前端 client.ts (自动解包) | 后端中间件 (未接入) | 前端依赖中间件但后端未启用 | R3.1-01 接入中间件 |
| 6 | V2.0 需求 (Redis 缓存) | 实际代码 (Redis 配置但未使用) | Redis 声称配置但无实际消费 | 延迟至 V3.2 |

---

## 附录 C: 各角色业务流与数据流

### C.1 学生角色 (STUDENT)

#### C.1.1 登录注册流程

```
注册: POST /auth/student/register
  ├─ 步骤1: 输入手机号 → GET /auth/captcha → 获取验证码图片
  ├─ 步骤2: 输入验证码 + 手机号 → POST /auth/student/verify
  │  └─ 后端: 校验captcha → 发送SMS验证码 (开发环境固定111111)
  ├─ 步骤3: 输入SMS验证码 + 姓名 + 年级 + 学校 → POST /auth/student/register
  │  └─ 后端: 校验SMS → 创建Student记录 → 返回JWT(access+refresh)
  └─ 数据库: students表新增1条记录

登录: POST /auth/student/login
  ├─ 步骤1: 输入手机号/用户名 → GET /auth/captcha
  ├─ 步骤2: 输入验证码 → POST /auth/student/verify → 返回verify_token
  ├─ 步骤3: 输入SMS验证码 → POST /auth/student/login → 返回JWT
  └─ localStorage: access_token, refresh_token, user_type=STUDENT
```

#### C.1.2 仪表盘 (⚠️ Mock数据)

```
GET /student/stats ← ❌ 端点不存在
  ├─ 当前: DashboardPage硬编码
  │  ├─ 完成试卷: 12 (假)
  │  ├─ 正确率: 85.5% (假)
  │  ├─ 错题数: 23 (假)
  │  └─ 最高分: 98 (假)
  └─ V3.0修复: R3.1-05 → 新增GET /student/stats端点
```

#### C.1.3 试题讲解 (典型题浏览)

```
GET /questions/typical?subject=&grade=
  ├─ 后端: SELECT * FROM questions WHERE is_typical=true AND subject=? AND grade_level@>grades ?
  ├─ 返回: [{id, title, question_type, difficulty, correct_answer, explanation}]
  └─ 前端: TypicalQuestionsPage
     ├─ 表格展示: 标题(省略) + 类型 + 难度 + 选项预览 + 正确答案 + 解析
     ├─ 可展开查看完整解析
     └─ 状态: ✅ 已实现
```

#### C.1.4 我的试卷 (核心闭环入口)

```
GET /exam-papers/my
  ├─ 后端: SELECT ep.*, COUNT(sub.id) as submission_count
  │         FROM exam_papers ep
  │         LEFT JOIN answer_submissions sub ON ep.id = sub.exam_paper_id
  │         WHERE sub.student_id = current_user.id
  │         GROUP BY ep.id
  ├─ 返回: [{id, title, subject, grade_level, status, submission_count}]
  └─ 前端: MyPapersPage
     ├─ 列表: 标题 + 学科 + 年级 + 状态 + 操作按钮组
     ├─ 状态筛选: 全部/未答/已答/已判
     └─ 操作 (每行6个图标按钮):
        ├─ 预览 → PaperPreviewDrawer
        ├─ 导出 → GET /exam-papers/{id}/export/word 或 pdf
        ├─ 打印 → window.open(/print-preview?paperId={id})
        ├─ 在线答题 → OnlineAnswerTab (模态框)
        ├─ 拍照/扫描 → PhotoScanTab (模态框)
        ├─ 生成错题 → POST /error-notebooks/generate
        └─ 删除 → DELETE /exam-papers/{id}
```

**在线答题数据流**:
```
1. 加载题目: GET /exam-papers/{id}/questions
   └─ 返回: [{id, title, question_type, correct_answer(JSON), score}]

2. 渲染答题界面:
   ├─ SINGLE_CHOICE: 单选按钮组 (解析correct_answer.options → Radio)
   ├─ MULTIPLE_CHOICE: 多选按钮组 (解析correct_answer.options → Checkbox)
   ├─ FILL_BLANK: 输入框 (数量=correct_answer.correct_answer.length)
   └─ SUBJECTIVE: TextArea

3. 提交答案: POST /answers
   body: {exam_paper_id, submission_type: "ONLINE", answers: [{question_id, student_answer}]}
   └─ 后端处理:
      ├─ 创建AnswerSubmission(status="GRADED")
      ├─ 循环每题 → judge_engine.grade(question, student_answer, score)
      │  ├─ 创建AnswerDetail(question_id, student_answer, is_correct, score_obtained, feedback)
      └─ 计算total_score + percentage
   └─ 返回: {submission_id, total_score, max_score, percentage}

4. 前端展示结果:
   ├─ 成功卡片: 总分 + 正确率 + 进度条
   └─ 状态: ✅ 已实现
```

**错题本生成数据流**:
```
POST /error-notebooks/generate
body: {exam_paper_id, student_id}
   └─ 后端(mistake_service):
      ├─ 查询AnswerSubmission WHERE is_correct=false
      ├─ 按question_id去重 (保留最新)
      ├─ 分类错误类型:
      │  ├─ 未作答: student_answer为空
      │  ├─ 概念错误: 选择题0%匹配
      │  ├─ 部分正确: 选择题部分匹配
      │  ├─ 记忆错误: 填空题不匹配
      │  └─ 理解偏差: 默认分类
      ├─ 创建ErrorNotebook(title, student_id, exam_paper_id)
      ├─ 创建ErrorNotebookQuestion(original_question_id, error_type, explanation)
      └─ 返回: {notebook_id, question_count}
```

#### C.1.5 错题本管理 (消灭错题)

```
GET /error-notebooks/student/{userId}?start_date=&end_date=
  ├─ 返回: [{id, title, question_count, status, created_at}]

GET /error-notebooks/{notebook_id}
  ├─ 返回: 错题详情 + 练习题
  ├─ 每条: original_question + student_answer + correct_answer + practice_question

POST /error-notebooks/{id}/practice
  ├─ 后端: llm_service.generate_practice_question()
  │  └─ 输入: 原题+学生答案+错误类型 → LLM生成变体练习题
  └─ 返回: {practice_question_id}

DELETE /error-notebooks/{id}
  └─ 删除错题本 + 关联题目

手动录入: POST /error-notebooks/manual-entry
  body: {question_title, subject, question_type, error_type, student_answer, correct_answer}
  └─ 创建Question + ErrorNotebook + ErrorNotebookQuestion

批量操作:
  ├─ 批量生成练习: Promise.all POST /error-notebooks/{id}/practice
  ├─ 批量删除: Promise.all DELETE /error-notebooks/{id}
  └─ 打印未完成: 生成HTML + window.print()
```

#### C.1.6 个人信息管理

```
GET /auth/profile → 返回当前用户信息
PUT /auth/profile → 更新full_name/email/grade/school
PUT /auth/profile/phone → 更新手机号(需SMS验证)
```

#### C.1.7 学生数据流全景

```
┌───────────────────────────────────────────────────┐
│  学生侧栏菜单                                      │
│  学习仪表盘 → 试题讲解 → 我的试卷 → 消灭错题       │
├───────────────────────────────────────────────────┤
│                                                    │
│  [仪表盘] ← ⚠️ Mock (V3.0修复)                    │
│                                                    │
│  [试题讲解] ← GET /questions/typical               │
│                                                    │
│  [我的试卷] ← GET /exam-papers/my                  │
│     ├─ 在线答题 → POST /answers → 自动判分         │
│     ├─ 拍照录入 → ⚠️ Mock OCR                     │
│     └─ 生成错题 → POST /error-notebooks/generate   │
│                                                    │
│  [消灭错题] ← GET /error-notebooks/student/{id}    │
│     ├─ 强化练习 → POST /error-notebooks/{id}/practice │
│     └─ 手动录入 → POST /error-notebooks/manual-entry │
│                                                    │
│  [个人信息] ← GET/PUT /auth/profile                │
└───────────────────────────────────────────────────┘

核心闭环数据流:
  试卷 → 答题 → 判分 → 错题收集 → 强化练习 → (循环)
  exam_papers → answer_submissions → answer_details → error_notebooks → practice_questions
```

**学生角色缺失功能**:
- ❌ GET /student/stats (真实仪表盘数据)
- ❌ OCR真实集成 (拍照录入)
- ❌ 自学任务页面 (/self-study路由不存在)
- ❌ 通知铃铛 (Header无通知组件)
- ❌ 学习进度追踪

---

### C.2 教师角色 (TEACHER)

#### C.2.1 登录流程

```
POST /auth/admin/login
  ├─ 步骤1: 选择角色(TEACHER=0) + 输入用户名+密码 → GET /auth/captcha
  ├─ 步骤2: 输入验证码 → POST /auth/admin/verify
  │  └─ 后端: 校验username+password+captcha → 返回verify_token + user_info
  ├─ 步骤3: 输入SMS验证码 → POST /auth/admin/login
  │  └─ 后端: 校验verify_token + SMS → 返回JWT(type=TEACHER)
  └─ 默认账号: t01 / th0001
```

#### C.2.2 仪表盘

```
GET /classes → 教师班级列表
GET /teacher/stats/papers → 教师试卷列表
  ├─ 统计卡片: 班级数 + 学生总数 + 试卷数 + 题库(固定110)
  ├─ 班级表格(前5条): 名称+学科+年级+学生数+状态
  ├─ 试卷表格(前5条): 标题+状态
  └─ 快捷操作卡片: 新建试卷/AI出题/班级管理/统计/考纲/题库
```

#### C.2.3 试卷管理 (核心业务)

```
创建试卷: POST /exam-papers
  ├─ 前端: PaperEditModal → 输入title/subject/grade/total_score/duration
  └─ 后端:
     ├─ 创建ExamPaper记录(status=DRAFT)
     ├─ 若提交含题目 → 同时创建exam_paper_questions关联
     └─ ⚠️ 缺陷: 无事务回滚 (R3.2-03修复)

编辑试卷: PUT /exam-papers/{id}
  └─ PaperEditModal → 更新字段 + 题目列表管理

删除试卷: DELETE /exam-papers/{id}
  ├─ ⚠️ 缺陷: 需先删除子记录(answer_submissions, exam_paper_questions等)
  └─ ⚠️ 权限缺陷: STUDENT不应被允许删除 (R3.2-01修复)

预览试卷: GET /exam-papers/{id}/preview
  └─ 返回试卷完整信息 + 题目列表

导出试卷:
  ├─ Word: GET /exam-papers/{id}/export/word
  │  └─ ⚠️ 空壳实现 (R3.1-03修复)
  ├─ PDF: GET /exam-papers/{id}/export/pdf
  │  └─ ⚠️ 空壳实现 (R3.1-03修复)
  └─ 前端: fetch → Blob → saveAs

打印预览: /print-preview?paperId={id}
  ├─ 无需认证
  ├─ 加载试卷+题目 → 按题型分组渲染
  └─ 500ms后自动window.print()

发布试卷: POST /exam-papers/{id}/publish
  └─ status: DRAFT → PUBLISHED
```

**试卷题目管理数据流**:
```
GET /exam-papers/{id}/questions → 获取题目列表
POST /exam-papers/{id}/questions → 添加题目到试卷
  body: {question_ids: [], scores: []}
  └─ 创建exam_paper_questions关联(position=序号, score=分值)
DELETE /exam-papers/{id}/questions/{qid} → 从试卷移除题目
```

#### C.2.4 题目管理

```
创建题目: POST /questions
  ├─ QuestionEditModal → 动态表单(按题型切换)
  ├─ correct_answer JSON格式:
  │  ├─ SINGLE: {options:[{label,text}], correct_answer:"A"}
  │  ├─ MULTIPLE: {options:[{label,text}], correct_answer:["A","C"]}
  │  ├─ FILL: {options:null, correct_answer:["答案1","答案2"]}
  │  └─ SUBJECTIVE: {options:null, correct_answer:{keywords:[...], max_score:10}}
  └─ grade_level JSONB: {scope, grades[], chapter?, knowledge_points?}

搜索题目: GET /questions/search
  ├─ 参数: subject/grade/question_type/difficulty/keyword/knowledge_point/is_typical
  └─ 返回: 分页列表 + 总数

标记典型题: POST /questions/{id}/typical
  └─ is_typical: false → true

批量操作:
  ├─ 导入: POST /questions/batch-import (JSON格式)
  ├─ 导出: GET /questions/export (筛选条件) 或 POST /questions/export (指定ID)
  └─ 删除: DELETE /questions/{id}
```

#### C.2.5 班级管理

```
创建班级: POST /classes
  body: {name, subject, grade_level, description}
  └─ teacher_id = current_user.id

添加学生到班级:
  ├─ 方式1: 从现有学生选择
  │  └─ GET /classes/{id}/available-students → 搜索下拉
  │  └─ POST /classes/{id}/students → {student_id}
  ├─ 方式2: 手动创建新学生
  │  └─ POST /classes/{id}/students → {phone, full_name, grade, school}
  │  └─ 后端自动生成: username="stu_"+8位hex, password="111111"
  └─ 创建class_students关联记录

编辑学生信息: PUT /classes/{id}/students/{student_id}
  └─ 更新: full_name, email, grade, school (不编辑phone)

移除学生: DELETE /classes/{id}/students/{student_id}
  └─ 删除class_students关联 (不删除Student记录)
```

#### C.2.6 统计分析

```
试卷统计: GET /teacher/stats/paper/{paper_id}
  ├─ 查询: 试卷所有题目 + 所有学生提交
  ├─ 计算: 每题attempted/correct_count/correct_rate
  ├─ 选项分布: 统计每个选项被选次数 + 百分比
  └─ 前端: PaperStatsPage
     ├─ 统计卡片: 参与学生数 + 试题数 + 正确率
     └─ 表格: 位置+题目+分值+作答数+正确率(进度条)+选项分布(Tag)

题目统计: GET /teacher/stats/questions?subject=&question_type=
  ├─ 跨试卷汇总: 教师所有试卷中所有题目的答题情况
  ├─ 聚合: attempted_count + correct_rate + 选项分布
  └─ 前端: QuestionStatsPage
     └─ 表格: 题目+作答次数+正确率+选项分布
```

#### C.2.7 教师数据流全景

```
┌───────────────────────────────────────────────────┐
│  教师侧栏菜单                                      │
│  仪表盘 → 试卷管理 → 班级管理 → 统计分析            │
│  → 题库管理 → 出题管理 → 考纲/知识树               │
├───────────────────────────────────────────────────┤
│                                                    │
│  [仪表盘] ← GET /classes + GET /teacher/stats      │
│                                                    │
│  [试卷管理] ← CRUD /exam-papers                    │
│     ├─ 预览 → GET /{id}/preview                    │
│     ├─ 导出 → ⚠️ Word/PDF空壳                     │
│     ├─ 打印 → /print-preview                       │
│     └─ 发布 → POST /{id}/publish                   │
│                                                    │
│  [班级管理] ← CRUD /classes + 学生子CRUD           │
│                                                    │
│  [统计分析] ← GET /teacher/stats/paper + questions │
│                                                    │
│  [题库管理] ← CRUD /questions + 批量操作            │
│                                                    │
│  [出题管理] ← POST /question-admin/generate (LLM)  │
│                                                    │
│  [考纲/知识树] ← CRUD /question-admin/syllabi      │
│     ├─ ⚠️ 知识提取为Mock                           │
│     └─ ⚠️ 版本化逻辑缺失                           │
└───────────────────────────────────────────────────┘
```

**教师角色缺失功能**:
- ❌ 试卷导出Word/PDF真实实现
- ❌ 试卷分配到班级 (无exam_paper-class关联表)
- ❌ 学生进度追踪 (/teacher/student-progress)
- ❌ 通知铃铛
- ⚠️ 权限检查不严格 (STUDENT可操作教师端点)
- ⚠️ 班级管理仅教师自己的班级
- ⚠️ 仪表盘题库统计为固定值

---

### C.3 题库管理员角色 (QUESTION_ADMIN)

#### C.3.1 登录流程

```
POST /auth/admin/login
  ├─ 选择角色: QUESTION_ADMIN(1)
  ├─ 默认账号: tk01 / tk0001
  └─ JWT type=QUESTION_ADMIN
```

#### C.3.2 仪表盘

```
GET /question-admin/stats
  ├─ 返回: {total, by_status, by_type, by_difficulty, by_source, pending_items}
  ├─ 统计卡片: 总题数 + 已通过 + 待审核 + 需复审
  ├─ 分布图(柱状): 题型/难度/来源
  ├─ 待审核表格(前5条): 标题+类型+难度+快捷通过/拒绝
  └─ 快捷入口: 题库/考纲/AI出题/试卷
```

#### C.3.3 知识体系管理 (考纲+知识树)

```
考纲CRUD:
  ├─ 创建: POST /question-admin/syllabi
  │  body: {title, grade_level, province, subject}
  │  └─ 创建Syllabus(status=DRAFT)
  ├─ 列表: GET /question-admin/syllabi
  ├─ 编辑: PUT /question-admin/syllabi/{id}
  │  └─ 更新knowledge_tree/content (JSON)
  ├─ 删除: DELETE /question-admin/syllabi/{id}
  └─ 批量导入: POST /question-admin/syllabi (Excel解析)
     └─ XLSX库解析 → JSON预览 → 批量创建

知识提取:
  POST /question-admin/syllabi/{id}/extract-knowledge
  ├─ ⚠️ 当前为Mock实现 (_mock_extract_knowledge)
  └─ V3.0计划: R3.3-02 真实LLM调用 + 版本化逻辑

知识树管理:
  ├─ KnowledgeTreePage → Ant Design Tree组件
  ├─ 拖拽修改 → PUT /knowledge-tree/{node_id}
  └─ ⚠️ 版本逻辑缺失 (R3.3-02补全)
```

#### C.3.4 试题生成 (LLM + Web爬取 + OCR导入)

**LLM生成数据流**:
```
POST /question-admin/generate
  params: {knowledge_point, difficulty, question_type, count, subject, grade_level, model, provider}
  └─ 后端(llm_service):
     ├─ 加载sysconfig.json → 获取LLM配置
     ├─ 构建Prompt模板(按题型)
     ├─ 调用Ollama/DeepSeek API
     │  ├─ Ollama: POST /api/generate {model, prompt, stream:false}
     │  └─ DeepSeek: POST /anthropic/v1/messages (Anthropic格式)
     ├─ 解析LLM返回JSON
     │  ├─ 处理markdown代码块包裹
     │  ├─ 处理非JSON格式回复
     │  └─ 提取题目数组
     ├─ 去重: _dedup_questions() (标题比对)
     ├─ 创建QuestionTask记录(status=COMPLETED)
     ├─ 创建N条Question记录(source=LLM_GENERATED, review_status=PENDING)
     └─ 返回: {ok, count, questions[], task_id, model}
```

**Web爬取数据流**:
```
POST /question-admin/scrape
  params: {knowledge_point, subject, grade, question_type, difficulty, count}
  └─ 后端(scraper):
     ├─ Bing搜索: query = knowledge_point + subject + grade + type
     ├─ 提取搜索结果片段
     ├─ LLM格式化: 将片段转为结构化题目JSON
     ├─ 创建Question记录(source=SCRAPED, review_status=PENDING)
     └─ ⚠️ Bing搜索可能被限流
```

**试卷OCR导入数据流**:
```
POST /question-admin/import-paper (multipart form-data)
  ├─ 上传试卷图片 → base64编码
  ├─ 调用Ollama视觉模型(llava/minicpm-v等)
  │  └─ PAPER_IMPORT_PROMPT → 要求JSON格式输出
  ├─ 解析LLM返回 → 提取题目数组
  └─ 返回: {questions: [{title, type, options, correct_answer, explanation}]}

POST /question-admin/import-confirm
  body: {questions: [...], subject, grade_level}
  ├─ 循环创建Question记录(source=OCR_UPLOAD, review_status=PENDING)
  └─ 返回: {ok, count, created_ids}
```

#### C.3.5 试题审核

```
待审核列表: GET /question-admin/pending
  ├─ 查询: review_status IN (PENDING, NEEDS_REVIEW)
  ├─ 支持过滤: subject/difficulty/source/keyword
  └─ 返回分页列表

单个审核:
  ├─ 通过: POST /question-admin/{id}/approve
  │  └─ review_status: PENDING → APPROVED
  │  └─ reviewed_by + reviewed_at 填充
  └─ 拒绝: POST /question-admin/{id}/reject
     body: {reason: "题目描述不清晰"}
     └─ review_status: PENDING → REJECTED
     └─ is_active → false (逻辑删除)

批量审核 (V3.0新增 R3.4-03):
  ├─ POST /question-admin/batch-approve → {question_ids: []}
  └─ POST /question-admin/batch-reject → {question_ids: [], reason: ""}
```

#### C.3.6 试题去重

```
POST /question-admin/deduplicate
  params: {knowledge_point, difficulty}
  ├─ 查询: review_status=APPROVED的试题
  ├─ 按title[:20]分组 → 返回重复组
  └─ ⚠️ 仅基于标题前20字符 (R3.3-03: SimHash语义去重)
```

#### C.3.7 题库管理员数据流全景

```
┌───────────────────────────────────────────────────┐
│  题库管理员侧栏菜单                                │
│  仪表盘 → 题库管理 → 出题管理 → 考纲/知识树         │
├───────────────────────────────────────────────────┤
│                                                    │
│  [仪表盘] ← GET /question-admin/stats              │
│     ├─ 统计卡片 + 分布图                           │
│     └─ 待审核快捷通过/拒绝                         │
│                                                    │
│  [题库管理] ← CRUD /questions                      │
│     ├─ 批量导入/导出                               │
│     ├─ 标记典型题                                  │
│     └─ 待审核列表 + 审核                           │
│                                                    │
│  [出题管理] ← POST /question-admin/generate        │
│     ├─ LLM生成 (Ollama/DeepSeek)                   │
│     ├─ Web爬取 (Bing+LLM格式化)                    │
│     ├─ OCR试卷导入 (视觉模型)                       │
│     └─ 去重检测 (⚠️ 仅标题比对)                    │
│                                                    │
│  [考纲/知识树] ← CRUD /question-admin/syllabi      │
│     ├─ Excel批量导入                               │
│     ├─ ⚠️ 知识提取为Mock                           │
│     ├─ ⚠️ 版本化逻辑缺失                           │
│     └─ KnowledgeTreePage (拖拽编辑)                │
└───────────────────────────────────────────────────┘
```

**题库管理员缺失功能**:
- ⚠️ LLM知识提取为Mock (需真实实现)
- ⚠️ 知识树版本化逻辑缺失
- ⚠️ 去重仅标题比对 (需SimHash语义去重)
- ❌ 批量审核UI (前端仅单条操作按钮)
- ❌ 生成任务进度实时展示
- ❌ 生成失败重试机制
- ❌ 试题修改后自动再审核

---

### C.4 系统管理员角色 (SYS_ADMIN)

#### C.4.1 登录流程

```
POST /auth/admin/login
  ├─ 选择角色: SYS_ADMIN(2)
  ├─ 默认账号: SYSAdmin / SYSPass
  └─ JWT type=SYS_ADMIN
```

#### C.4.2 仪表盘

```
GET /admin/dashboard/stats (推断端点)
  ├─ 统计卡片: 总用户 + 总题目 + 总试卷 + 总班级
  ├─ 系统信息: PostgreSQL版本 + DB大小(MB) + 表数 + 记录数
  ├─ LLM状态: 当前提供商 + 当前模型 + 连接状态
  └─ 快捷入口: 系统配置/管理员管理/基础数据
```

#### C.4.3 管理员账号管理

```
创建: POST /auth/admin/create
  body: {username, password, full_name, admin_type, subjects, grade_level}
  ├─ 权限: require_role("SYS_ADMIN")
  ├─ 密码加密: bcrypt.hash(password)
  └─ 创建Admin记录(created_by=当前SYS_ADMIN.id)

列表: GET /auth/admin/list
  params: {name, admin_type, is_active, subject, grade}
  ├─ 权限: require_role("SYS_ADMIN")
  └─ 返回: 分页列表 + 角色名称映射

编辑: PUT /auth/admin/{id}
  └─ 更新: full_name/email/phone/qualification/subjects/grade_level/is_active

停用: PUT /auth/admin/{id} (is_active=false)
  └─ Admin.is_active: true → false

删除: DELETE /auth/admin/{id}
  └─ 真正删除 (db.delete)
```

#### C.4.4 LLM配置管理

```
查看: GET /admin/llm/config → 读sysconfig.json
  ├─ 返回: {llm: {current, ollama:{endpoint,model,available_models}, deepseek:{endpoint,api_key,model}}}

配置Ollama: PUT /admin/llm/config (provider=ollama)
  ├─ 写入: llm.ollama.endpoint + llm.ollama.model
  ├─ 测试: POST /admin/llm/config/test (provider=ollama)
  │  └─ GET /api/tags → 返回available_models列表

配置DeepSeek: PUT /admin/llm/config (provider=deepseek)
  ├─ 写入: llm.deepseek.endpoint + llm.deepseek.api_key + llm.deepseek.model
  ├─ ⚠️ API Key明文存储 (R3.2-02修复)
  ├─ 测试: POST /admin/llm/config/test (provider=deepseek)
  │  └─ POST DeepSeek API → 验证连接

切换提供商: PUT /admin/llm/config → 设置llm.current = "ollama"/"deepseek"

导出限制: PUT /admin/llm/export-max → 设置export_max值

其他配置: PUT /admin/llm/section-config
  ├─ grading: {max_concurrent, model}
  ├─ ocr: {engine, concurrency, threshold}
  ├─ mistake_book: {practice_question_count}
  └─ system: {log_level, backup_enabled}
```

#### C.4.5 参考数据管理

```
全局加载: GET /reference/all → 返回8类参考数据
单项查询: GET /reference/{type}
  ├─ question-types → QuestionType表
  ├─ difficulty-levels → DifficultyLevel表
  ├─ grade-levels → GradeLevel表
  ├─ paper-statuses → PaperStatus表
  ├─ error-types → ErrorType表
  ├─ question-sources → QuestionSource表
  ├─ provinces → Province表
  └─ subjects → Subject表

创建: POST /reference/{type} → 新增参考记录
编辑: PUT /reference/{type}/{id} → 更新字段
停用: DELETE /reference/{type}/{id} → is_active=false

科目管理 (特殊):
  ├─ GET /subjects/all → 全部科目(含停用)
  ├─ POST /subjects → 创建科目(code+name+category)
  ├─ PUT /subjects/{id} → 编辑
  └─ DELETE /subjects/{id} → 停用
```

#### C.4.6 数据库管理

```
GET /database/tables → 列出所有表
GET /database/tables/{table_name} → 表schema详情
  ├─ ⚠️ 仅SYS_ADMIN可访问
  └─ ❌ 前端无UI (R3.4-02: 新增DatabaseManagementPage)
```

#### C.4.7 系统管理员数据流全景

```
┌───────────────────────────────────────────────────┐
│  系统管理员侧栏菜单                                │
│  仪表盘 → 系统配置 → 基础数据 → 管理员管理          │
├───────────────────────────────────────────────────┤
│                                                    │
│  [仪表盘] ← GET /admin/dashboard/stats             │
│     ├─ 系统信息 + LLM状态                          │
│     └─ 快捷入口卡片                                │
│                                                    │
│  [系统配置] ← GET/PUT /admin/llm/config            │
│     ├─ LLM提供商切换 (Ollama/DeepSeek)             │
│     ├─ 连接测试                                    │
│     ├─ ⚠️ API Key明文存储                          │
│     └─ 导出限制 + 分段配置                          │
│                                                    │
│  [基础数据] ← CRUD /reference/{type}               │
│     ├─ 题型/难度/年级/省份/...管理                  │
│     └─ 科目管理 (特殊CRUD)                          │
│                                                    │
│  [管理员管理] ← CRUD /auth/admin                    │
│     ├─ 创建教师/题库管理员                          │
│     ├─ 分配科目+年级                               │
│     ├─ 启用/停用                                   │
│     └─ 删除                                        │
│                                                    │
│  ❌ [数据库管理] → 无前端UI                         │
│  ❌ [通知] → 无铃铛组件                             │
└───────────────────────────────────────────────────┘
```

**系统管理员缺失功能**:
- ❌ 数据库管理前端UI
- ⚠️ API Key明文存储 (安全风险)
- ❌ 操作审计日志
- ❌ 系统通知推送
- ❌ 数据备份恢复实现
- ❌ DB配置热加载 (需重启)

---

### C.5 家长角色 (PARENT) — V3.0 鼓励者设计

#### C.5.1 设计理念

家长是**鼓励者 (Encourager)**，不是**监督者 (Supervisor)**。
- 只看正面趋势（努力、成长），不看分数和错题
- 通过鼓励消息和奖励目标激励学生
- 系统自动检测成就事件，提示家长庆祝

#### C.5.2 注册与关联流程

```
家长注册 (自助):
  POST /auth/parent/register
  ├─ 输入手机号 → SMS验证 → 填写姓名
  ├─ 创建 Parent 记录 → JWT(type=PARENT)
  └─ 前端路由: /parent/login → ParentLoginPage

亲子关联 (邀请码):
  学生: POST /students/generate-invite-code → 生成6位码 (7天有效)
  家长: POST /parent/link-student {invite_code: "A3K7M2"} → 关联成功
  ├─ 每位学生最多关联4位家长
  └─ 通过 parent_student_links 表管理 (替代 parents.student_ids JSON)
```

#### C.5.3 家长功能数据流

```
┌───────────────────────────────────────────────────┐
│  家长侧栏菜单                                       │
│  鼓励仪表盘 → 成长里程碑 → 发送鼓励 → 奖励目标       │
├───────────────────────────────────────────────────┤
│                                                    │
│  [鼓励仪表盘] ← GET /parent/children               │
│     ├─ 正面统计 (努力指标+成长趋势, 无分数)           │
│     ├─ 庆祝横幅 (待庆祝事件)                        │
│     └─ 近7天活跃度图                                │
│                                                    │
│  [成长里程碑] ← GET /parent/celebration-opportunities │
│     ├─ 系统自动检测: 完成试卷/连续学习/正确率提升     │
│     └─ 快捷鼓励按钮                                 │
│                                                    │
│  [发送鼓励] ← POST /parent/encouragements          │
│     ├─ 预置模板 (5类~20条) + 自定义消息              │
│     └─ 鼓励出现在学生仪表盘                         │
│                                                    │
│  [奖励目标] ← POST /parent/reward-goals            │
│     ├─ 设定可达目标+奖励描述                        │
│     ├─ 系统自动追踪进度 (答题/判分时更新)            │
│     └─ 达成后自动通知双方                           │
└───────────────────────────────────────────────────┘

数据实体 (新增5表):
  parent_student_links  — 亲子关联 (替代 parents.student_ids)
  encouragements        — 鼓励消息
  reward_goals          — 奖励目标
  celebration_events    — 庆祝里程碑
  encouragement_templates — 鼓励语模板 (种子数据~20条)
```

---

### C.6 跨角色共享数据流

#### C.6.1 认证与JWT刷新

```
所有角色共享:
  ├─ GET /auth/captcha → SVG验证码 + captcha_key
  ├─ POST /auth/refresh → JWT刷新 (access_token过期时自动触发)
  └─ 前端: client.ts axios拦截器
     ├─ 请求: 自动添加Authorization: Bearer {token}
     ├─ 401响应: 自动POST /auth/refresh → 更新token → 重试原请求
     └─ 刷新失败: 重定向到/login
```

#### C.6.2 参考数据缓存

```
所有角色共享:
  ├─ GET /reference/all → 一次性加载8类参考数据
  └─ 前端: useReferenceValues hook (模块级单例缓存)
     ├─ 首次调用触发fetch → 缓存到模块级变量
     ├─ 后续调用返回缓存
     └─ 工具函数: toLabelMap() / toSelectOptions() / toColorMap()
```

#### C.6.3 通知系统 (V3.0新增 R3.3-06)

```
所有角色共享:
  ├─ GET /notifications → 当前用户通知列表
  ├─ POST /notifications/{id}/read → 标记已读
  └─ 触发场景:
     ├─ 判分完成 → 通知学生
     ├─ 错题本生成 → 通知学生
     ├─ 试卷发布 → 通知班级学生
     └─ 系统更新 → 通知管理员
  └─ 前端: AppLayout Header铃铛 + /notifications列表页
```

#### C.6.4 核心闭环数据流 (全角色协同)

```
┌─────────────────────────────────────────────────────────────┐
│  "测验 → 整理错题 → 订正 → 加深训练" 完整闭环              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [题库管理员] 创建/审核题目                                   │
│     ├─ LLM生成 → PENDING → 审核 → APPROVED                  │
│     └─ Question.review_status=APPROVED                       │
│              ↓                                               │
│  [教师] 组卷 + 发布                                          │
│     ├─ 选择APPROVED题目 → 创建ExamPaper                      │
│     ├─ 添加exam_paper_questions关联                          │
│     ├─ status: DRAFT → PUBLISHED                             │
│     └─ (V3.0: 通知班级学生)                                  │
│              ↓                                               │
│  [学生] 答题 + 查看结果                                      │
│     ├─ GET /exam-papers/my → 选择试卷                        │
│     ├─ OnlineAnswerTab → POST /answers                       │
│     ├─ 后端: judge_engine自动判分                             │
│     │  ├─ 创建AnswerSubmission + AnswerDetail                │
│     │  ├─ (V3.0: 创建GradingRecord审计)                     │
│     │  └─ (V3.0: 通知学生判分完成)                            │
│     └─ 前端: 显示总分 + 正确率                               │
│              ↓                                               │
│  [学生/教师] 生成错题本                                       │
│     ├─ POST /error-notebooks/generate                        │
│     ├─ mistake_service: 收集错误 + 分类                      │
│     │  ├─ 未作答/概念错误/记忆错误/理解偏差                   │
│     └─ 创建ErrorNotebook + ErrorNotebookQuestion             │
│     │  └─ (V3.0: 通知学生错题本生成)                          │
│              ↓                                               │
│  [学生] 强化练习                                              │
│     ├─ POST /error-notebooks/{id}/practice                   │
│     ├─ llm_service: 生成变体练习题                           │
│     └─ ErrorNotebookQuestion.practice_question_id            │
│              ↓                                               │
│  [教师/家长] 查看进度 (V3.0新增)                             │
│     ├─ GET /teacher/student-progress/{id}                    │
│     ├─ GET /parent/child/{id}/progress                       │
│     └─ 聚合: answer_submissions + answer_details             │
│     └─ 可视化: 正确率趋势 + 知识点雷达图                     │
│              ↓                                               │
│  (循环) → 新一轮测验                                         │
└─────────────────────────────────────────────────────────────┘

数据实体流转:
  Question(APPROVED)
    → exam_paper_questions(关联)
    → ExamPaper(PUBLISHED)
    → AnswerSubmission + AnswerDetail(判分)
    → ErrorNotebook + ErrorNotebookQuestion(错题)
    → Question(练习题, LLM_GENERATED)
    → 新AnswerSubmission + AnswerDetail(练习判分)
    → (循环)

关键数据库表联动:
  questions ← exam_paper_questions → exam_papers
    ↓
  answer_submissions ← answer_details → questions
    ↓
  error_notebooks ← error_notebook_questions → questions(原题+练习题)
    ↓
  (新一轮) answer_submissions ← answer_details
```