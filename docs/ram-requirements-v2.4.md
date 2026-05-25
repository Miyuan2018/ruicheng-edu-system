# V2.4 管理端页面重组

## 变更概述

V2.4 对 SYSAdmin 管理端进行页面结构重组，将原来集中在"系统配置"页面中的 7 个配置卡片按功能领域拆分为独立的菜单和分页布局。

## 一、菜单调整

SYS_ADMIN 左侧菜单：

| 菜单项 | 路由 | 图标 | 说明 |
|--------|------|------|------|
| 系统概览 | `/dashboard` | DashboardOutlined | 不变 |
| 基础参数配置 | `/admin/basic-config` | AppstoreOutlined | **新增** |
| 管理员账号 | `/admin/sys-admin` | UserOutlined | 不变 |
| 系统配置 | `/admin/config` | SettingOutlined | 内容重组 |

## 二、基础参数配置页面

路由: `/admin/basic-config`

### Tab 1: 学科管理
- 学科列表表格（名称 / 分类 / 状态 / 操作）
- 每行操作: **编辑** + **停用**（软删除）
- 添加学科按钮 → Modal 表单（名称 + 分类）
- API: `GET/POST /subjects`, `PUT/DELETE /subjects/{id}`

### Tab 2: 应用参数
- **判卷设置**: 最大并发判卷数 + 判卷模型选择
- **错题本设置**: 每道错题配练习题数量
- **试题导出上限**: 最大导出数量（0=禁用）

## 三、系统配置页面（重组）

路由: `/admin/config`（不变）

### Tab 1: 大模型配置
- Ollama 访问地址 + 测试连接按钮
- 模型选择下拉框

### Tab 2: OCR 设置
- OCR 引擎选择（PaddleOCR / Tesseract）
- 最大并发 OCR 数
- 置信度阈值

### Tab 3: 数据库设置
- PostgreSQL 连接信息只读展示
- 数据库大小 / 表数量 / 总记录数
- 刷新按钮

### Tab 4: 其他设置
- 日志级别（DEBUG/INFO/WARNING/ERROR）
- 自动备份开关 — **二期实现**（标记 Tag，开关 disabled）

## 四、二期规划

以下功能列入 Phase 2 需求池：

| 功能 | Tab 位置 | 状态 |
|------|---------|------|
| 日志级别生效 | 系统配置 > 其他设置 | 二期，需后端日志框架对接 |
| 自动备份 | 系统配置 > 其他设置 | 二期，需实现 PostgreSQL 自动备份策略 |

## 五、文件变更清单

| 操作 | 文件 |
|------|------|
| 修改 | `src/components/layout/AppLayout.tsx` |
| 新建 | `src/pages/admin/BasicConfigPage.tsx` |
| 重写 | `src/pages/admin/AdminConfigPage.tsx` |
| 修改 | `src/router.tsx` |
| 更新 | `docs/ram-requirements-v2.4.md` |

---

## 六、试卷适用范围 (grade_level) 结构定义

### 6.1 JSON 结构

`exam_papers.grade_level` 列类型为 JSONB，结构如下：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scope` | string | 是 | `comprehensive` / `grade_comprehensive` / `chapter` / `knowledge_point` |
| `grades` | string[] | 是 | 年级编码数组，如 `["G7","G8"]` |
| `chapter` | string | 否 | 章节名称（scope=chapter/knowledge_point 时必填） |
| `knowledge_points` | string[] | 否 | 知识点列表（scope=knowledge_point 时必填） |

### 6.2 四种范围示例

```json
// 综合 — 跨年级统考
{ "scope": "comprehensive", "grades": ["G5","G6","G7","G8","G9"] }

// 年级综合 — 单年级综合测试
{ "scope": "grade_comprehensive", "grades": ["G8"] }

// 章节 — 章节测试
{ "scope": "chapter", "grades": ["G8"], "chapter": "二次函数" }

// 知识点 — 知识点专项（知识点在章节下层）
{ "scope": "knowledge_point", "grades": ["G8"], "chapter": "二次函数", "knowledge_points": ["顶点式","判别式","图像平移"] }
```

### 6.3 使用场景

#### 新建试卷 (PaperEditModal) 和 试卷录入 (PaperImportModal) 和 拍照扫描 (PhotoScanTab)

步骤1「基本信息」→「年级范围」区域：

| 适用范围 | 年级 | 章节名称 | 知识点 |
|---------|------|---------|--------|
| 综合 | 多选 | — | — |
| 年级综合 | 单选 | — | — |
| 章节 | 单选 | 同行输入框 | — |
| 知识点 | 单选 | 同行输入框 | 下一行，逗号分隔，提示"多个知识点用逗号分隔" |

### 6.4 试卷管理筛选逻辑

`/exam-papers` 列表页筛选栏：

```
[试卷名称] [适用范围▼] [年级▼] [模糊查询章节/知识点] [状态▼] [刷新]
```

| 适用范围 | 年级 | 额外输入 | 后端查询 |
|---------|------|---------|---------|
| 综合 | 多选 | — | `scope='comprehensive'` + `grades ?\| [G7,G8]` |
| 年级综合 | 单选 | — | `scope='grade_comprehensive'` + `grades @> [G8]` |
| 章节 | 单选 | 模糊查询输入框 | `chapter ILIKE %kw%` OR `knowledge_points ILIKE %kw%` |
| 知识点 | 单选 | 模糊查询输入框 | 同上 |

后端 API `GET /exam-papers` 新增参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| `scope` | string | 精确匹配 `grade_level->>'scope'` |
| `grade` | string | JSONB 包含查询 `grade_level->'grades' @> [grade]` |
| `grades` | string | 逗号分隔多年级，JSONB `?\|` 任意匹配 |
| `keyword` | string | ILIKE 模糊搜索 `chapter` 和 `knowledge_points` |

---

## 七、配置系统

### 7.1 配置文件统一为 sysconfig.json

所有应用配置集中在 `backend/sysconfig.json`，JSON 格式。`.env` 仅保留 `SECRET_KEY`。

```json
{
  "secret_key": "...",
  "database": { "server": "localhost", "port": "5433", "database": "edu_system", "user": "postgres", "password": "postgres" },
  "llm": {
    "current": "deepseek",
    "ollama": { "endpoint": "...", "model": "...", "available_models": [...] },
    "deepseek": { "endpoint": "https://api.deepseek.com/anthropic/v1/messages", "api_key": "...", "model": "...", "available_models": [...] }
  },
  "grading": { "max_concurrent_grading": 1, "grading_model": "hybrid" },
  "ocr": { "ocr_engine": "paddleocr", "max_concurrent_ocr": 5, "ocr_confidence_threshold": 0.8 },
  "mistake_book": { "practice_question_count": 5 },
  "export_max": 200,
  "system": { "log_level": "INFO", "backup_enabled": false }
}
```

### 7.2 大模型 Provider 支持

| Provider | 端点 | 认证 | 前端配置 |
|----------|------|------|---------|
| Ollama | sysconfig → endpoint | 无 | 地址 + 模型下拉 + 测试连接 |
| DeepSeek | Anthropic 兼容接口 `/anthropic/v1/messages` | x-api-key | API Key + 模型下拉 + 测试连接 |

Provider 配置在 `llm.ollama` 和 `llm.deepseek` 两个独立节点，`llm.current` 记录当前激活的 provider。

## 八、角色体系

### 8.1 角色存储

| 角色 | 存储表 | admin_type |
|------|--------|-----------|
| 超级管理员 | sys_admins | — |
| 教师 | admins | 0 |
| 题库管理员 | admins | 1 |
| 校长 | admins | 2 (保留) |
| 教务主任 | admins | 3 (保留) |
| 学管 | admins | 4 (保留) |
| 班主任 | admins | 5 (保留) |
| 家长 | parents | — |
| 学生 | students | — |

`roles` 参考表存储角色编码和描述信息。

### 8.2 教师权限范围

创建/编辑管理员时配置：
- **学科权限**：多选，从学科表读取
- **年级上限**：单选，代表教师可访问的最高年级（含及以下）

题库管理员自动获得全部学科和最高年级权限。

## 九、试卷/试题适用范围 (grade_level)

### 9.1 JSONB 结构

`exam_papers.grade_level` 和 `questions.grade_level` 统一为 JSONB：

```json
{ "scope": "comprehensive", "grades": ["G5","G6","G7","G8","G9"] }
{ "scope": "grade_comprehensive", "grades": ["G8"] }
{ "scope": "chapter", "grades": ["G8"], "chapter": "二次函数" }
{ "scope": "knowledge_point", "grades": ["G8"], "chapter": "二次函数", "knowledge_points": ["顶点式","判别式"] }
```

### 9.2 scope 枚举

| scope | 含义 | 年级 | 额外字段 |
|-------|------|------|---------|
| comprehensive | 跨年级综合 | 多选 | — |
| grade_comprehensive | 年级综合 | 单选 | — |
| chapter | 章节 | 单选 | chapter |
| knowledge_point | 知识点 | 单选 | chapter + knowledge_points(逗号分隔) |

### 9.3 适用范围 UI

新建试卷/拍照扫描/试卷录入：
- 适用范围下拉 + 年级选择（综合多选，其余单选）
- 章节/知识点时显示章节名称输入
- 知识点时额外显示知识点输入（逗号分隔，AND关系）

### 9.4 筛选逻辑

试卷管理/试题管理筛选栏：
- 适用范围 → 后端 `grade_level->>'scope'` 精确匹配
- 年级 → 综合时多选（`?|` 任意匹配），其余单选（`@>` 包含）
- 模糊查询 → ILIKE 搜索 `chapter` 和 `knowledge_points`

## 十、智能出题模块

### 10.1 LLM 生成试题

- Provider 选择（Ollama/DeepSeek）+ 模型选择 + 测试连接
- 条件：学科、年级、知识点(逗号分隔=AND)、难度、题型、数量
- 右侧实时显示 Prompt 预览
- 知识点自动写入 `grade_level.chapter` 和 `knowledge_points`

### 10.2 网络抓取试题

- 搜索+LLM 混合方案：Bing 搜索 → LLM 格式化 → 自动入库
- 条件与 LLM 生成一致
- 右侧显示抓取条件预览
- 结果直接入库，下方列表展示

### 10.3 试题列表

- 筛选：搜索题目、题型、难度、年级、模糊查询知识点
- 每页 10 条，独立 Pagination 组件
- 编辑功能：调用 QuestionEditModal
- 启用/停用切换
- 批量删除

## 十一、数据清理

- 移除 `users` 统一用户表，FK 重映射到 `admins`/`students`/`sys_admins`
- `questions.grade_level` 和 `exam_papers.grade_level` 从 VARCHAR 改为 JSONB
- `admins.subjects` 和 `admins.grade_level` JSON → JSONB + GIN 索引
- 所有参考数据表（question_types、difficulty_levels、grade_levels 等）通过 API 管理
