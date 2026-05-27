# 家长角色 (Parent as Encourager) — 全新设计与实现

## Context

现有 `nDocs/requirements-v3.0.md` 中的 R3.4-06 将家长设计为"被动监督者"（只读查看进度/错题），这与用户新的核心理念矛盾。用户明确要求：

> **家长在系统中不是监督学生学习的角色，而是鼓励学习的角色，可以是设定或提供鼓励的角色。**

需要：
1. 更新 `requirements-v3.0.md` 中的 R3.4-06，重新定义家长角色
2. 全新设计并实现家长功能（注册/关联/鼓励/奖励/庆祝）
3. 更新相关设计文档（database-design.md, backend-api-plan.md, frontend-component-plan.md, 执行路线图.md）

**设计哲学**: 家长是**鼓励者 (Encourager)**，不是**监督者 (Supervisor)**

| 家长应看到 | 家长不应看到 |
|-----------|-------------|
| 完成了多少练习、坚持了多少天 | 具体考了多少分、排第几名 |
| 正确率提升了、知识点进步了 | 错了哪些题、哪些知识点不会 |
| 可以发送鼓励、设定奖励 | 实时监控答题过程、查看详细答案 |
| 里程碑成就、连续打卡 | 错误趋势、落后排名 |

**注册方式**: 家长自助手机号+SMS注册，学生生成邀请码，家长输入邀请码完成关联
**实施策略**: 一次性全部实现

---

## 一、文档更新

### 1.1 更新 `nDocs/requirements-v3.0.md`

替换 R3.4-06 内容（行 429-443），新增以下需求：

```
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

**后端端点**:
- POST `/auth/parent/register` — 家长注册
- POST `/auth/parent/login` — 家长登录
- POST `/parent/link-student` — 输入邀请码关联子女
- DELETE `/parent/unlink-student/{student_id}` — 解除关联
- GET `/parent/children` — 关联子女列表
- GET `/parent/child/{student_id}/positive-stats` — 正面趋势数据
- GET `/parent/celebration-opportunities` — 待庆祝事件
- POST `/parent/encouragements` — 发送鼓励
- GET `/parent/encouragements` — 已发送鼓励列表
- GET `/encouragements/received` — 学生收到鼓励（STUDENT角色）
- POST `/encouragements/{id}/read` — 标记已读（STUDENT角色）
- POST `/parent/reward-goals` — 创建奖励目标
- GET `/parent/reward-goals` — 奖励目标列表
- PUT `/parent/reward-goals/{id}` — 更新奖励目标
- POST `/parent/reward-goals/{id}/claim` — 标记已兑现
- GET `/parent/encouragement-templates` — 鼓励语模板
- POST `/students/generate-invite-code` — 生成邀请码（STUDENT角色）

**前端页面**:
- `/parent/login` — ParentLoginPage (登录+注册)
- `/parent/dashboard` — ParentDashboardPage (正面统计+庆祝横幅)
- `/parent/encourage` — ParentEncouragePage (模板+自定义+历史)
- `/parent/rewards` — ParentRewardGoalsPage (创建+进度+兑现)
- `/parent/celebrations` — ParentCelebrationsPage (成就时间线)
- `/parent/profile` — ParentProfilePage (个人信息+关联管理)

**验收**: 家长注册 → 输入邀请码关联 → 查看正面趋势 → 发送鼓励 → 设定奖励目标 → 学生端收到鼓励 → 目标达成后自动通知双方。
```

同步更新：
- 行 599-601 的 API 表格（扩展为17个端点）
- 行 630-631 的前端路由表（扩展为6个页面）
- 行 799 的版本路线图
- 行 842 的需求变更表
- 附录 C.5（行 1541-1591）完整重写

### 1.2 更新 `nDocs/database-design.md`

新增第 8 节"家长鼓励域"，记录 5 个新表 + students 表变更。

### 1.3 更新 `nDocs/backend-api-plan.md`

新增 parent 模块端点清单（17个端点）。

### 1.4 更新 `nDocs/frontend-component-plan.md`

新增 PARENT 角色页面清单（6个页面）+ 学生端鼓励卡片集成。

### 1.5 更新 `nDocs/执行路线图.md`

新增 R3.4-06 实施任务项（状态：进行中）。

---

## 二、数据库设计

### 2.1 新增 5 张表

#### `parent_student_links` (亲子关联)
| 列 | 类型 | 说明 |
|----|------|------|
| id | String(36) PK | UUID |
| parent_id | String(36) FK→parents.id | 家长 |
| student_id | String(36) FK→students.id | 学生 |
| relationship | String(20) nullable | 关系标签(父亲/母亲/其他) |
| invite_code_used | String(6) NOT NULL | 使用的邀请码 |
| is_active | Boolean default true | 是否有效 |
| linked_at | DateTime(tz) | 关联时间 |
| unlinked_at | DateTime(tz) nullable | 解除时间 |
- UniqueConstraint(parent_id, student_id)

#### `encouragements` (鼓励消息)
| 列 | 类型 | 说明 |
|----|------|------|
| id | String(36) PK | UUID |
| parent_id | String(36) FK→parents.id | 发送家长 |
| student_id | String(36) FK→students.id | 接收学生 |
| encouragement_type | String(20) CHECK | TEMPLATE/CUSTOM/CELEBRATION/REWARD_COMPLETE |
| title | String(200) nullable | 标题 |
| message | Text NOT NULL | 鼓励内容 |
| template_id | String(36) FK nullable | 引用模板 |
| celebration_event_id | String(36) FK nullable | 关联庆祝事件 |
| is_read | Boolean default false | 学生是否已读 |
| read_at | DateTime(tz) nullable | 阅读时间 |
| created_at | DateTime(tz) | 发送时间 |
- Index(student_id, is_read), Index(parent_id)

#### `reward_goals` (奖励目标)
| 列 | 类型 | 说明 |
|----|------|------|
| id | String(36) PK | UUID |
| parent_id | String(36) FK→parents.id | 设定家长 |
| student_id | String(36) FK→students.id | 目标学生 |
| title | String(200) NOT NULL | 目标标题 |
| description | Text nullable | 详细描述 |
| reward_description | String(500) NOT NULL | 奖励描述 |
| metric_type | String(30) CHECK | PAPERS_COMPLETED/PRACTICE_SESSIONS/STREAK_DAYS/ERRORS_CLEARED/ACCURACY_IMPROVEMENT |
| target_value | Integer NOT NULL | 目标值 |
| current_value | Integer default 0 | 当前进度 |
| status | String(20) CHECK | ACTIVE/COMPLETED/CANCELLED/EXPIRED |
| deadline | DateTime(tz) nullable | 截止日期 |
| completed_at | DateTime(tz) nullable | 完成时间 |
| is_reward_claimed | Boolean default false | 奖励是否已兑现 |
| claimed_at | DateTime(tz) nullable | 兑现时间 |
| created_at/updated_at | DateTime(tz) | 时间戳 |
- Index(student_id, status), Index(parent_id)

#### `celebration_events` (庆祝里程碑)
| 列 | 类型 | 说明 |
|----|------|------|
| id | String(36) PK | UUID |
| student_id | String(36) FK→students.id | 学生 |
| event_type | String(30) CHECK | PAPER_COMPLETED/STREAK_MILESTONE/ACCURACY_IMPROVED/ERRORS_CLEARED/SUBJECT_MASTERY |
| title | String(200) NOT NULL | "完成第10份试卷!" |
| description | Text NOT NULL | 描述 |
| metric_value | Integer nullable | 关联指标值 |
| parent_notified | Boolean default false | 已通知家长 |
| parent_acknowledged | Boolean default false | 家长已回应 |
| encouragement_sent | Boolean default false | 已发送鼓励 |
| created_at | DateTime(tz) | 创建时间 |
- Index(student_id), Index(parent_notified, parent_acknowledged)

#### `encouragement_templates` (鼓励语模板)
| 列 | 类型 | 说明 |
|----|------|------|
| id | String(36) PK | UUID |
| category | String(30) CHECK | EFFORT/PROGRESS/PERSISTENCE/COMPLETION/GENERAL |
| title | String(100) NOT NULL | 模板标题 |
| message_template | Text NOT NULL | 内容(支持{student_name}变量) |
| is_active | Boolean default true | |
| usage_count | Integer default 0 | 使用次数 |
| created_at | DateTime(tz) | |

### 2.2 修改现有表

**`students` 表新增**:
- `invite_code`: String(6), unique, nullable
- `invite_code_expires_at`: DateTime(tz), nullable

**`notifications` 表**: CheckConstraint 扩展 notification_type 增加 `ENCOURAGEMENT`, `REWARD`, `CELEBRATION`

**`parents` 表**: `student_ids` JSON 列标记废弃（保留兼容），新逻辑走 parent_student_links

### 2.3 迁移

`009_add_parent_encouragement.py`: 创建5个新表 + students新增2列 + notifications约束扩展 + 种子模板数据

---

## 三、后端实现

### 3.1 新增文件

| 文件 | 用途 |
|------|------|
| `backend/app/models/parent_student_link.py` | 亲子关联模型 |
| `backend/app/models/encouragement.py` | 鼓励消息模型 |
| `backend/app/models/reward_goal.py` | 奖励目标模型 |
| `backend/app/models/celebration_event.py` | 庆祝事件模型 |
| `backend/app/models/encouragement_template.py` | 鼓励模板模型 |
| `backend/app/schemas/parent.py` | Pydantic schemas |
| `backend/app/api/v1/endpoints/parent.py` | 家长端 17 个端点 |
| `backend/app/services/encouragement_service.py` | 鼓励/奖励业务逻辑 |
| `backend/app/services/celebration_detector.py` | 自动检测庆祝事件 |
| `backend/app/seed_encouragement_templates.py` | ~20条鼓励模板种子 |
| `backend/alembic/versions/009_add_parent_encouragement.py` | 数据库迁移 |

### 3.2 修改文件

| 文件 | 变更 |
|------|------|
| `backend/app/core/security.py` | `get_current_user` 增加 `PARENT` 分支查询 `parents` 表，修复 else fallback |
| `backend/app/models/__init__.py` | 注册5个新模型 |
| `backend/app/models/student.py` | 新增 `invite_code` + `invite_code_expires_at` |
| `backend/app/api/v1/api.py` | 注册 parent_router |
| `backend/app/api/v1/endpoints/auth_v2.py` | 新增 `/auth/parent/register` + `/auth/parent/login` |
| `backend/app/main.py` | startup 调用 `seed_encouragement_templates()` |

### 3.3 安全层关键变更

`security.py` 的 `get_current_user` 必须修改（当前 PARENT JWT 会被误当 STUDENT 查询）:
```
现有:  if SYS_ADMIN → elif TEACHER/QUESTION_ADMIN → else → Student  ← BUG
修改:  if SYS_ADMIN → elif TEACHER/QA → elif PARENT → elif STUDENT → else raise
```

### 3.4 判分后触发链

在 `POST /answers` 判分完成后新增调用：
1. `celebration_detector.check_after_grading()` → 检测 PAPER_COMPLETED 等事件
2. `encouragement_service.update_reward_progress()` → 更新奖励目标进度

---

## 四、前端实现

### 4.1 新增文件

| 文件 | 用途 |
|------|------|
| `frontend/src/pages/parent/ParentLoginPage.tsx` | 家长登录+注册 |
| `frontend/src/pages/parent/ParentDashboardPage.tsx` | 正面统计+庆祝横幅 |
| `frontend/src/pages/parent/ParentEncouragePage.tsx` | 模板+自定义+历史 |
| `frontend/src/pages/parent/ParentRewardGoalsPage.tsx` | 奖励目标管理 |
| `frontend/src/pages/parent/ParentCelebrationsPage.tsx` | 成就时间线 |
| `frontend/src/pages/parent/ParentProfilePage.tsx` | 个人信息+关联管理 |
| `frontend/src/store/useParentStore.ts` | 家长端 Zustand store |

### 4.2 修改文件

| 文件 | 变更 |
|------|------|
| `frontend/src/router.tsx` | 新增6条家长路由 + `/parent/login` 公开路由 |
| `frontend/src/components/layout/AppLayout.tsx` | `menuItems` 新增 PARENT 角色菜单 (HeartOutlined/TrophyOutlined/SendOutlined/GiftOutlined) |
| `frontend/src/store/auth.ts` | role 类型新增 `'PARENT'` |
| `frontend/src/pages/auth/LoginPage.tsx` | 底部增加「家长入口」链接 |
| `frontend/src/pages/dashboard/DashboardPage.tsx` | 学生视图新增「家长鼓励」卡片 |
| `frontend/src/pages/auth/ProfilePage.tsx` | 新增「家长关联」区域（邀请码） |

### 4.3 家长侧栏菜单

```
PARENT: [
  { key: '/parent/dashboard', icon: <HeartOutlined />, label: '鼓励仪表盘' },
  { key: '/parent/celebrations', icon: <TrophyOutlined />, label: '成长里程碑' },
  { key: '/parent/encourage', icon: <SendOutlined />, label: '发送鼓励' },
  { key: '/parent/rewards', icon: <GiftOutlined />, label: '奖励目标' },
]
```

---

## 五、关键设计决策

### 5.1 邀请码机制
- 学生生成 6 位大写字母数字码（排除易混淆字符 0/O/1/I/L）
- 有效期 7 天，可刷新（旧码失效）
- 每位学生最多关联 4 位家长
- 关联后永久有效，直到任一方主动解除

### 5.2 正面数据 API (`positive-stats`)
**返回**: 努力指标（完成数/连续天数/趋势）+ 成长趋势（正确率变化±百分点，不返回绝对分数）+ 鼓励状态
**不返回**: 具体分数、错题详情、排名、错误类型分析

### 5.3 庆祝事件自动检测
| 事件类型 | 触发条件 |
|----------|----------|
| PAPER_COMPLETED | 完成一份试卷 |
| STREAK_MILESTONE | 连续学习 7/14/30/60 天 |
| ACCURACY_IMPROVED | 本周正确率比上周提升 >5% |
| ERRORS_CLEARED | 一周内消灭 3+ 个错题 |
| SUBJECT_MASTERY | 某科目连续3次正确率 >80% |

### 5.4 奖励进度自动更新
在学生答题/判分流程中自动递增 `current_value`，达成目标后自动通知双方。

### 5.5 鼓励模板种子 (~20条)
分5类: EFFORT(努力)/PROGRESS(进步)/PERSISTENCE(坚持)/COMPLETION(完成)/GENERAL(通用)

---

## 六、实施步骤

### Phase 1: 文档更新
1. 更新 `nDocs/requirements-v3.0.md` R3.4-06 节
2. 更新 `nDocs/database-design.md` 新增家长鼓励域
3. 更新 `nDocs/backend-api-plan.md` + `frontend-component-plan.md`
4. 更新 `nDocs/执行路线图.md`

### Phase 2: 后端基础
5. 创建5个新模型 + 修改 student/notification 模型
6. 创建 `009_add_parent_encouragement.py` 迁移
7. 修改 `security.py` get_current_user 增加 PARENT 分支
8. 创建种子数据脚本 + 接入 main.py startup
9. 运行迁移验证

### Phase 3: 后端认证与关联
10. `auth_v2.py` 新增家长注册/登录端点
11. `parent.py` 实现邀请码关联/解除
12. `students` 新增邀请码生成端点

### Phase 4: 后端核心功能
13. 鼓励消息 CRUD + 通知
14. 鼓励模板查询
15. 奖励目标 CRUD + 进度更新 + 自动完成
16. 庆祝事件检测 + 查询
17. 正面趋势统计 API
18. 注册 parent_router 到 api.py

### Phase 5: 前端页面
19. ParentLoginPage (登录+注册双Tab)
20. ParentDashboardPage (统计卡片+庆祝横幅+活跃度图)
21. ParentEncouragePage (模板选择+自定义+历史)
22. ParentRewardGoalsPage (创建+进度+兑现)
23. ParentCelebrationsPage (时间线)
24. ParentProfilePage (信息+关联管理)

### Phase 6: 前端集成
25. router.tsx 新增6条路由
26. AppLayout.tsx 新增 PARENT 菜单
27. auth.ts 新增 PARENT 角色
28. LoginPage.tsx 增加家长入口链接
29. DashboardPage.tsx 学生视图增加鼓励卡片
30. ProfilePage.tsx 增加邀请码区域

### Phase 7: 判分集成 + 验证
31. 判分流程中接入庆祝检测 + 奖励进度更新
32. TypeScript 构建验证 (`tsc --noEmit` + `npm run build`)
33. ESLint 检查
34. 端到端验证

---

## 七、验证清单

- [ ] `alembic upgrade head` — 迁移 009 成功，5 个新表创建
- [ ] 种子数据写入 ~20 条鼓励模板
- [ ] 家长注册: POST `/auth/parent/register` → 返回 JWT(type=PARENT)
- [ ] 家长登录: POST `/auth/parent/login` → 返回 JWT
- [ ] 学生生成邀请码: POST `/students/generate-invite-code` → 返回 6 位码
- [ ] 家长关联: POST `/parent/link-student` → 关联成功
- [ ] 正面趋势: GET `/parent/child/{id}/positive-stats` → 无分数/错题数据
- [ ] 发送鼓励: POST `/parent/encouragements` → 学生端可查
- [ ] 学生收到鼓励: GET `/encouragements/received` → 列表正确
- [ ] 创建奖励目标: POST `/parent/reward-goals` → 状态 ACTIVE
- [ ] 奖励进度自动更新 → 达成后自动 COMPLETED
- [ ] 庆祝事件检测 → 正面事件被正确识别
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run build` — 成功
- [ ] `npm run lint` — 0 errors
- [ ] 家长前端: 登录 → 关联 → 仪表盘 → 发送鼓励 → 设定奖励 → 庆祝
