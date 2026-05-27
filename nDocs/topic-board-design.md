# 讲题板 (Topic Board) 设计文档

> 版本: V3.1 | 日期: 2026-05-26 | 状态: 已完成

---

## 1. 概述

讲题板是一个互动式题目讲解系统，以"熊猫教授"卡通形象为主角，通过分步骤动画演示、黑板书写效果和浮动对话气泡，为学生提供沉浸式的题目讲解体验。

**V3.1 重大变更**: 讲题板从独立页面重构为**嵌入式 Drawer 组件**，不再作为独立菜单项。重点题(is_typical)标记触发 LLM 自动生成讲解，教师审核确认后保存。新增推荐题机制，教师可为特定学生推荐题目。

**核心理念**: 模拟教师板书讲解场景，将静态的题目解析变为可交互的分步骤演示。

---

## 2. 使用流程

### 2.1 教师标记重点题 → LLM 生成讲解

```
教师在 QuestionEditModal 中开启"重点题"开关
        ↓
前端调用 POST /questions/generate-explanation (同步等待LLM)
        ↓
显示加载状态 (LoadingOutlined + "AI生成讲解中...")
        ↓
LLM 返回步骤列表 → 弹出 ExplanationReviewModal
        ↓
教师可编辑步骤文本、调整顺序、修改表情、增删步骤
        ↓
点击"确认保存" → POST /topic-board 创建 ExplanationSession
        ↓
讲题板数据就绪，学生可通过 Drawer 查看
```

### 2.2 学生查看讲解

```
学生在 试题讲解页(TypicalQuestionsPage) / 错题本预览 / 题库列表
        ↓
点击题目行的 ▶ 讲解图标 (PlayCircleOutlined)
        ↓
打开 ExplanationDrawer (Ant Design Drawer, 920px)
        ↓
Drawer 调用 GET /topic-board/by-question/{id} 加载讲解数据
        ↓
展示: 熊猫教授(左) + 黑板(右) + 浮动气泡 + 步骤控制器
        ↓
自动播放(6秒/步) 或 手动控制
```

### 2.3 推荐题流程

```
教师为特定学生推荐题目 → POST /recommendations
        ↓
学生在 试题讲解页 → "推荐题" Tab 查看被推荐的题目
        ↓
推荐题同样支持讲题板 Drawer 查看(如有讲解)
```

---

## 3. 数据模型

### 3.1 explanation_sessions (讲解会话)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(36) PK | UUID |
| question_id | String(36) FK → questions.id, UNIQUE, nullable | 关联题目(可选) |
| title | String(500) NOT NULL | 讲解标题 |
| topic | String(100) nullable | 主题/分类标签 |
| difficulty_label | String(50) nullable | 难度标签 |
| problem_statement | Text nullable | 题目原文 |
| graph_config | JSONB nullable | 函数图形配置 |
| is_active | Boolean default true | 是否启用(软删除) |
| created_by | String(36) FK → admins.id, nullable | 创建者(教师) |
| created_at / updated_at | DateTime(tz) | 时间戳 |

**唯一约束**: `question_id` 全局唯一（一道题最多一个讲解会话）

### 3.2 explanation_steps (讲解步骤)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(36) PK | UUID |
| session_id | String(36) FK → explanation_sessions.id (CASCADE) | 所属会话 |
| step_order | Integer NOT NULL | 步骤序号(从1开始) |
| text | Text NOT NULL | 讲解文本 |
| panda_emotion | String(20) CHECK | idle / thinking / explaining / satisfied |
| board_line | Text nullable | 黑板上显示的板书内容 |
| created_at | DateTime(tz) | 创建时间 |

### 3.3 question_recommendations (题目推荐) — V3.1 新增

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(36) PK | UUID |
| question_id | String(36) FK → questions.id, NOT NULL | 推荐题目 |
| student_id | String(36) FK → students.id, NOT NULL | 被推荐学生 |
| recommended_by | String(36) FK → admins.id, NOT NULL | 推荐教师 |
| created_at | DateTime(tz) | 推荐时间 |

**唯一约束**: `(question_id, student_id)` — 同一题目对同一学生只能推荐一次

**迁移**: `010_add_question_recommendations.py`

### 3.4 graph_config (图形配置, JSONB)

```json
{
  "fn": "x^2", "fn2": "", "fn3": "",
  "points": "", "x_min": -6, "x_max": 6, "y_min": -8, "y_max": 8
}
```

---

## 4. API 端点

### 4.1 讲题板 CRUD

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/topic-board` | 讲解列表(分页、按主题筛选) | 所有已登录用户 |
| GET | `/topic-board/by-question/{question_id}` | 按题目ID查讲解 | 所有已登录用户 |
| GET | `/topic-board/{session_id}` | 讲解详情(含步骤) | 所有已登录用户 |
| POST | `/topic-board` | 创建讲解(含步骤) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| PUT | `/topic-board/{session_id}` | 更新讲解(删旧步骤+建新步骤) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| DELETE | `/topic-board/{session_id}` | 软删除讲解 | TEACHER / QUESTION_ADMIN / SYS_ADMIN |

**路由注册**: `backend/app/api/v1/api.py` → prefix `/topic-board`

### 4.2 题目讲解增强

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/questions/typical` | 重点题列表(含 has_explanation 标志) | 所有已登录用户 |
| POST | `/questions/generate-explanation` | LLM 生成讲解步骤(不保存) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| PUT | `/questions/{id}/typical` | 切换重点题标志(关闭时删除关联讲解) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| GET | `/questions/has-explanations?ids=...` | 批量检查题目是否有讲解 | 所有已登录用户 |

### 4.3 推荐题

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/recommendations` | 创建推荐(支持多学生) | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| DELETE | `/recommendations/{id}` | 删除推荐 | TEACHER / QUESTION_ADMIN / SYS_ADMIN |
| GET | `/recommendations/my` | 学生获取被推荐题目(含 has_explanation) | STUDENT |
| GET | `/recommendations/by-question/{question_id}` | 查看某题推荐给了哪些学生 | TEACHER / QUESTION_ADMIN / SYS_ADMIN |

**路由注册**: `backend/app/api/v1/api.py` → prefix `/recommendations`

---

## 5. 前端实现

### 5.1 组件架构

讲题板不再作为独立页面，而是以 Drawer 形式嵌入各页面：

```
ExplanationDrawer (Ant Design Drawer, 920px)
├── 顶部: 题目标题 + 主题/难度标签
├── 左侧: 熊猫教授区域 (260px)
│   ├── Professor 组件 (SVG 动画角色)
│   └── FloatingBubbleSystem (对话气泡)
└── 右侧: 黑板区域 (flex: 1)
    ├── Chalkboard 组件
    │   ├── ChalkboardFrame (黑板边框)
    │   └── ChalkContent (粉笔书写内容)
    └── 底部控制栏
        ├── 步骤信息 + 表情标签
        ├── 自动播放按钮
        └── StepController (步骤导航)
```

### 5.2 嵌入位置

| 页面 | 入口 | 说明 |
|------|------|------|
| TypicalQuestionsPage | "讲解" 列的 PlayCircleOutlined 图标 | 重点题 Tab + 推荐题 Tab |
| QuestionListPage | "讲解" 列的 PlayCircleOutlined 图标 | 教师/管理员浏览题库 |
| MistakeBookPage | 预览 Modal 中各题目的"讲解"按钮 | 错题本预览弹窗 |

### 5.3 组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| **ExplanationDrawer** | `components/topic-board/ExplanationDrawer.tsx` | **V3.1 新增** — Drawer 容器，封装全部讲题板组件 |
| **ExplanationReviewModal** | `components/topic-board/ExplanationReviewModal.tsx` | **V3.1 新增** — 教师审核/编辑 LLM 生成步骤 |
| Professor | `components/topic-board/Professor/Professor.tsx` | 熊猫教授 SVG 角色动画 |
| Chalkboard | `components/topic-board/Chalkboard/Chalkboard.tsx` | 黑板 + 图形 + 逐步板书 |
| FloatingBubbleSystem | `components/topic-board/FloatingBubble/FloatingBubbleSystem.tsx` | 浮动对话气泡 |
| StepController | `components/topic-board/StepController/StepController.tsx` | 步骤导航控制器 |

### 5.4 状态管理 (Zustand) — V3.1 增强

`frontend/src/store/useTopicBoardStore.ts`

| 操作 | 说明 |
|------|------|
| fetchSessions() | 加载讲解列表 |
| fetchSession(id) | 按会话ID加载 |
| **fetchSessionByQuestion(questionId)** | **V3.1 新增** — 按题目ID加载讲解 |
| nextStep() / prevStep() / goToStep(i) | 步骤导航 |
| toggleAutoplay() | 切换自动播放 |
| **reset()** | **V3.1 新增** — Drawer 关闭时重置状态 |

### 5.5 LLM 讲解生成流程 (QuestionEditModal)

```
is_typical 开关切换为 ON
        ↓
Form.useWatch 检测到变化 (wasTypicalRef 防重复)
        ↓
POST /questions/generate-explanation { question_id }
        ↓
LoadingOutlined 加载指示器
        ↓
返回 { steps: [...], model: "..." }
        ↓
ExplanationReviewModal 弹出
        ↓
教师编辑步骤 → 确认保存 → POST /topic-board
```

---

## 6. 熊猫表情系统

| 表情 | 标签 | 含义 | 气泡类型 |
|------|------|------|----------|
| idle | 准备 | 等待开始 | speech |
| thinking | 思考中 | 分析问题 | thought (左侧) |
| explaining | 讲解中 | 正在讲解 | speech (交替左右) |
| satisfied | 总结 | 讲解完成 | speech |

LLM 生成时默认按 `thinking → explaining × N → satisfied` 模式分配表情。

---

## 7. 迁移记录

| 迁移 | 说明 |
|------|------|
| 008 | 创建 `explanation_sessions` + `explanation_steps` |
| 010 | 创建 `question_recommendations` |

---

## 8. 待实现项

| 项 | 优先级 | 说明 |
|----|--------|------|
| 语音朗读 (TTS) | 低 | 熊猫教授朗读每步讲解文本 |
| 学生笔记 | 低 | 学生可在讲解步骤上添加笔记 |
| 图形动画 | 低 | 函数图形动态绘制(如描点→连线) |
| 推荐题教师端 UI | 中 | 教师在题库中为学生推荐题目的完整界面 |

---

## 9. V3.0 → V3.1 变更对照

| V3.0 | V3.1 |
|------|------|
| 独立页面 `/topic-board` | Drawer 组件嵌入各页面 |
| 菜单中有"讲题板"入口 | 从菜单移除 |
| 手动创建讲解 | LLM 自动生成 + 教师审核 |
| 无推荐机制 | `question_recommendations` 表 + 推荐 API |
| 无编辑确认流程 | ExplanationReviewModal 审核流程 |
| 仅 GET/POST/DELETE | 新增 PUT 更新端点 |
| Store 无 reset | 新增 reset() 方法 |
