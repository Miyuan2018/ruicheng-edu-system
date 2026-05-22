# 需求分析报告 — edu_system V2.1.1 版本化考纲知识树

**版本: V2.1.1 | 日期: 2026-05-17**

---

## 1. 核心需求

考纲、知识点、试题构成一棵 **带版本的树**：
- 修改父节点 → 所有子孙节点自动失效
- 可按分支统一设置有效/无效
- 每个版本可追溯，支持版本对比和回滚

### 1.1 树形结构

```
Syllabus (考纲) [v1, v2, v3...]
  └── KnowledgeArea (知识领域)
        └── KnowledgePoint (知识点)
              └── Question (试题)
```

### 1.2 版本规则

| 操作 | 行为 |
|------|------|
| 创建考纲 | 生成 v1，所有节点 active=true |
| 修改节点 | 被修改节点及其所有子孙 → active=false, invalid_reason='PARENT_MODIFIED' |
| 创建新版本 | 复制当前版本所有 active 节点到新版本 |
| 分支操作 | 选中节点 + 子树 → 批量设置 active=true/false |
| 节点新增 | 在当前版本下新增节点，标记为 modified |
| 节点删除 | 软删除，标记 active=false |

### 1.3 节点状态

```
active=true   → 绿色，正常使用
active=false, reason='PARENT_MODIFIED' → 橙色，父节点变更导致失效
active=false, reason='MANUAL' → 红色，手动设为无效
active=false, reason='VERSION_CUT' → 灰色，版本切换导致
modified=true → 黄色标记，该节点在当前版本被修改过
```

---

## 2. 数据模型

### 2.1 Syllabus 版本化

```sql
ALTER TABLE syllabi ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE syllabi ADD COLUMN is_current BOOLEAN DEFAULT TRUE;
ALTER TABLE syllabi ADD COLUMN parent_syllabus_id UUID; -- 链接到上一个版本
```

一个考纲可以有多个版本（多条 syllabus 记录），`is_current=true` 的为当前激活版本。

### 2.2 知识节点树

```sql
CREATE TABLE knowledge_nodes (
    id UUID PRIMARY KEY,
    syllabus_id UUID NOT NULL REFERENCES syllabi(id),
    parent_id UUID REFERENCES knowledge_nodes(id),  -- 树结构
    name VARCHAR(100) NOT NULL,
    node_type VARCHAR(20) NOT NULL,   -- AREA / POINT
    sort_order INTEGER DEFAULT 0,
    -- 版本与状态
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    invalid_reason VARCHAR(30),       -- PARENT_MODIFIED / MANUAL / VERSION_CUT
    is_modified BOOLEAN DEFAULT FALSE, -- 在当前版本被修改过
    -- 内容
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_knowledge_nodes_syllabus ON knowledge_nodes(syllabus_id, version);
CREATE INDEX idx_knowledge_nodes_parent ON knowledge_nodes(parent_id);
```

### 2.3 试题关联

```sql
-- questions 表已有字段，补充关联到知识节点版本
ALTER TABLE questions ADD COLUMN knowledge_node_id UUID REFERENCES knowledge_nodes(id);
```

---

## 3. API 设计

### 3.1 版本管理

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/v1/syllabi/{id}/new-version` | 基于当前版本创建新版本 |
| GET | `/api/v1/syllabi/{id}/versions` | 获取版本列表 |
| PUT | `/api/v1/syllabi/{id}/switch-version` | 切换当前激活版本 |

### 3.2 知识节点树

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/syllabi/{id}/tree?version=1` | 获取指定版本的知识树 |
| POST | `/api/v1/syllabi/{id}/nodes` | 新增节点 |
| PUT | `/api/v1/syllabi/{id}/nodes/{node_id}` | 修改节点（触发子孙失效） |
| DELETE | `/api/v1/syllabi/{id}/nodes/{node_id}` | 软删除节点+子树 |
| POST | `/api/v1/syllabi/{id}/nodes/{node_id}/set-branch-active` | 设置分支有效/无效 |

### 3.3 节点操作响应

```json
// PUT /nodes/{id} 修改节点后的响应
{
  "node_id": "xxx",
  "modified": true,
  "affected_descendants": 12,  // 被设为失效的子孙节点数
  "invalid_nodes": ["id1", "id2", ...]
}
```

---

## 4. 前端 UI 设计

### 4.1 页面布局

```
┌──────────────────────────────────────────────────────────┐
│  考纲: [八年级数学(上海)]  版本: [v1 ▾] [v2 ▾] [+新版本] │
├────────────────────┬─────────────────────────────────────┤
│  知识树 (左 40%)    │  节点详情 + 操作 (右 60%)          │
│                    │                                     │
│  📗 数与代数 ✓     │  节点名称: [数与代数        ]      │
│  ├ 📕 实数 ✓       │  节点类型: 知识领域                 │
│  │ ├ 📝 无理数 ✓   │  状态: 🟢 有效                     │
│  │ └ 📝 平方根 ✓   │  子节点: 3 个                      │
│  ├ 📕 代数式 ⚠️    │  试题数: 5 道                      │
│  │ ├ 📝 整式 ✗     │                                     │
│  │ └ 📝 分式 ⚠️    │  [编辑节点] [添加子节点]           │
│  └ 📕 方程   ✗     │  [标记分支有效] [标记分支无效]     │
│                    │  [删除分支]                         │
│  图例:             │                                     │
│  ✓有效 ⚠️父变更 ✗无效 🔧已修改 │  ─── 修改历史 ───           │
│                    │  2026-05-17: 修改"代数式"→子节点失效│
│                    │  2026-05-16: 新增"无理数"节点       │
└────────────────────┴─────────────────────────────────────┘
```

### 4.2 交互流程

**修改节点**:
1. 点击节点 → 右侧显示详情
2. 点击"编辑节点" → 弹出编辑框
3. 确认修改 → 系统提示："该节点有 3 个子节点将被设为失效，是否继续?"
4. 用户确认 → 节点更新，子树节点状态变为 ⚠️

**分支操作**:
1. 选中父节点
2. 点击"标记分支有效" → 该节点及所有子孙 → active=true
3. 点击"标记分支无效" → 该节点及所有子孙 → active=false

**创建新版本**:
1. 点击"+新版本"按钮
2. 系统复制当前版本所有 active 节点
3. 新版本成为当前激活版本
4. 旧版本保留用于追溯

### 4.3 视觉设计

- 节点图标: 📗考纲 📕知识领域 📝知识点 📋试题
- 状态颜色:
  - 绿色边框 + ✓ = 有效
  - 橙色边框 + ⚠️ = 父节点变更导致失效
  - 红色边框 + ✗ = 手动设为无效
  - 黄色圆点 = 当前版本被修改过
- 树节点 hover 显示操作按钮（编辑/添加/删除）
- 批量选择: 支持 Ctrl/Shift 多选节点进行分支操作

---

## 5. 实施计划

| 步骤 | 内容 | 预计 |
|------|------|------|
| 1 | KnowledgeNode 模型 + 迁移 | 1h |
| 2 | Syllabus 版本管理 API | 1h |
| 3 | KnowledgeNode 树 CRUD API + 失效联动 | 2h |
| 4 | 前端树组件（Ant Design Tree + 自定义渲染） | 2h |
| 5 | 前端节点编辑面板 + 分支操作 | 2h |
| 6 | 版本切换 + 创建新版本 | 1h |
| 7 | 集成测试 | 1h |
