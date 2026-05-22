# 需求分析报告 — edu_system V2.1
**版本: V2.1 | 日期: 2026-05-17 | 基于 V2.0 交付现状分析**

---

## 1. V2.0 交付审计

| 链路 | 状态 | 说明 |
|------|------|------|
| S1 判卷链路 | ✅ | 规则匹配引擎完成，客观题自动判卷 |
| S2 错题本链路 | ✅ | 判卷后自动生成错题本 |
| S3 OCR 链路 | ✅ | 存储+上传UI就绪，OCR引擎可替换 |
| S4 通知服务 | ⚠️ | 数据模型就绪，推送未实质实现 |
| S5 基础设施 | ⚠️ | SQLite运行中，PG/Redis/测试待推进 |
| S6 前端增强 | ⚠️ | KaTeX/图表待集成 |
| S7 部署 | ⚠️ | Docker Compose存在，K8s/CI/CD待做 |

---

## 2. V2.1 核心需求

### 2.1 新增角色: 题库管理员 (QUESTION_ADMIN)

```
角色体系: ADMIN → QUESTION_ADMIN → TEACHER → STUDENT
```

| 权限 | 说明 |
|------|------|
| 大模型选择 | 从管理员配置的模型列表中选择本地/在线LLM |
| 考纲管理 | 按年级+省/地区生成考纲、上传考纲 |
| 知识点生成 | 基于考纲调用LLM自动生成知识点树 |
| 试题生成 | 按知识点+难度+题型调用LLM批量生成试题 |
| 试题审核 | 预览/修改/确认生成试题→转为正式试题 |
| 网络抓取 | 按知识点异步抓取网上试题，显示进度、可终止 |
| 试题去重 | 按知识点+难度+相似度去重，预览后批量确认 |
| 试题来源管理 | 管理正式/预备/抓取/学生上传四种试题状态 |

### 2.2 试题生命周期状态机

```
                      ┌─────────────┐
                      │  学生上传    │
                      └──────┬──────┘
                             │ OCR识别
                             ▼
┌──────────┐   LLM生成   ┌─────────┐   审核通过   ┌──────────┐
│  预备试题  │ ◄────────── │  待审核  │ ──────────► │  正式试题  │
│ (PREP)   │ ──────────► │(PENDING)│             │ (ACTIVE)  │
└──────────┘   提交审核    └─────────┘             └──────────┘
      ▲                         ▲                       │
      │                         │ 审核驳回               │ 停用
      │         ┌──────────┐    │                       ▼
      └─────────│  抓取试题  │───┘               ┌──────────┐
                │ (SCRAPED) │                    │   已停用   │
                └──────────┘                    │(INACTIVE) │
                                                └──────────┘
```

- **试题来源**: MANUAL(人工创建) / LLM_GENERATED(大模型生成) / SCRAPED(网络抓取) / OCR_UPLOAD(学生上传)
- **审核状态**: PENDING(待审核) / APPROVED(已通过) / REJECTED(已驳回) / NEEDS_REVIEW(需人工复核)

### 2.3 考纲管理

```
考纲 → 知识点树 → 试题
```

| 功能 | 说明 |
|------|------|
| 生成考纲 | 选择年级+省份/地区 → LLM生成对应考纲 |
| 上传考纲 | 支持PDF/Word/JSON格式上传 |
| 预览编辑 | 可视化考纲结构，支持修改 |
| 知识点提取 | 从考纲中自动提取知识点层级结构 |
| 知识点编辑 | 题库管理员预览并修改知识点(名称/层级/权重) |

### 2.4 LLM 试题生成

| 参数 | 说明 |
|------|------|
| 知识点 | 选择一个或多个知识点 |
| 难度 | EASY / MEDIUM / HARD |
| 题型 | 单选/多选/填空/解答 |
| 数量 | 每知识点每题型生成数量 |
| 模型 | 从管理员配置的模型列表中选择 |

**生成后流程**: 预览列表 → 逐题查看/修改 → 批量确认 → 转为预备试题 → 审核后转为正式试题

### 2.5 网络抓取

| 功能 | 说明 |
|------|------|
| 抓取源配置 | 预设教育网站URL、搜索关键词 |
| 异步执行 | 后台任务，不阻塞UI |
| 进度显示 | WebSocket实时推送抓取进度 |
| 可终止 | 支持中途取消抓取任务 |
| 结果预览 | 抓取结果存入预备试题库，预览后确认 |
| 频率控制 | 遵守robots.txt，每秒≤1请求 |

### 2.6 试题去重

| 维度 | 说明 |
|------|------|
| 知识点匹配 | 相同知识点的试题分组 |
| 难度匹配 | 相同难度的试题分组 |
| 文本相似度 | 基于文本指纹(SimHash/MinHash)计算相似度 |
| 预览模式 | 并排显示相似试题，标出差异 |
| 批量操作 | 批量确认保留/合并/删除 |

---

## 3. 数据模型变更

### 3.1 新增字段

```sql
-- questions 表新增字段
ALTER TABLE questions ADD COLUMN source VARCHAR(20) DEFAULT 'MANUAL';
-- MANUAL / LLM_GENERATED / SCRAPED / OCR_UPLOAD

ALTER TABLE questions ADD COLUMN review_status VARCHAR(20) DEFAULT 'APPROVED';
-- PENDING / APPROVED / REJECTED / NEEDS_REVIEW

ALTER TABLE questions ADD COLUMN reviewed_by UUID REFERENCES users(id);
ALTER TABLE questions ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE questions ADD COLUMN source_task_id UUID; -- 关联生成/抓取任务
```

### 3.2 新增表

```sql
-- 考纲表
CREATE TABLE syllabi (
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    grade_level VARCHAR(20),
    province VARCHAR(50),       -- 省份/地区
    content JSONB,              -- 考纲结构化内容
    knowledge_tree JSONB,       -- 提取的知识点树
    status VARCHAR(20),         -- DRAFT / ACTIVE / ARCHIVED
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 试题生成/抓取任务表
CREATE TABLE question_tasks (
    id UUID PRIMARY KEY,
    task_type VARCHAR(20),      -- LLM_GENERATE / WEB_SCRAPE
    status VARCHAR(20),         -- PENDING / RUNNING / COMPLETED / FAILED / CANCELLED
    progress INTEGER DEFAULT 0, -- 0-100
    total_items INTEGER,
    completed_items INTEGER DEFAULT 0,
    parameters JSONB,           -- 任务参数
    result_summary JSONB,       -- 结果摘要
    error_message TEXT,
    model_used VARCHAR(100),    -- 使用的大模型
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 大模型配置表(管理员配置)
CREATE TABLE llm_configs (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    provider VARCHAR(50),       -- ollama / vllm / openai / custom
    endpoint VARCHAR(500),      -- API endpoint
    model_name VARCHAR(100),    -- 模型名称
    is_local BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    config JSONB,               -- 温度/top_p等参数
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. API 设计

### 4.1 题库管理员 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/llm-configs` | 获取可用大模型列表 |
| POST | `/api/v1/syllabi` | 创建/上传考纲 |
| GET | `/api/v1/syllabi` | 考纲列表 |
| GET | `/api/v1/syllabi/{id}` | 考纲详情 |
| PUT | `/api/v1/syllabi/{id}` | 更新考纲 |
| POST | `/api/v1/syllabi/{id}/extract-knowledge` | 从考纲提取知识点 |
| POST | `/api/v1/questions/generate` | LLM批量生成试题(异步) |
| GET | `/api/v1/questions/tasks/{task_id}` | 查询生成任务状态 |
| POST | `/api/v1/questions/tasks/{task_id}/cancel` | 取消生成任务 |
| POST | `/api/v1/questions/scrape` | 启动网络抓取(异步) |
| GET | `/api/v1/questions/tasks/{task_id}/progress` | WebSocket抓取进度 |
| GET | `/api/v1/questions/pending` | 获取待审核试题列表 |
| POST | `/api/v1/questions/{id}/approve` | 审核通过试题 |
| POST | `/api/v1/questions/{id}/reject` | 驳回试题 |
| POST | `/api/v1/questions/batch-approve` | 批量审核通过 |
| POST | `/api/v1/questions/deduplicate` | 触发去重检测 |
| GET | `/api/v1/questions/deduplicate/{task_id}` | 获取去重结果 |

### 4.2 管理员配置 API

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/v1/admin/llm-configs` | 添加大模型配置 |
| GET | `/api/v1/admin/llm-configs` | 大模型配置列表 |
| PUT | `/api/v1/admin/llm-configs/{id}` | 更新大模型配置 |
| DELETE | `/api/v1/admin/llm-configs/{id}` | 删除大模型配置 |

---

## 5. 实施计划

### 阶段划分

| 阶段 | 内容 | 预计时间 |
|------|------|----------|
| **P1: 角色+考纲** | QUESTION_ADMIN角色、考纲CRUD、知识点提取 | 3天 |
| **P2: LLM试题生成** | 大模型配置、试题生成API、预览修改 | 3天 |
| **P3: 审核流程** | 试题状态机、审核通过/驳回、批量操作 | 2天 |
| **P4: 网络抓取** | 异步抓取、进度推送、可终止 | 3天 |
| **P5: 试题去重** | SimHash文本指纹、相似度计算、去重预览 | 2天 |
| **P6: 前端整合** | 题库管理员页面、生成/抓取/审核/去重UI | 3天 |

### 依赖关系

```
P1(角色+考纲) → P2(LLM生成) → P3(审核流程)
                              → P4(网络抓取)
                              → P5(试题去重)
                                             → P6(前端整合)
```

---

## 6. 验收标准

1. 题库管理员可登录并看到专属功能菜单
2. 可从下拉列表选择大模型(本地/在线)
3. 可按年级+省份生成考纲，查看/编辑知识点树
4. 可选择知识点+难度+题型，调用LLM批量生成试题
5. 生成试题可逐题预览修改，批量确认或驳回
6. 网络抓取异步执行，WebSocket实时显示进度，可终止
7. 抓取试题存入预备试题库，需审核后转为正式试题
8. 学生OCR上传的试题同样进入待审核流程
9. 试题去重按知识点+难度+相似度分组，支持并排预览和批量确认
10. 正式试题、预备试题、抓取试题、学生上传试题分Tab展示
