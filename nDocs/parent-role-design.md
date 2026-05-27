# 家长角色 (Parent as Encourager) 设计文档

> 版本: V3.0 | 日期: 2026-05-26 | 状态: 已完成

---

## 1. 概述

家长角色定位为**鼓励者 (Encourager)**，而非监督者。家长通过发送鼓励消息、设置奖励目标、庆祝成长里程碑来正向激励学生。

**核心原则**: 家长只看正面趋势（努力、进步、坚持、完成），不看具体分数和错题详情。

| 家长应看到 | 家长不应看到 |
|-----------|-------------|
| 完成了多少练习、坚持了多少天 | 具体考了多少分、排第几名 |
| 正确率提升了、知识点进步了 | 错了哪些题、哪些知识点不会 |
| 可以发送鼓励、设定奖励 | 实时监控答题过程、查看详细答案 |
| 里程碑成就、连续打卡 | 错误趋势、落后排名 |

**实现状态**: 后端 17 个端点 + 教师互动 2 个端点 + 前端 6 个页面 + 学生端集成 + 判分后自动触发链，全部已完成。

---

## 2. 数据流

### 2.1 注册与关联

```
学生端: ProfilePage → 生成邀请码 (6位大写字母数字, 7天有效)
                         ↓
家长端: ParentLoginPage → 手机号+SMS注册 → JWT(type=PARENT)
                         ↓
         输入邀请码 → POST /parent/link-student
                         ↓
         创建 parent_student_links 记录 (每位学生最多关联4位家长)
```

### 2.2 鼓励互动链

```
家长: 选择模板/自定义 → POST /parent/encouragements → 写入 encouragements 表
                         ↓
         NotificationService.create_encouragement_notification()
                         ↓
学生: DashboardPage 显示鼓励卡片 + 通知中心收到消息
```

### 2.3 判分后自动触发链

```
学生提交答案 → 自动判分 → POST /answers 完成
                         ↓
         interaction_service.process_post_grading_interactions()
                         ↓
    ┌────────────────────┼────────────────────┐
    ↓                    ↓                    ↓
_check_celebrations   _notify_parents      _update_reward_goals
  (PAPER_COMPLETED     (向已关联家长          (更新PAPERS_COMPLETED
   ACCURACY_IMPROVED    发送庆祝通知)          ERRORS_CLEARED进度,
   ERRORS_CLEARED)                            达成目标自动COMPLETED)
```

### 2.4 教师互动链

```
教师: TeacherClassesPage
  ├─ 发送评语 → POST /teacher/interaction/feedback → 学生收到通知
  └─ 班级通知 → POST /teacher/interaction/class-announcement
                  → 班级所有学生 + 已绑定家长 均收到通知
```

---

## 3. 数据模型 (5 张新表 + 2 表修改)

### 3.1 parent_student_links (亲子关联)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(36) PK | UUID |
| parent_id | String(36) FK → parents.id | 家长 |
| student_id | String(36) FK → students.id | 学生 |
| relationship | String(20) nullable | 关系标签(父亲/母亲/其他) |
| invite_code_used | String(6) NOT NULL | 使用的邀请码 |
| is_active | Boolean default true | 是否有效 |
| linked_at / unlinked_at | DateTime(tz) | 关联/解除时间 |

**唯一约束**: `UniqueConstraint(parent_id, student_id)`

### 3.2 encouragements (鼓励消息)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(36) PK | UUID |
| parent_id | String(36) FK → parents.id | 发送家长 |
| student_id | String(36) FK → students.id | 接收学生 |
| encouragement_type | String(20) CHECK | TEMPLATE / CUSTOM / CELEBRATION / REWARD_COMPLETE |
| title | String(200) nullable | 标题 |
| message | Text NOT NULL | 鼓励内容 |
| template_id | String(36) FK nullable | 引用模板 |
| celebration_event_id | String(36) FK nullable | 关联庆祝事件 |
| is_read | Boolean default false | 学生是否已读 |
| read_at | DateTime(tz) nullable | 阅读时间 |
| created_at | DateTime(tz) | 发送时间 |

**索引**: `ix_encouragements_student_read` (student_id, is_read), `ix_encouragements_parent` (parent_id)

### 3.3 reward_goals (奖励目标)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(36) PK | UUID |
| parent_id | String(36) FK → parents.id | 设定家长 |
| student_id | String(36) FK → students.id | 目标学生 |
| title | String(200) NOT NULL | 目标标题 |
| description | Text nullable | 详细描述 |
| reward_description | String(500) NOT NULL | 奖励描述 |
| metric_type | String(30) CHECK | PAPERS_COMPLETED / PRACTICE_SESSIONS / STREAK_DAYS / ERRORS_CLEARED / ACCURACY_IMPROVEMENT |
| target_value | Integer NOT NULL | 目标值 |
| current_value | Integer default 0 | 当前进度 |
| status | String(20) CHECK | ACTIVE / COMPLETED / CANCELLED / EXPIRED |
| deadline | DateTime(tz) nullable | 截止日期 |
| completed_at / is_reward_claimed / claimed_at | | 完成与兑现 |
| created_at / updated_at | DateTime(tz) | 时间戳 |

**索引**: `ix_reward_goals_student_status` (student_id, status), `ix_reward_goals_parent` (parent_id)

### 3.4 celebration_events (庆祝里程碑)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(36) PK | UUID |
| student_id | String(36) FK → students.id | 学生 |
| event_type | String(30) CHECK | PAPER_COMPLETED / STREAK_MILESTONE / ACCURACY_IMPROVED / ERRORS_CLEARED / SUBJECT_MASTERY |
| title | String(200) NOT NULL | 如"完成了第10套试卷!" |
| description | Text NOT NULL | 描述 |
| metric_value | Integer nullable | 关联指标值 |
| parent_notified | Boolean default false | 已通知家长 |
| parent_acknowledged | Boolean default false | 家长已回应 |
| encouragement_sent | Boolean default false | 已发送鼓励 |
| created_at | DateTime(tz) | 创建时间 |

### 3.5 encouragement_templates (鼓励模板)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(36) PK | UUID |
| category | String(30) CHECK | EFFORT / PROGRESS / PERSISTENCE / COMPLETION / GENERAL |
| title | String(100) NOT NULL | 模板标题 |
| message_template | Text NOT NULL | 内容(支持 {student_name} 变量) |
| is_active | Boolean default true | 是否启用 |
| usage_count | Integer default 0 | 使用次数 |
| created_at | DateTime(tz) | 创建时间 |

**种子数据**: 20 条模板，5 个分类各 4 条 (`backend/app/seed_encouragement_templates.py`)

### 3.6 students 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| invite_code | String(6) UNIQUE, nullable | 家长关联邀请码 |
| invite_code_expires_at | DateTime(tz) nullable | 邀请码过期时间 |

**邀请码规则**: 6 位大写字母+数字，排除易混淆字符 (0/O/1/I/L)，有效期 7 天。

### 3.7 notifications 类型扩展

新增 notification_type: `ENCOURAGEMENT_RECEIVED`, `CELEBRATION_EVENT`, `REWARD_GOAL_UPDATE`, `TEACHER_FEEDBACK`, `CLASS_ANNOUNCEMENT`

---

## 4. API 端点

### 4.1 家长认证 (auth_v2.py)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/auth/parent/register` | 家长注册(手机号+短信) | 公开 |
| POST | `/auth/parent/login` | 家长登录(手机号+短信) | 公开 |

JWT payload 新增: `type: PARENT`

### 4.2 家长端点 (parent.py — 17 个)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/parent/students/generate-invite-code` | 学生生成邀请码 | STUDENT |
| GET | `/parent/students/invite-code` | 查看当前邀请码 | STUDENT |
| POST | `/parent/link-student` | 输入邀请码关联学生 | PARENT |
| DELETE | `/parent/unlink-student/{student_id}` | 解除关联 | PARENT |
| GET | `/parent/linked-students` | 已关联学生列表 | PARENT |
| POST | `/parent/send-encouragement` | 发送鼓励消息 | PARENT |
| GET | `/parent/sent-encouragements` | 已发送鼓励列表 | PARENT |
| GET | `/parent/received-encouragements` | 收到的鼓励(STUDENT视角) | STUDENT |
| POST | `/parent/mark-read/{id}` | 标记鼓励已读 | STUDENT |
| GET | `/parent/templates` | 鼓励模板列表 | PARENT |
| POST | `/parent/create-reward-goal` | 创建奖励目标 | PARENT |
| GET | `/parent/get-reward-goals` | 奖励目标列表 | PARENT |
| POST | `/parent/claim-reward/{id}` | 标记奖励已兑现 | PARENT |
| GET | `/parent/celebrations/{student_id}` | 庆祝事件列表 | PARENT |
| GET | `/parent/positive-stats/{student_id}` | 正面趋势统计 | PARENT |

### 4.3 教师互动端点 (teacher_interaction.py — 2 个)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/teacher/interaction/feedback` | 教师发送评语给学生 | TEACHER / QUESTION_ADMIN |
| POST | `/teacher/interaction/class-announcement` | 班级通知(发给学生+已绑定家长) | TEACHER / QUESTION_ADMIN |

---

## 5. 核心服务

### 5.1 判分后触发 (`interaction_service.py`)

`process_post_grading_interactions(db, student_id, exam_paper_id, percentage)`

在 `POST /answers` 判分完成后调用，触发:

| 子任务 | 触发条件 | 效果 |
|--------|----------|------|
| PAPER_COMPLETED | 每次判分完成 | 创建庆祝事件，累计完成套数 |
| ACCURACY_IMPROVED | 正确率 >= 90% | 创建"正确率优秀"庆祝事件 |
| ERRORS_CLEARED | 消灭错题达到里程碑(5/10/20/50/100) | 创建消灭错题庆祝事件 |
| 通知家长 | 有庆祝事件时 | 向所有已关联家长发送庆祝通知 |
| 更新奖励目标 | 有 ACTIVE 状态目标时 | 更新 PAPERS_COMPLETED/ERRORS_CLEARED 进度，达成自动 COMPLETED |

### 5.2 通知服务扩展 (`notification_service.py`)

新增 5 个通知方法:

| 方法 | 接收者 | notification_type |
|------|--------|-------------------|
| create_encouragement_notification | 学生 | ENCOURAGEMENT_RECEIVED |
| create_celebration_notification | 家长 | CELEBRATION_EVENT |
| create_reward_update_notification | 学生 | REWARD_GOAL_UPDATE |
| create_teacher_feedback_notification | 学生 | TEACHER_FEEDBACK |
| create_class_announcement_notification | 学生/家长 | CLASS_ANNOUNCEMENT |

---

## 6. 安全层

### 6.1 JWT 认证扩展

`security.py` 的 `get_current_user` 新增 PARENT 分支:

```
if SYS_ADMIN → elif TEACHER/QA → elif PARENT(查parents表) → elif STUDENT → else raise
```

### 6.2 邀请码安全

- 字符集: 大写字母+数字，排除 0/O/1/I/L
- 有效期: 7 天，可重新生成(旧码失效)
- 每位学生最多关联 4 位家长
- 关联后永久有效，直到任一方主动解除

---

## 7. 前端实现

### 7.1 新增页面 (6 个)

| 页面 | 路由 | 文件 | 说明 |
|------|------|------|------|
| ParentLoginPage | `/parent/login` (公开) | `pages/auth/ParentLoginPage.tsx` | 手机号+SMS登录/注册双Tab |
| ParentDashboardPage | `/dashboard` (PARENT角色) | `pages/parent/ParentDashboardPage.tsx` | 学生选择器+4统计卡片+正确率趋势+奖励进度 |
| ParentEncouragePage | `/parent/encourage` | `pages/parent/ParentEncouragePage.tsx` | 模板浏览+自定义消息+发送历史 |
| ParentRewardGoalsPage | `/parent/reward-goals` | `pages/parent/ParentRewardGoalsPage.tsx` | 创建/管理奖励目标+进度条 |
| ParentCelebrationsPage | `/parent/celebrations` | `pages/parent/ParentCelebrationsPage.tsx` | 成就时间线 |
| ParentProfilePage | `/profile` (PARENT角色) | (未单独创建，复用ProfilePage) | 个人信息+关联管理 |

### 7.2 修改的页面

| 页面 | 变更 |
|------|------|
| LoginPage (学生) | 底部增加"家长入口 →"链接 |
| DashboardPage (学生) | 新增"家长的鼓励"卡片区域 + "奖励目标"进度展示 |
| ProfilePage (学生) | 新增"家长绑定邀请码"区域(生成/显示/复制/重新生成) |
| TeacherClassesPage | 班级表增加"通知"按钮，学生表增加"评语"按钮 |
| AppLayout | 新增 PARENT 侧栏菜单 |

### 7.3 状态管理

`frontend/src/store/useParentStore.ts` — Zustand store

| 状态 | 说明 |
|------|------|
| linkedStudents | 已关联学生列表 |
| selectedStudentId | 当前选中学生 |
| encouragements / receivedEncouragements | 已发送/已收到鼓励 |
| templates | 鼓励模板 |
| rewardGoals | 奖励目标 |
| celebrations | 庆祝事件 |
| positiveStats | 正面统计数据 |

### 7.4 家长侧栏菜单

```
PARENT: [
  家长仪表盘 (DashboardOutlined)
  发送鼓励 (HeartOutlined)
  奖励目标 (TrophyOutlined)
  庆祝时刻 (StarOutlined)
]
```

---

## 8. 迁移

`backend/alembic/versions/009_add_parent_encouragement.py`:
- 创建 5 张新表 (parent_student_links, encouragement_templates, celebration_events, encouragements, reward_goals)
- students 新增 invite_code + invite_code_expires_at 列
- parents.id 从 UUID 改为 VARCHAR(36) (与其他表统一)
- notifications 表 CheckConstraint 扩展

---

## 9. 待实现项

| 项 | 优先级 | 说明 |
|----|--------|------|
| 连续学习天数(STREAK_DAYS)指标 | 中 | 奖励目标进度需接入打卡系统 |
| 正确率提升(ACCURACY_IMPROVEMENT)指标 | 中 | 需对比历史正确率计算提升幅度 |
| 练习次数(PRACTICE_SESSIONS)指标 | 中 | 需统计自主学习练习次数 |
| 家长 ProfilePage 独立页面 | 低 | 当前复用通用 ProfilePage，可独立扩展关联管理 |
| 庆祝事件家长回应 | 低 | parent_acknowledged 字段已设计，前端未实现回应互动 |
| 鼓励消息推送(WebSocket/SSE) | 长期 | 当前采用 30s 轮询，未来可升级为实时推送 |

---

## 10. 与 V1.0 设计差异

| V1.0 设计 (R3.4-06 原版) | V3.0 实际 (鼓励者设计) |
|---------------------------|----------------------|
| 家长只读查看进度/错题(监督者) | 家长发送鼓励/设置奖励/庆祝里程碑(鼓励者) |
| 家长看到具体分数和错题 | 家长只看正面趋势(进步/坚持/完成) |
| parents.student_ids JSON 列管理关联 | parent_student_links 表管理，支持多对多 |
| 无鼓励消息系统 | 完整鼓励消息 + 模板 + 通知链路 |
| 无奖励目标系统 | 奖励目标 + 自动进度追踪 + 兑现 |
| 无庆祝事件 | 判分后自动检测 + 通知家长 |
| 无教师→家长互动 | 教师评语 + 班级通知触达家长 |
| 无邀请码机制 | 学生生成 6 位码，家长输入关联 |
