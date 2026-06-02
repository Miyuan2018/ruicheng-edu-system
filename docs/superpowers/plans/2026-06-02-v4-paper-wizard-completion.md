# V4 试卷向导 — 补完实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 将 V4 向导中剩余未实现部分补充完整：BasicInfoStep 简化、StructureStep 加入难度比值、RecommendStep 自动触发、difficulty_ratio 持久化

**Architecture:** 前端 5 步向导 + 后端 ExamPaper 模型新增 difficulty_ratio 列 + 迁移。难度比值从 Step1 移至 Step2，Step3 到步自动生成

**Tech Stack:** React 19 + TypeScript + Zustand 5 + FastAPI + SQLAlchemy + PostgreSQL

**前置已完成**: show_units/per_unit_timer 字段、模式切换双视图、预览跟随模式、导出双模式、放宽难度约束、种子数据

---

### Task 1: 后端 — ExamPaper 模型添加 difficulty_ratio 列

**Files:**
- Modify: `backend/app/models/exam_paper.py:58-60`
- Create: `backend/alembic/versions/005_v4_difficulty_ratio.py`
- Modify: `backend/app/api/v1/endpoints/exam_papers.py:593-607`

- [ ] **Step 1: 添加模型字段**

在 `ExamPaper` 类的 `instructions` 行之后添加：

```python
    difficulty_ratio = Column(JSONB, nullable=True)  # {EASY: 20, MEDIUM: 50, HARD: 30}
    knowledge_node_ids = Column(JSONB, nullable=True)  # ["uuid1", "uuid2"]
```

- [ ] **Step 2: 创建迁移**

```bash
cd backend
python -m alembic revision -m "add difficulty_ratio to exam_papers" --autogenerate
python -m alembic upgrade head
```

- [ ] **Step 3: save-all 端点持久化 difficulty_ratio**

在 save-all 端点的字段循环中加入 `"difficulty_ratio"`:

```python
    for field in (
        "title", "subtitle", "description", "subject", "grade_level",
        "total_score", "duration_minutes", "status", "instructions",
        "show_units", "per_unit_timer", "difficulty_ratio", "knowledge_node_ids",
    ):
```

- [ ] **Step 4: preview 端点返回 difficulty_ratio**

在 preview 的 paper dict 中加入:

```python
    "difficulty_ratio": paper.difficulty_ratio,
```

- [ ] **Step 5: 验证**

```bash
curl -s http://localhost:8001/health
# 应该返回 {"status":"healthy"}
```

- [ ] **Step 6: 提交**

```bash
git add backend/app/models/exam_paper.py backend/alembic/versions/005_*.py backend/app/api/v1/endpoints/exam_papers.py
git commit -m "feat: exam_paper 添加 difficulty_ratio 持久化"
```

---

### Task 2: BasicInfoStep — 简化，移除难度比值

**Files:**
- Modify: `frontend/src/pages/papers/steps/BasicInfoStep.tsx` (重写)

移除难度比值输入框、试卷描述字段。重新布局为 V4 设计。

- [ ] **Step 1: 删除难度比值相关代码**

删除 `DIFF_LABELS`、`DIFF_COLORS`、`diffTotal` 相关代码。删除 `handleValuesChange` 中的 `difficulty_ratio` 字段。删除 form 中的 `diff_easy`/`diff_medium`/`diff_hard` 字段和 `initialValue`。

- [ ] **Step 2: 删除描述字段**

从 `handleValuesChange` 和 form 中移除 `description` 字段。

- [ ] **Step 3: 添加知识点的折叠"高级设置"区**

在选填区下方添加 Collapse:

```tsx
<Collapse size="small" ghost items={[{
  key: 'advanced',
  label: <span style={{ fontSize: 12, color: '#999' }}>高级设置</span>,
  children: (
    <Form.Item label="知识点范围">
      {/* 考纲选择 + 知识点多选 */}
    </Form.Item>
  ),
}]} />
```

- [ ] **Step 4: 优化布局 — 两行核心 + 分隔 + 选填**

```tsx
<Card title="基本信息" style={{ maxWidth: 720, margin: '0 auto' }}>
  <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
    {/* Row 1 */}
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="title" label="试卷标题" rules={[{ required: true }]}>
          <Input placeholder="如：八年级数学期中测试" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item name="subject" label="学科" rules={[{ required: true }]}>
          <Select placeholder="选择学科" options={subjectOptions} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item name="total_score" label="总分">
          <InputNumber style={{ width: '100%' }} min={1} max={999} placeholder="100" />
        </Form.Item>
      </Col>
    </Row>

    {/* Row 2 */}
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item name="grade_scope" label="适用范围">
          <Select onChange={(val) => { setGradeMode(val === 'comprehensive' ? 'multiple' : 'single'); form.setFieldValue('grade_level', []); }}
            options={[{ value: 'grade_comprehensive', label: '年级综合' }, { value: 'comprehensive', label: '跨年级综合' }]} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item name="grade_level" label="年级" rules={[{ required: true }]}>
          <Select mode={gradeMode === 'multiple' ? 'multiple' : undefined} placeholder="选择年级" options={toSelectOptions(grades)} />
        </Form.Item>
      </Col>
      <Col span={5}>
        <Form.Item name="duration_minutes" label="时长">
          <InputNumber style={{ width: '100%' }} min={1} max={300} placeholder="60" suffix="分钟" />
        </Form.Item>
      </Col>
      <Col span={5} />
    </Row>

    <Divider style={{ margin: '8px 0' }} />

    {/* 选填区 */}
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="subtitle" label="副标题">
          <Input placeholder="如：满分100分，考试时间60分钟" style={{ color: '#999' }} />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="instructions" label="注意事项">
          <Input.TextArea rows={2} placeholder="考生注意事项（选填）" />
        </Form.Item>
      </Col>
    </Row>

    {/* 高级设置 */}
    <Collapse size="small" ghost items={[{ key: 'advanced', label: <span style={{ fontSize: 12, color: '#999' }}>高级设置</span>, children: (<> ... </>) }]} />
  </Form>
</Card>
```

- [ ] **Step 5: 简化 handleValuesChange**

```tsx
const handleValuesChange = (_: any, allValues: any) => {
  const scope = allValues.grade_scope || 'grade_comprehensive';
  updateMeta({
    title: allValues.title || '',
    subject: allValues.subject || '',
    total_score: allValues.total_score || 0,
    grade_level: { scope, grades: allValues.grade_level || [] },
    duration_minutes: allValues.duration_minutes || null,
    subtitle: allValues.subtitle || '',
    instructions: allValues.instructions || '',
  });
};
```

- [ ] **Step 6: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit
# 预期: 0 errors (预存 TS6133/TS2345/TS18047 除外)
```

- [ ] **Step 7: 提交**

```bash
git add frontend/src/pages/papers/steps/BasicInfoStep.tsx
git commit -m "refactor: BasicInfoStep 简化 — 移除难度比值, 优化布局, 高级设置折叠"
```

---

### Task 3: StructureStep — 在顶部加入难度比值

**Files:**
- Modify: `frontend/src/pages/papers/steps/StructureStep.tsx:1-20` (在现有代码顶部插入难度比值区)

现有 StructureStep 已经有模式切换和双视图。需要在最顶部加入难度比值三色卡。

- [ ] **Step 1: 导入 Divider**

```tsx
import { Card, Button, Select, InputNumber, Tag, Popconfirm, Space, Radio, Divider } from 'antd';
```

- [ ] **Step 2: 在 return 最顶部加入难度比值区**

在现有的 `<div>` 开头、模式切换之前，插入：

```tsx
{/* 难度比值 */}
<div style={{
  background: '#fff', borderRadius: 8, padding: '12px 16px',
  border: '1px solid #f0f0f0', marginBottom: 16,
}}>
  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>
    难度比值 <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>— 智能选题时按此比例分配题数</span>
  </div>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
    {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => {
      const colors: Record<string, string> = { EASY: '#52c41a', MEDIUM: '#faad14', HARD: '#ff4d4f' };
      const bgColors: Record<string, string> = { EASY: '#f6ffed', MEDIUM: '#fffbe6', HARD: '#fff2f0' };
      const borderColors: Record<string, string> = { EASY: '#b7eb8f', MEDIUM: '#ffe58f', HARD: '#ffccc7' };
      const labels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
      const diffRatio = paper?.difficulty_ratio || { EASY: 20, MEDIUM: 50, HARD: 30 };
      return (
        <div key={d} style={{
          background: bgColors[d], border: `2px solid ${borderColors[d]}`,
          borderRadius: 8, padding: '8px 12px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: colors[d], marginBottom: 2 }}>{labels[d]}</div>
          <InputNumber
            size="small" variant="borderless"
            style={{ width: 70, fontSize: 20, fontWeight: 700, color: colors[d], textAlign: 'center' }}
            value={diffRatio[d]}
            min={0} max={100}
            onChange={(v) => {
              const newRatio = { ...diffRatio, [d]: v || 0 };
              updateMeta({ difficulty_ratio: newRatio });
            }}
            suffix={<span style={{ fontSize: 14, color: colors[d] }}>%</span>}
          />
        </div>
      );
    })}
  </div>
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

- [ ] **Step 3: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/papers/steps/StructureStep.tsx
git commit -m "feat: StructureStep 顶部加入难度比值三色大卡"
```

---

### Task 4: RecommendStep — 到步自动触发智能生成

**Files:**
- Modify: `frontend/src/pages/papers/steps/RecommendStep.tsx:14-63`
- Modify: `frontend/src/pages/papers/PaperWizardPage.tsx:94,148-169`

- [ ] **Step 1: RecommendStep 添加 auto-generate on mount**

在 `RecommendStep` 组件中添加 `useEffect` 自动触发：

```tsx
import { useEffect, useRef } from 'react';

// 在组件内、handleGenerate 之前添加：
const hasTriggered = useRef(false);

useEffect(() => {
  if (!paper?.id || hasTriggered.current) return;
  const units = paper?.units || [];
  const hasConfigs = units.some(u => (u.question_config || []).some(c => (c.count || 0) > 0));
  if (!hasConfigs) return;
  hasTriggered.current = true;
  handleGenerate();
}, [paper?.id]);
```

- [ ] **Step 2: PaperWizardPage 重置触发标记**

当步骤从 Step3 返回时不应重新触发。通过 store 中的 `generateReport` 判断：

在 `handleGenerate` 开头加判断：

```tsx
// 如果已有推荐结果且 force 不为 true，跳过
if (generateReport && generateReport.questions.length > 0) return;
```

修改 `handleGenerate` 的第一行为：

```tsx
const handleGenerate = async (force = false) => {
  if (!paper?.id) { message.warning('请先保存基本信息'); return; }
  if (!force && generateReport && generateReport.questions.length > 0) return;
  // ... 原有逻辑
```

- [ ] **Step 3: 更新 PaperWizardPage — 退回到 Step2 后清除 generateReport**

修改 `handlePrev`:

```tsx
const handlePrev = () => {
  if (currentStep > 0) {
    if (currentStep === 2) {
      // 从选题退回结构时不清除题目分配（保留在 units 中）
      // 但清除推荐报告，以便返回时重新看到空状态
    }
    setStep(currentStep - 1);
  }
};
```

- [ ] **Step 4: PaperWizardPage — "下一步"验证去掉强制生成要求**

在 Step2→Step3 的验证中，不再要求已有题目（因为自动生成会处理）：

当前代码在 `handleNext` 中:
```tsx
if (currentStep === 2) {
  const allQuestions = units.reduce((sum, u) => sum + (u.questions?.length || 0), 0);
  if (allQuestions === 0) {
    message.warning('请先生成题目推荐');
    return;
  }
}
```

改为：
```tsx
if (currentStep === 2) {
  const allQuestions = units.reduce((sum, u) => sum + (u.questions?.length || 0), 0);
  if (allQuestions === 0) {
    message.warning('请等待智能生成完成或手动点击"智能生成"');
    return;
  }
}
```

- [ ] **Step 5: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add frontend/src/pages/papers/steps/RecommendStep.tsx frontend/src/pages/papers/PaperWizardPage.tsx
git commit -m "feat: RecommendStep 到步自动触发智能生成"
```

---

### Task 5: 清理 — 移除遗留代码

**Files:**
- Modify: `frontend/src/pages/papers/PaperTemplatePreview.tsx` — 删除 LEGACY section 渲染块
- Modify: `frontend/src/store/paperEditor.ts:67-76` — 删除 QUICK_PRESETS.blank

- [ ] **Step 1: 删除 PaperTemplatePreview 遗留代码**

删除第 196-248 行的 LEGACY section-based rendering（`// --- LEGACY: Section-based rendering` 及以下所有代码）。这部分从未被调用。

- [ ] **Step 2: 删除未使用的预设**

删除 `paperEditor.ts` 中的 `blank` 预设（`QUICK_PRESETS` 中）。保留 `byType` 预设。

```tsx
const QUICK_PRESETS: Record<string, ExamPaperUnit[]> = {
  byType: [
    { name: '填空题', position: 1, question_config: [{ question_type: 'FILL_BLANK', count: 0, score_per_question: 5 }], time_limit_minutes: null },
    { name: '单选题', position: 2, question_config: [{ question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 4 }], time_limit_minutes: null },
    { name: '多选题', position: 3, question_config: [{ question_type: 'MULTIPLE_CHOICE', count: 0, score_per_question: 6 }], time_limit_minutes: null },
    { name: '解答题', position: 4, question_config: [{ question_type: 'SUBJECTIVE', count: 0, score_per_question: 10 }], time_limit_minutes: null },
  ],
};
```

- [ ] **Step 3: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/papers/PaperTemplatePreview.tsx frontend/src/store/paperEditor.ts
git commit -m "refactor: 移除遗留代码 — LEGACY section 渲染 & 未使用预设"
```

---

### Task 6: 端到端验证

**Files:** 无代码修改

- [ ] **Step 1: 启动服务**

```bash
# 后端已在 :8001 运行
# 前端已在 :3001 运行
curl http://localhost:8001/health  # 确认 OK
curl http://localhost:3001  # 确认返回 HTML
```

- [ ] **Step 2: 验证流程**

在浏览器 `http://localhost:3001/admin/login`：
1. 登录 `t_math / Demo1234`
2. 试卷管理 → 新建试卷
3. Step1: 填写标题/学科/总分/年级，验证必填校验
4. Step2: 验证难度比值三色卡片显示，调整数值验证合计校验
5. Step2: 切换按题型/按单元，验证不会丢失数据
6. Step3: 验证到步自动触发智能生成
7. Step3: 验证换题功能
8. Step4: 验证预览显示
9. Step5: 验证难度偏离报告
10. 保存草稿 → 发布

- [ ] **Step 3: 验证 show_units 流程**

在 Step2 选择"按单元"，创建 2 个单元，走完流程，验证:
- Step4 预览显示单元名+题型分区
- 导出 Word 按单元→题型层次
- 选择"按题型"后，预览/导出变为纯题型分区

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: V4 向导端到端验证通过"
```
