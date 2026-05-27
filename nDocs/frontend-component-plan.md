# 前端组件开发文档

> 版本: V3.2 | 日期: 2026-05-26 | 技术栈: React 19 + Vite 8 + Ant Design 6.4 + TypeScript 6.0 + Zustand 5 + React Router 7 + Recharts 2.15

---

## 1. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19.2 |
| 构建 | Vite | 8 |
| UI 库 | Ant Design | 6.4 |
| 类型 | TypeScript | 6.0 |
| 状态 | Zustand | 5 |
| 路由 | React Router | 7 |
| HTTP | Axios | (via client.ts) |
| 公式 | KaTeX | (已集成) |
| 图表 | Recharts | 2.15 |

---

## 2. 目录结构

```
src/
├── api/
│   └── client.ts              # axios 实例 + JWT 刷新 + 自动解包
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx      # 主布局: Sidebar + Header + Content
│   │   └── SidebarMenu.tsx    # 角色动态菜单
│   └── notification/
│       └── NotificationBell.tsx  # 通知铃铛 + 下拉面板
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── AdminLoginPage.tsx
│   ├── dashboard/
│   │   └── DashboardPage.tsx       # 学生仪表盘(待接真实API)
│   ├── papers/
│   │   ├── PaperListPage.tsx
│   │   └── MyPapersPage.tsx
│   ├── questions/
│   │   └── QuestionListPage.tsx
│   ├── mistake-book/
│   │   ├── MistakeBookPage.tsx
│   │   └── PapersMistakeBookPage.tsx
│   ├── exam-mistakes/
│   │   └── ...
│   ├── teacher/
│   │   ├── ClassesPage.tsx
│   │   ├── StatsPaperPage.tsx
│   │   ├── StatsQuestionPage.tsx
│   │   └── RecommendationPage.tsx
│   ├── admin/
│   │   ├── AdminConfigPage.tsx     # 系统配置(LLM/OCR/DB)
│   │   ├── BasicConfigPage.tsx     # 基础参数(学科/应用设置)
│   │   └── SysAdminPage.tsx        # 管理员账号
│   ├── questions/
│   │   └── QuestionAdminPage.tsx   # 题库管理(LLM生成/网络抓取/审核/去重管理)
│   ├── syllabus/
│   │   └── SyllabusPage.tsx        # 考纲+知识树(含KnowledgeTreePage: 版本回滚/时间线/VERSION_CUT)
│   ├── profile/
│   │   └── ProfilePage.tsx
│   └── TypicalQuestionsPage.tsx
├── components/
│   └── topic-board/
│       ├── ExplanationDrawer.tsx      # V3.1 讲题板 Drawer 容器
│       ├── ExplanationReviewModal.tsx # V3.1 教师审核 LLM 步骤
│       ├── Professor/                 # 熊猫教授 SVG 动画
│       ├── Chalkboard/                # 黑板 + 图形 + 板书
│       ├── FloatingBubble/            # 浮动对话气泡
│       ├── StepController/            # 步骤导航控制器
│       └── types.ts                   # 类型定义
├── router.tsx                 # 路由定义 + 角色守卫
├── store/
│   ├── auth.ts                # 认证状态(唯一入口) + helper 函数
│   ├── notification.ts        # 通知列表 + 未读数
│   └── useTopicBoardStore.ts  # V3.1 讲题板状态(含 fetchSessionByQuestion, reset)
├── types/                     # TypeScript 类型定义
└── main.tsx                   # 入口
```

---

## 3. 路由表

| 路径 | 页面 | 角色 | 状态 |
|------|------|------|------|
| `/login` | LoginPage | 公开 | 完成 |
| `/admin/login` | AdminLoginPage | 公开 | 完成 |
| `/dashboard` | DashboardPage | 全部 | 完成(数据待真实化) |
| `/questions` | QuestionListPage | TEACHER/ADMIN | 完成 |
| `/papers` | PaperListPage / MyPapersPage | 按角色 | 完成 |
| `/my-papers` | MyPapersPage | STUDENT | 完成 |
| `/typical-questions` | TypicalQuestionsPage | STUDENT | 完成(Tabs: 重点题+推荐题, Drawer 讲题板) |
| `/mistake-book` | MistakeBookPage | STUDENT | 完成 |
| `/teacher/classes` | ClassesPage | TEACHER | 完成 |
| `/teacher/stats/paper` | StatsPaperPage | TEACHER | 完成 |
| `/teacher/stats/question` | StatsQuestionPage | TEACHER | 完成 |
| `/teacher/recommendations` | RecommendationPage | TEACHER | 完成 |
| `/admin/config` | AdminConfigPage | SYS_ADMIN | 完成 |
| `/admin/basic-config` | BasicConfigPage | SYS_ADMIN | 完成 |
| `/admin/sys-admin` | SysAdminPage | SYS_ADMIN | 完成 |
| `/question-admin` | QuestionAdminPage | QUESTION_ADMIN | 完成 |
| `/syllabus` | SyllabusPage | TEACHER/ADMIN | 完成 |
| `/profile` | ProfilePage | 全部 | 完成 |
| `/print-preview` | (内联) | 公开 | 完成 |
| `/self-study` | **SelfStudyPage** | STUDENT | **待实现** |
| `/notifications` | **NotificationListPage** | 全部 | **待实现** |
| `/admin/database` | **DatabaseManagementPage** | SYS_ADMIN | **待实现** |
| `/parent/login` | **ParentLoginPage** | 公开 | 完成 |
| `/parent/dashboard` | **ParentDashboardPage** | PARENT | 完成 |
| `/parent/encourage` | **ParentEncouragePage** | PARENT | 完成 |
| `/parent/rewards` | **ParentRewardGoalsPage** | PARENT | 完成 |
| `/parent/celebrations` | **ParentCelebrationsPage** | PARENT | 完成 |
| `/parent/profile` | **ParentProfilePage** | PARENT | 完成 |

---

## 4. 状态管理

### 4.1 Auth Store (`store/auth.ts`)

唯一认证状态源，所有页面通过此 store 或导出的 helper 访问认证信息。

```typescript
export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
export const getUserType = () => localStorage.getItem(USER_TYPE_KEY) || 'STUDENT';
export const getUserName = () => localStorage.getItem(USER_NAME_KEY);
export const getUserId = () => localStorage.getItem(USER_ID_KEY);

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setAuth: (data) => { /* 双写 store + localStorage */ },
  logout: () => { /* 清除全部 */ },
  updateUserName: (name) => { /* 更新显示名 */ },
}));
```

### 4.2 Notification Store (`store/notification.ts`)

```typescript
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}
```

---

## 5. 核心组件

### 5.1 AppLayout

- Sidebar: 根据 `user_type` 动态生成菜单项
- Header: 用户名 + **NotificationBell** + 退出
- Content: `Outlet` 渲染子路由

### 5.2 NotificationBell

- Badge 显示未读数(来自 `notification.ts`)
- Dropdown 面板显示最近 10 条通知
- 点击跳转或标记已读
- 类型图标: 试卷 / 判分 / 错题 / 系统

### 5.3 Sidebar 菜单配置

**学生菜单:**
```
学习仪表盘 → 试题讲解(重点题+推荐题, Drawer讲题板) → 我的试卷 → 消灭错题 → [自学任务] → [通知]
```

**教师菜单:**
```
仪表盘 → 试卷管理 → 班级管理 → 统计分析 → [学生进度] → [通知]
```

**Question Admin 菜单:**
```
仪表盘 → 题库管理 → 出题管理 → 大纲/知识树 → [通知]
```

**SysAdmin 菜单:**
```
仪表盘 → 系统配置 → 基础数据 → 管理员管理 → [数据库管理] → [通知]
```

**家长菜单:**
```
鼓励仪表盘 → 发送鼓励 → 奖励目标 → 庆祝里程碑 → 关联管理
```

`[]` 标记为新增/待完善项。

---

## 6. 代码风格规范

### 6.1 JSX/TSX 统一

所有页面组件必须使用 JSX + TypeScript。禁止 `React.createElement`。

迁移状态:
- 已完成: DashboardPage, MistakeBookPage, MyPapersPage, PapersMistakeBookPage, GenerateMistakeBookTab
- 待迁移: 约 12 个文件（搜索 `createElement` 定位）

### 6.2 UI 规范

| 控件 | 尺寸 |
|------|------|
| 筛选/搜索控件 | `size="small"` |
| 表格 | `size="middle"` |
| 操作按钮 | `type="link" size="small"` |

### 6.3 API 调用

统一通过 `client.ts`:
```typescript
const { data } = await client.get('/exam-papers');
// 自动解包 {code, data} 响应
```

---

## 7. 待实现组件清单

| 组件 | 路径 | 优先级 | 说明 |
|------|------|--------|------|
| SelfStudyPage | `pages/self-study/` | 高 | 自学任务列表+详情+完成 |
| NotificationListPage | `pages/notifications/` | 中 | 通知列表页(铃铛下拉仅展示10条) |
| DatabaseManagementPage | `pages/admin/DatabaseManagementPage.tsx` | 中 | 表列表+表详情(只读) |
| ~~ParentLoginPage~~ | `pages/auth/ParentLoginPage.tsx` | - | ✅ 已完成 |
| ~~ParentDashboardPage~~ | `pages/parent/ParentDashboardPage.tsx` | - | ✅ 已完成 |
| ~~ParentEncouragePage~~ | `pages/parent/ParentEncouragePage.tsx` | - | ✅ 已完成 |
| ~~ParentRewardGoalsPage~~ | `pages/parent/ParentRewardGoalsPage.tsx` | - | ✅ 已完成 |
| ~~ParentCelebrationsPage~~ | `pages/parent/ParentCelebrationsPage.tsx` | - | ✅ 已完成 |
| ~~ParentProfilePage~~ | `pages/parent/ParentProfilePage.tsx` | - | ✅ 已完成 |
| ~~学生 DashboardPage 集成~~ | `pages/dashboard/DashboardPage.tsx` | - | ✅ 已完成(鼓励卡片+奖励进度) |
| ~~学生 ProfilePage 集成~~ | `pages/auth/ProfilePage.tsx` | - | ✅ 已完成(邀请码) |
| ~~进度图表组件~~ | - | - | ✅ 已完成(Recharts LineChart + BarChart 内联于 DashboardPage) |

### 7.1 V3.1 已完成组件 (讲题板重构)

| 组件 | 路径 | 说明 |
|------|------|------|
| ExplanationDrawer | `components/topic-board/ExplanationDrawer.tsx` | Drawer 容器，封装教授+黑板+气泡+控制器 |
| ExplanationReviewModal | `components/topic-board/ExplanationReviewModal.tsx` | 教师审核/编辑 LLM 生成的讲解步骤 |
| TypicalQuestionsPage 重构 | `pages/TypicalQuestionsPage.tsx` | Tabs(重点题+推荐题) + 讲解列 + Drawer 集成 |
| QuestionEditModal LLM 联动 | `pages/questions/QuestionEditModal.tsx` | 重点题开关 → LLM 生成 → 审核 Modal |
| MistakeBookPage 集成 | `pages/mistake-book/MistakeBookPage.tsx` | 预览 Modal 中讲解按钮 + Drawer |
| QuestionListPage 增强 | `pages/questions/QuestionListPage.tsx` | 讲解状态列 + Drawer |
| useTopicBoardStore 扩展 | `store/useTopicBoardStore.ts` | fetchSessionByQuestion + reset |

### 7.2 V3.2 已完成组件 (学习进度 + 推荐管理)

| 组件 | 路径 | 说明 |
|------|------|------|
| DashboardPage 进度图表 | `pages/dashboard/DashboardPage.tsx` | Recharts LineChart(正确率趋势) + BarChart(活跃度) + Grouped BarChart(学科对比) |
| QuestionListPage 推荐 Modal | `pages/questions/QuestionListPage.tsx` | StarOutlined 按钮 + 选班级→选学生 Modal + 已推荐显示 |
| RecommendationPage | `pages/teacher/RecommendationPage.tsx` | 推荐管理表格 + 学科/关键词筛选 + 取消推荐 |

### 7.3 V3.3 已完成组件 (去重对比视图 + 知识树版本化)

| 组件 | 路径 | 说明 |
|------|------|------|
| QuestionAdminPage 去重管理 Tab | `pages/admin/QuestionAdminPage.tsx` | 第4个Tab: 扫描重复 + Radio选择保留 + 重复组卡片 + 合并操作 |
| KnowledgeTreePage 版本回滚 | `pages/admin/KnowledgeTreePage.tsx` | 回滚按钮 + Popconfirm + PUT rollback |
| KnowledgeTreePage 版本时间线 | `pages/admin/KnowledgeTreePage.tsx` | Timeline面板 + 节点统计(active/total) + 查看/回滚操作 |
| KnowledgeTreePage VERSION_CUT | `pages/admin/KnowledgeTreePage.tsx` | 紫色Tag"版本切割" + 图例 + 详情面板 |

---

## 8. 与旧版设计差异

| 旧版(V1.0) | 当前(V3.0) |
|-----------|-----------|
| React 18 | React 19 |
| Ant Design 5.x | Ant Design 6.4 |
| Redux Toolkit / 备选 Zustand | Zustand 5 (唯一状态管理) |
| React Router v6 | React Router 7 |
| `createElement` + JSX 混用 | 统一 JSX/TSX (迁移中) |
| localStorage 直接访问 | 统一通过 `auth.ts` helper/store |
| 无通知组件 | NotificationBell + notification store |
