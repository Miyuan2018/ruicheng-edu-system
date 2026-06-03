# Step2 试卷结构改版 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 Step2 试卷结构页面 — 去掉模式切换，统一为单元列表 + 五种语义模板选择器

**Architecture:** 后端新增 template_type 字段驱动纸质格式渲染；前端 StructureStep 重写为三区域布局（模板选择器 + 编辑区 + 汇总栏），模板 B 使用平表视图，其他模板使用卡片视图。难度比值从 Step2 移至 Step1。

**Tech Stack:** FastAPI + PostgreSQL + React 19 + Ant Design 6 + TypeScript + Zustand 5

---

### Task 1: 后端 — ExamPaper 模型新增 template_type

**Files:**
- Modify: `backend/app/models/exam_paper.py:46-66`

- [ ] **Step 1: 添加 template_type 列**

在 `ExamPaper` 类中，`per_unit_timer` 之后添加：

```python
template_type = Column(String(30), nullable=False, default='generic', server_default='generic')
```

修改后 `ExamPaper` 类的列定义区域（第60行后插入）：

```python
    show_units = Column(Boolean, nullable=False, default=True)
    per_unit_timer = Column(Boolean, nullable=False, default=False)
    template_type = Column(String(30), nullable=False, default='generic', server_default='generic')  # knowledge_block|question_type|difficulty_progression|volume|generic
    difficulty_ratio = Column(JSONB, nullable=True)
```

- [ ] **Step 2: 验证模型加载**

```bash
cd backend && python -c "from app.models.exam_paper import ExamPaper; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/exam_paper.py
git commit -m "feat: ExamPaper 模型新增 template_type 列"
```

---

### Task 2: 后端 — 数据库迁移

**Files:**
- Create: `backend/alembic/versions/005_add_template_type.py`

- [ ] **Step 1: 创建迁移文件**

```python
"""Add template_type column to exam_papers

Revision ID: 005_add_template_type
Revises: 006_v43_drafts
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa

revision = '005_add_template_type'
down_revision = '006_v43_drafts'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('exam_papers',
        sa.Column('template_type', sa.String(30), nullable=False,
                  server_default='generic'))
    # 存量数据: show_units=false 的试卷 → 'question_type'
    op.execute(
        "UPDATE exam_papers SET template_type = 'question_type' WHERE show_units = false"
    )


def downgrade():
    op.drop_column('exam_papers', 'template_type')
```

- [ ] **Step 2: 运行迁移**

```bash
cd backend && conda activate ~/conda_workspace && alembic upgrade head
```

Expected: 迁移成功，无报错。

- [ ] **Step 3: 验证列存在**

```bash
cd backend && python -c "
from app.db.session import get_session
from sqlalchemy import text
async def check():
    async with get_session() as s:
        r = await s.execute(text(\"SELECT column_name FROM information_schema.columns WHERE table_name='exam_papers' AND column_name='template_type'\"))
        print('EXISTS' if r.fetchone() else 'MISSING')
import asyncio
asyncio.run(check())
"
```

Expected: `EXISTS`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/005_add_template_type.py
git commit -m "feat: 迁移 — exam_papers 新增 template_type 列"
```

---

### Task 3: 后端 — Schema 更新

**Files:**
- Modify: `backend/app/schemas/exam_paper.py:95-109`

- [ ] **Step 1: ExamPaperFullSave 新增 template_type**

在第108行 `difficulty_ratio` 之前插入 `template_type`：

```python
class ExamPaperFullSave(BaseModel):
    """完整试卷保存 — 原子覆盖所有单元和题目"""
    title: str = Field(..., max_length=200)
    subject: Optional[str] = None
    grade_level: Optional[GradeLevel] = None
    total_score: int = Field(ge=0, default=0)
    duration_minutes: Optional[int] = None
    status: str = "READY"
    subtitle: Optional[str] = None
    instructions: Optional[str] = None
    description: Optional[str] = None
    show_units: bool = True
    per_unit_timer: bool = False
    template_type: str = "generic"  # knowledge_block|question_type|difficulty_progression|volume|generic
    difficulty_ratio: Optional[dict] = None
    units: list[ExamPaperUnitCreate] = []
```

- [ ] **Step 2: ExamPaperResponse 新增 template_type**

```python
class ExamPaperResponse(ExamPaperBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    unit_count: int = 0
    question_count: int = 0
    template_type: str = "generic"  # 新增

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 3: 验证 schema 导入**

```bash
cd backend && python -c "from app.schemas.exam_paper import ExamPaperFullSave; print(ExamPaperFullSave.model_fields.keys())"
```

Expected: 输出中应包含 `template_type`

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/exam_paper.py
git commit -m "feat: ExamPaperFullSave/Response schema 新增 template_type 字段"
```

---

### Task 4: 前端 — types/paper.ts 新增 template_type

**Files:**
- Modify: `frontend/src/types/paper.ts:55-71`

- [ ] **Step 1: PaperDraft 新增 template_type**

```typescript
export interface PaperDraft {
  id?: string;
  title: string;
  subject: string;
  grade_level: any;
  duration_minutes?: number | null;
  difficulty_ratio: DifficultyRatio;
  total_score: number;
  status: string;
  subtitle?: string;
  instructions?: string;
  description?: string;
  template_type: TemplateType;              // 新增
  show_units: boolean;                       // 保留兼容，由 template_type 隐式决定
  per_unit_timer: boolean;
  units: ExamPaperUnit[];
  knowledge_node_ids: string[];
}
```

在 types/paper.ts 顶部或 PaperDraft 前面添加类型定义：

```typescript
export type TemplateType = 'knowledge_block' | 'question_type' | 'difficulty_progression' | 'volume' | 'generic';
```

- [ ] **Step 2: PaperListItem 新增 template_type**

```typescript
export interface PaperListItem {
  // ... 现有字段 ...
  template_type?: string;
}
```

- [ ] **Step 3: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit --pretty false 2>&1 | head -30
```

Expected: 无新增类型错误。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/paper.ts
git commit -m "feat: PaperDraft 类型新增 template_type 字段"
```

---

### Task 5: 前端 — store/paperEditor.ts 更新

**Files:**
- Modify: `frontend/src/store/paperEditor.ts:62-77, 86-111, 131`

- [ ] **Step 1: newEmptyPaper 新增 template_type 默认值**

```typescript
const newEmptyPaper = (): PaperDraft => ({
  title: '',
  subject: '',
  grade_level: { scope: 'grade_comprehensive', grades: [] },
  duration_minutes: null,
  difficulty_ratio: { EASY: 20, MEDIUM: 50, HARD: 30 },
  total_score: 0,
  status: 'READY',
  subtitle: '',
  instructions: '',
  description: '',
  template_type: 'generic',   // 新增：默认通用模板
  show_units: false,           // 废弃，保留兼容
  per_unit_timer: false,
  units: [],
  knowledge_node_ids: [],
});
```

- [ ] **Step 2: initNew 重置时保留 template_type**

`initNew` 无需修改 — 它调用 `newEmptyPaper()` 已包含默认值。

- [ ] **Step 3: saveAll 中传递 template_type 到后端**

在 `saveAll` 函数的 `cleanPaper` 对象中新增 `template_type`：

```typescript
const cleanPaper = {
  ...currentPaper,
  grade_level: normalizeGradeLevel(currentPaper.grade_level),
  template_type: currentPaper.template_type,  // 新增
  units: currentPaper.units.map(u => ({
    // ... 现有映射
  })),
};
```

- [ ] **Step 4: initNew 增加 setTemplate 方法支持模板选择**

在 zustand store 中新增 action（放在 `addQuickUnits` 之后）：

```typescript
// 在 PaperEditorState interface 中添加
setTemplate: (templateType: TemplateType) => void;

// 在 create 中添加实现
setTemplate: (templateType) => {
  const { paper } = get();
  if (!paper) return;
  const presetUnits = getTemplatePreset(templateType);
  set({
    paper: {
      ...paper,
      template_type: templateType,
      units: presetUnits,
      show_units: templateType !== 'question_type',
    },
    dirty: true,
  });
},
```

添加模板预设函数（在 store 文件底部，`QUICK_PRESETS` 附近）：

```typescript
import type { TemplateType } from '../types/paper';

const TEMPLATE_PRESETS: Record<TemplateType, ExamPaperUnit[]> = {
  knowledge_block: [
    { name: '未命名模块', position: 1, question_config: [], time_limit_minutes: null },
  ],
  question_type: [
    { name: '', position: 1, question_config: [
      { question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 4 },
      { question_type: 'MULTIPLE_CHOICE', count: 0, score_per_question: 6 },
      { question_type: 'FILL_BLANK', count: 0, score_per_question: 4 },
      { question_type: 'SUBJECTIVE', count: 0, score_per_question: 10 },
    ]},
  ],
  difficulty_progression: [
    { name: '基础巩固', position: 1, question_config: [], time_limit_minutes: null },
    { name: '能力提升', position: 2, question_config: [], time_limit_minutes: null },
    { name: '拓展挑战', position: 3, question_config: [], time_limit_minutes: null },
  ],
  volume: [
    { name: '第I卷（选择题）', position: 1, question_config: [], time_limit_minutes: null },
    { name: '第II卷（非选择题）', position: 2, question_config: [], time_limit_minutes: null },
  ],
  generic: [
    { name: '新单元', position: 1, question_config: [], time_limit_minutes: null },
  ],
};

function getTemplatePreset(type: TemplateType): ExamPaperUnit[] {
  const tempId = () => '_temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  return TEMPLATE_PRESETS[type].map((t, i) => ({ ...t, id: tempId() + '_' + i }));
}
```

- [ ] **Step 5: loadDraft 加载草稿时恢复 template_type**

`loadDraft` 从后端读取已有试卷。后端响应需包含 `template_type`。确认 `paperApi.preview()` 和草稿恢复逻辑能保留该字段（`...paperData` 展开已包含）。

- [ ] **Step 6: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit --pretty false 2>&1 | head -30
```

Expected: 无新增类型错误。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/store/paperEditor.ts
git commit -m "feat: paperEditor store 新增 setTemplate + 五种模板预设"
```

---

### Task 6: 前端 — BasicInfoStep 移入难度比值

**Files:**
- Modify: `frontend/src/pages/papers/steps/BasicInfoStep.tsx`

- [ ] **Step 1: 在 BasicInfoStep 中新增难度比值区域**

在 `instructions` 表单项之后、`Collapse` 高级设置之前，插入难度比值区域：

```tsx
{/* 难度比值 — 从 Step2 移至 Step1 */}
<Divider style={{ margin: '4px 0 12px 0' }} />
<div style={{ marginBottom: 16 }}>
  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>
    难度比值 <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>— 智能选题时按此比例分配题数</span>
  </div>
  <Row gutter={12}>
    {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => {
      const colors: Record<string, string> = { EASY: '#52c41a', MEDIUM: '#faad14', HARD: '#ff4d4f' };
      const bgColors: Record<string, string> = { EASY: '#f6ffed', MEDIUM: '#fffbe6', HARD: '#fff2f0' };
      const borderColors: Record<string, string> = { EASY: '#b7eb8f', MEDIUM: '#ffe58f', HARD: '#ffccc7' };
      const labels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
      const diffRatio = paper?.difficulty_ratio || { EASY: 20, MEDIUM: 50, HARD: 30 };
      return (
        <Col span={8} key={d}>
          <div style={{
            background: bgColors[d], border: `2px solid ${borderColors[d]}`,
            borderRadius: 8, padding: '8px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: colors[d], marginBottom: 2 }}>{labels[d]}</div>
            <InputNumber
              size="small" variant="borderless"
              style={{ fontSize: 20, fontWeight: 700, color: colors[d], textAlign: 'center', width: '100%' }}
              value={diffRatio[d]}
              min={0} max={100}
              onChange={(v) => {
                const newRatio = { ...diffRatio, [d]: v || 0 };
                updateMeta({ difficulty_ratio: newRatio });
              }}
              suffix={<span style={{ fontSize: 14, color: colors[d] }}>%</span>}
            />
          </div>
        </Col>
      );
    })}
  </Row>
  {(() => {
    const dr = paper?.difficulty_ratio || { EASY: 20, MEDIUM: 50, HARD: 30 };
    const total = (dr.EASY || 0) + (dr.MEDIUM || 0) + (dr.HARD || 0);
    return (
      <div style={{ fontSize: 11, textAlign: 'center', marginTop: 6, color: total === 100 ? '#52c41a' : '#ff4d4f' }}>
        {total === 100 ? '✓ 合计 100%' : `⚠ 合计 ${total}%（需为100%）`}
      </div>
    );
  })()}
</div>
```

- [ ] **Step 2: 从 StructureStep 删除难度比值区域**

删除 `frontend/src/pages/papers/steps/StructureStep.tsx` 中第143-187行的难度比值 `<div>` 块。

- [ ] **Step 3: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit --pretty false 2>&1 | head -30
```

Expected: 无新增类型错误。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/papers/steps/BasicInfoStep.tsx frontend/src/pages/papers/steps/StructureStep.tsx
git commit -m "refactor: 难度比值从 Step2 移至 Step1 基本信息"
```

---

### Task 7: 前端 — StructureStep 重写（核心任务）

**Files:**
- Rewrite: `frontend/src/pages/papers/steps/StructureStep.tsx`

这是最大的任务。重写为三区域布局：模板选择器 + 编辑区 + 汇总栏。

- [ ] **Step 1: 备份旧文件并写新 StructureStep**

完整替换 `StructureStep.tsx`：

```tsx
import { useMemo } from 'react';
import { Card, Button, Select, InputNumber, Tag, Popconfirm, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { usePaperEditorStore } from '../../../store/paperEditor';
import type { TemplateType, QuestionConfigItem } from '../../../types/paper';

const QTYPE_OPTIONS = [
  { value: 'SINGLE_CHOICE', label: '单选题' },
  { value: 'MULTIPLE_CHOICE', label: '多选题' },
  { value: 'FILL_BLANK', label: '填空题' },
  { value: 'SUBJECTIVE', label: '解答题' },
];

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; desc: string }[] = [
  { value: 'knowledge_block', label: 'A 知识模块', desc: '单元标题显示 / 卡片编辑 / 题号跨单元连续' },
  { value: 'question_type', label: 'B 题型', desc: '无单元标题 / 平表编辑 / 不分页 / 仅整卷计时' },
  { value: 'difficulty_progression', label: 'C 难度递进', desc: '难度标签 / 逐层计时+解锁' },
  { value: 'volume', label: 'D 卷别', desc: '卷别标题 / 强分页 / 两卷独立计时' },
  { value: 'generic', label: 'E 通用', desc: '单元标题显示 / 自由构建 / 灵活出卷' },
];

const FIXED_UNIT_COUNT: Partial<Record<TemplateType, number>> = {
  question_type: 1,
  volume: 2,
};

export default function StructureStep() {
  const {
    paper, updateMeta, addUnit, updateUnit, removeUnit,
    updateTypeConfig, addTypeConfig, removeTypeConfig,
    setTemplate, setDirty,
  } = usePaperEditorStore();

  const units = paper?.units || [];
  const targetTotal = paper?.total_score || 0;
  const templateType = paper?.template_type || 'generic';
  const perUnitTimer = paper?.per_unit_timer ?? false;
  const isNewPaper = !paper?.id;
  const fixedCount = FIXED_UNIT_COUNT[templateType];
  const isFlatView = templateType === 'question_type';

  // Computed totals
  const computedTotal = useMemo(() =>
    units.reduce((sum, u) =>
      sum + (u.question_config || []).reduce((s, c) => s + (c.count || 0) * (c.score_per_question || 0), 0), 0),
    [units],
  );
  const totalQuestions = useMemo(() =>
    units.reduce((sum, u) =>
      sum + (u.question_config || []).reduce((s, c) => s + (c.count || 0), 0), 0),
    [units],
  );
  const scoreOk = targetTotal > 0 && computedTotal === targetTotal;

  // Handlers
  const handleTemplateChange = (v: TemplateType) => {
    setTemplate(v);
  };

  const addTypeToUnit = (unitId: string) => {
    addTypeConfig(unitId, {
      question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 5,
    });
    setDirty(true);
  };

  const addNewUnit = () => {
    if (fixedCount !== undefined && units.length >= fixedCount) return;
    addUnit({
      name: '新单元',
      question_config: [{ question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 5 }],
    });
    setDirty(true);
  };

  const updateRow = (unitId: string, cfgIdx: number, field: string, value: any) => {
    updateTypeConfig(unitId, cfgIdx, { [field]: value });
    setDirty(true);
  };

  const updateUnitMeta = (unitId: string, field: string, value: any) => {
    updateUnit(unitId, { [field]: value });
    setDirty(true);
  };

  const deleteRow = (unitId: string, cfgIdx: number) => {
    removeTypeConfig(unitId, cfgIdx);
    setDirty(true);
  };

  const totalUnitTime = perUnitTimer
    ? units.reduce((sum, u) => sum + (u.time_limit_minutes || 0), 0)
    : null;

  // ── Render ──

  return (
    <div>
      {/* 区域1: 模板选择器 */}
      <div style={{
        background: '#fff', borderRadius: 8, padding: '12px 16px',
        border: '1px solid #f0f0f0', marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>
          试卷格式模板
          <span style={{ fontWeight: 400, color: '#999', fontSize: 12, marginLeft: 8 }}>
            — 决定纸质排版和在线答题方式{!isNewPaper ? '（编辑模式不可变更）' : ''}
          </span>
        </div>

        {isNewPaper ? (
          <Space size={6} wrap>
            {TEMPLATE_OPTIONS.map((t) => (
              <Button
                key={t.value}
                type={templateType === t.value ? 'primary' : 'default'}
                size="small"
                onClick={() => handleTemplateChange(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </Space>
        ) : (
          <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>
            {TEMPLATE_OPTIONS.find(t => t.value === templateType)?.label || 'E 通用'}
          </Tag>
        )}

        <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
          {TEMPLATE_OPTIONS.find(t => t.value === templateType)?.desc}
        </div>
      </div>

      {/* 区域2: 编辑区 */}
      {isFlatView ? (
        /* ── 模板 B: 平表视图 ── */
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e8e8e8', fontSize: 13, color: '#666' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', width: '30%' }}>题型</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '20%' }}>题数</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '20%' }}>卷面分/题</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '20%' }}>小计</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '10%' }}></th>
              </tr>
            </thead>
            <tbody>
              {(units[0]?.question_config || []).map((cfg, idx) => {
                const subtotal = (cfg.count || 0) * (cfg.score_per_question || 0);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <Select
                        size="small" variant="borderless" style={{ width: '100%' }}
                        value={cfg.question_type}
                        onChange={(v) => updateRow(units[0].id!, idx, 'question_type', v)}
                        options={QTYPE_OPTIONS}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <InputNumber size="small" variant="borderless" style={{ width: 80 }}
                        min={0} max={200} value={cfg.count}
                        onChange={(v) => updateRow(units[0].id!, idx, 'count', v || 0)} />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <InputNumber size="small" variant="borderless" style={{ width: 80 }}
                        min={1} max={100} value={cfg.score_per_question}
                        onChange={(v) => updateRow(units[0].id!, idx, 'score_per_question', v || 1)}
                        suffix="分" />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 500 }}>
                      <Tag color="blue">{subtotal} 分</Tag>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Popconfirm title="删除此行？" onConfirm={() => deleteRow(units[0].id!, idx)}>
                        <Button size="small" danger type="text" icon={<DeleteOutlined />}
                          disabled={(units[0]?.question_config || []).length <= 1} />
                      </Popconfirm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e8e8e8', fontWeight: 600, background: '#fafafa' }}>
                <td style={{ padding: '10px 12px' }}>合计 {totalQuestions} 题</td>
                <td colSpan={2} />
                <td style={{ padding: '10px 12px', textAlign: 'center', color: scoreOk ? '#52c41a' : '#ff4d4f' }}>
                  {computedTotal} 分
                  {!scoreOk && targetTotal > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>
                      目标 {targetTotal} 分，差 {Math.abs(computedTotal - targetTotal)} 分
                    </div>
                  )}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          <div style={{ padding: '8px 12px' }}>
            <Button size="small" type="dashed" icon={<PlusOutlined />}
              onClick={() => addTypeToUnit(units[0]?.id || '')} block>
              添加题型
            </Button>
          </div>
        </Card>
      ) : (
        /* ── 模板 A/C/D/E: 卡片视图 ── */
        <div>
          {units.map((unit) => {
            const configs = unit.question_config || [];
            const unitScore = configs.reduce((s, c) => s + (c.count || 0) * (c.score_per_question || 0), 0);
            const unitQCount = configs.reduce((s, c) => s + (c.count || 0), 0);
            return (
              <Card
                key={unit.id}
                size="small"
                style={{ marginBottom: 12 }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 600, fontSize: 14, width: 160 }}
                      value={unit.name}
                      onChange={(e) => updateUnitMeta(unit.id!, 'name', e.target.value)}
                      placeholder="单元名称"
                    />
                    {perUnitTimer && (
                      <span style={{ fontSize: 12, color: '#999' }}>
                        限时
                        <InputNumber size="small" variant="borderless" style={{ width: 60 }}
                          min={0} max={300} value={unit.time_limit_minutes || undefined}
                          onChange={(v) => updateUnitMeta(unit.id!, 'time_limit_minutes', v || null)}
                          placeholder="不限" />
                        分钟
                      </span>
                    )}
                    <Tag style={{ marginLeft: 8 }}>{unitQCount}题 {unitScore}分</Tag>
                  </div>
                }
                extra={
                  !fixedCount || units.length > fixedCount ? (
                    <Popconfirm title="删除此单元？" onConfirm={() => removeUnit(unit.id!)}>
                      <Button size="small" danger type="text" disabled={units.length <= 1 && !fixedCount}>删除</Button>
                    </Popconfirm>
                  ) : null
                }
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#999' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>题型</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>题数</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>卷面分/题</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>小计</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((cfg, idx) => {
                      const subtotal = (cfg.count || 0) * (cfg.score_per_question || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #fafafa' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <Select size="small" variant="borderless" style={{ width: '100%' }}
                              value={cfg.question_type}
                              onChange={(v) => updateRow(unit.id!, idx, 'question_type', v)}
                              options={QTYPE_OPTIONS} />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <InputNumber size="small" variant="borderless" style={{ width: 70 }}
                              min={0} max={200} value={cfg.count}
                              onChange={(v) => updateRow(unit.id!, idx, 'count', v || 0)} />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <InputNumber size="small" variant="borderless" style={{ width: 70 }}
                              min={1} max={100} value={cfg.score_per_question}
                              onChange={(v) => updateRow(unit.id!, idx, 'score_per_question', v || 1)}
                              suffix="分" />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', color: '#1890ff' }}>{subtotal} 分</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <Popconfirm title="删除此行？"
                              onConfirm={() => deleteRow(unit.id!, idx)}
                              disabled={configs.length <= 1}>
                              <Button size="small" danger type="text"
                                icon={<DeleteOutlined />}
                                disabled={configs.length <= 1} />
                            </Popconfirm>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: 8 }}>
                  <Button size="small" type="dashed" icon={<PlusOutlined />}
                    onClick={() => addTypeToUnit(unit.id!)} block>
                    添加题型
                  </Button>
                </div>
              </Card>
            );
          })}
          {(!fixedCount || units.length < fixedCount) && (
            <Button type="dashed" icon={<PlusOutlined />} onClick={addNewUnit} block style={{ marginTop: 8 }}>
              添加单元
            </Button>
          )}
        </div>
      )}

      {/* 区域3: 汇总栏 */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {!scoreOk && targetTotal > 0 && (
          <Tag color="error">
            结构总分（{computedTotal}）≠ 目标总分（{targetTotal}），差 {Math.abs(computedTotal - targetTotal)} 分
          </Tag>
        )}
        {perUnitTimer && totalUnitTime != null && paper?.duration_minutes && totalUnitTime > paper.duration_minutes && (
          <Tag color="warning">
            单元限时合计 {totalUnitTime} 分钟，超过试卷时长 {paper.duration_minutes} 分钟
          </Tag>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit --pretty false 2>&1 | head -30
```

Expected: 无新增类型错误。如果 `addTypeConfig` 方法签名不兼容，检查 store 中参数类型。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/papers/steps/StructureStep.tsx
git commit -m "feat: Step2 重写 — 统一五模板结构 + 平表/卡片切换"
```

---

### Task 8: 前端 — PaperWizardPage Step2 校验更新

**Files:**
- Modify: `frontend/src/pages/papers/PaperWizardPage.tsx:126-159`

- [ ] **Step 1: 更新校验逻辑**

模板 B（question_type）只有1个单元，需调整校验：

```typescript
if (currentStep === 1) {
  const units = paper?.units || [];
  if (units.length === 0) {
    message.warning('请至少添加一个题型');
    return;
  }
  // 收集所有 question_config 跨单元校验
  const allConfigs = units.flatMap(u => u.question_config || []);
  if (allConfigs.length === 0) {
    message.warning('存在未配置的题型行，请补充或删除');
    return;
  }
  for (const cfg of allConfigs) {
    const label = TYPE_LABELS[cfg.question_type] || cfg.question_type;
    if ((cfg.count || 0) <= 0) {
      message.warning(`「${label}」题数不能为 0，请填写题数`);
      return;
    }
    if ((cfg.score_per_question || 0) <= 0) {
      message.warning(`「${label}」每题分值不能为 0，请填写分值`);
      return;
    }
  }
  // 校验结构总分
  const computedTotal = units.reduce(
    (sum, u) => sum + (u.question_config || []).reduce((s, c) => s + (c.count || 0) * (c.score_per_question || 0), 0), 0,
  );
  const targetTotal = paper?.total_score || 0;
  if (targetTotal > 0 && computedTotal !== targetTotal) {
    message.warning(`题型总分 ${computedTotal} 与试卷总分 ${targetTotal} 不一致，请调整题数或分值`);
    return;
  }
}
```

关键改动：用 `units.flatMap(u => u.question_config || [])` 替代 `for (const unit of units)` 逐个检查，因为模板B只有一个单元。

- [ ] **Step 2: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit --pretty false 2>&1 | head -30
```

Expected: 无新增类型错误。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/papers/PaperWizardPage.tsx
git commit -m "fix: Step2 校验逻辑适配统一结构（flatMap 跨单元收集配置）"
```

---

### Task 9: 种子数据更新

**Files:**
- Modify: `backend/seed_v35.py`

- [ ] **Step 1: 种子试卷添加 template_type**

**位置1 — 数据定义（约1112行）**，在元组中新增 `tmpl` 字段：

```python
for pid, title, desc, subj, grade, score, dur, instr, creator, diff_ratio, show_u, per_u in papers:
```
→
```python
for pid, title, desc, subj, grade, score, dur, instr, creator, diff_ratio, show_u, per_u, tmpl in papers:
```

**位置2 — INSERT 列列表（约1114-1116行）**：

```python
INSERT INTO exam_papers (id, title, description, subject, grade_level, status,
    total_score, duration_minutes, instructions, difficulty_ratio,
    show_units, per_unit_timer, created_by, created_at, updated_at)
```
→ 在 `per_unit_timer` 后加 `template_type`：
```python
INSERT INTO exam_papers (id, title, description, subject, grade_level, status,
    total_score, duration_minutes, instructions, difficulty_ratio,
    show_units, per_unit_timer, template_type, created_by, created_at, updated_at)
```

**位置3 — VALUES 参数（约1117-1119行）**：

```python
VALUES (:id, :title, :desc, :subj, CAST(:grade AS jsonb), 'PUBLISHED',
    :score, :dur, :instr, CAST(:diff AS jsonb),
    :show_u, :per_u, :creator, now(), now())
```
→ 在 `:per_u` 后加 `:tmpl`：
```python
VALUES (:id, :title, :desc, :subj, CAST(:grade AS jsonb), 'PUBLISHED',
    :score, :dur, :instr, CAST(:diff AS jsonb),
    :show_u, :per_u, :tmpl, :creator, now(), now())
```

**位置4 — execute 参数字典（约1120-1122行）**：

```python
), {"id": pid, "title": title, "desc": desc, "subj": subj, "grade": json.dumps(grade),
       "score": score, "dur": dur, "instr": instr, "diff": json.dumps(diff_ratio),
       "show_u": show_u, "per_u": per_u, "creator": creator})
```
→ 在 `"per_u": per_u` 后加 `, "tmpl": tmpl`：
```python
), {"id": pid, "title": title, "desc": desc, "subj": subj, "grade": json.dumps(grade),
       "score": score, "dur": dur, "instr": instr, "diff": json.dumps(diff_ratio),
       "show_u": show_u, "per_u": per_u, "tmpl": tmpl, "creator": creator})
```

**位置5 — papers 列表的定义**（需在文件前面找到），在每个试卷元组末尾添加 template_type：
- `show_units=True` 的试卷 → 添加 `'generic'`
- `show_units=False` 的试卷 → 添加 `'question_type'`

- [ ] **Step 2: 验证种子数据可运行**

```bash
cd backend && conda activate ~/conda_workspace && python seed_v35.py
```

Expected: 种子数据创建成功，无报错。

- [ ] **Step 3: Commit**

```bash
git add backend/seed_v35.py
git commit -m "feat: 种子试卷新增 template_type 字段"
```

---

### Task 10: 构建验证

**Files:**
- None (verification only)

- [ ] **Step 1: 后端测试**

```bash
cd backend && conda activate ~/conda_workspace && python -c "
from app.models.exam_paper import ExamPaper
from app.schemas.exam_paper import ExamPaperFullSave
# 验证 template_type 默认值
import inspect
print('Model template_type:', ExamPaper.template_type.default.arg)
print('Schema template_type:', ExamPaperFullSave.model_fields['template_type'].default)
"
```

Expected: 两者默认值均为 `'generic'`

- [ ] **Step 2: 前端 TypeScript 编译**

```bash
cd frontend && npx tsc --noEmit --pretty false 2>&1 | tail -5
```

Expected: 无 TypeScript 错误。

- [ ] **Step 3: 前端 Vite build**

```bash
cd frontend && npx vite build 2>&1 | tail -10
```

Expected: Build 成功。

- [ ] **Step 4: Commit（如有微调）**

```bash
git status
# 如有未提交改动，提交之
```

---

### Task 11: E2E 验证

**Files:**
- None (manual testing)

- [ ] **Step 1: 启动后端**

```bash
cd backend && conda activate ~/conda_workspace && uvicorn app.main:app --host 0.0.0.0 --port 8001 &
```

- [ ] **Step 2: 启动前端**

```bash
cd frontend && npm run dev &
```

- [ ] **Step 3: 手动测试新建试卷流程**

1. 打开 `http://localhost:3001/papers` → 新建试卷
2. Step1 填写基本信息 → 确认难度比值已出现
3. Step2 选择模板 → 切换五个模板 → 确认编辑区随模板变化
4. 模板 B：确认平表视图出现，无单元卡片，不可添加单元
5. 模板 A/C/D/E：确认卡片视图，可增减单元
6. 填写题型配置，确认总分校验正常工作
7. 下一步到 Step3，确认选题功能正常

- [ ] **Step 4: 手动测试编辑试卷流程**

1. 从试卷列表进入编辑已有试卷
2. Step2 确认模板显示为只读标签，不可切换
3. 修改单元和题型配置，保存
4. 确认保存后模板不变

---

### 影响范围汇总

| 文件 | 变更类型 | 任务 |
|------|---------|------|
| `backend/app/models/exam_paper.py` | 新增列 | Task 1 |
| `backend/alembic/versions/005_add_template_type.py` | 新建 | Task 2 |
| `backend/app/schemas/exam_paper.py` | 新增字段 | Task 3 |
| `frontend/src/types/paper.ts` | 新增类型 | Task 4 |
| `frontend/src/store/paperEditor.ts` | 新增逻辑 | Task 5 |
| `frontend/src/pages/papers/steps/BasicInfoStep.tsx` | 移入难度比值 | Task 6 |
| `frontend/src/pages/papers/steps/StructureStep.tsx` | **重写** | Task 7 |
| `frontend/src/pages/papers/PaperWizardPage.tsx` | 校验逻辑调整 | Task 8 |
| `backend/seed_v35.py` | 新增字段 | Task 9 |
