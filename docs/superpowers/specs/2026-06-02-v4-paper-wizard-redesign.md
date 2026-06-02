# V4 试卷向导重构设计

**日期**: 2026-06-02 | **状态**: 已通过

---

## 一、设计目标

重构试卷向导为 5 步最优流程：基本信息 → 试卷结构+难度 → 智能选题 → 预览 → 入库确认。消除当前实现中的布局混乱、字段混杂、步骤职责不清问题。

## 二、向导流程

```
Step 1 ─→ Step 2 ────────→ Step 3 ──→ Step 4 ──→ Step 5
基本信息   试卷结构+难度比值   智能选题    预览      入库确认
```

### Step 1: 基本信息 — "这是什么试卷"

**职责**: 纯身份信息录入，无干扰。

**字段布局**:
- 第 1 行: 试卷标题（必填，宽）| 学科（必填）| 总分
- 第 2 行: 适用范围 | 年级（必填）| 考试时长
- 分隔线
- 选填区（轻量化样式）: 副标题 | 注意事项

**移除**: 难度比值（移至 Step2）、知识点范围（移至折叠高级区）、试卷描述字段

**验收**:
- 教师首次见到此页，30 秒内可完成核心字段填写
- 必填字段有明确红色 * 标记
- 选填字段视觉弱化（灰色 placeholder）

### Step 2: 试卷结构 + 难度 — "怎么组卷"  

**职责**: 全局难度比值 + 组织方式 + 卷面分配。

**布局**（从上到下）:
1. 难度比值区 — 三色大卡（简单绿/中等黄/困难红），每卡显示百分比数值，底部合计校验
2. 模式切换 — 按钮组 [按题型分组 | 按单元分区]，选"按单元"时出现「逐单元计时」checkbox
3. 结构配置:
   - 按题型: 平表（题型 | 题数 | 卷面分/题 | 小计 | 删除）
   - 按单元: 单元卡片嵌套题型表，可命名单元、设置限时

**数据结构**:
- `show_units: boolean` — 预览/打印/导出是否显示单元名
- `per_unit_timer: boolean` — 是否逐单元计时
- `difficulty_ratio: {EASY, MEDIUM, HARD}` — 全局难度比值（0-100 整数）

**验收**:
- 难度比值修改即时显示合计校验
- 模式切换不丢失已配置的题型数据
- 结构总分与试卷总分不一致时红色提示

### Step 3: 智能选题 — "推荐+微调"

**职责**: 到步即自动触发智能生成，老师主要做换题微调。

**行为**:
- 进入 Step3 时自动调用 auto-generate API
- 结果按题型分区显示，每分区标题含卷面分、题数、合计
- 每题显示: 题号 + 标题 + 难度 Tag + 卷面分 + [↻ 换题]
- 顶部仪表盘: 难度分布匹配状态 + 总分（请求/实际）+ 短缺明细

**约束**:
- 修改难度比值（Step2 回退修改）后不自动重新生成，需手动点击
- 分数统一使用卷面分，试题原始分不可见

**验收**:
- 到步后 3 秒内显示推荐结果
- 换题后页面即时更新
- 仪表盘显示请求总分=实际总分时为绿色 ✓

### Step 4: 预览 — "所见即所得"

**职责**: 跟随 Step2 选择的组织方式渲染，与打印/导出一致。

**行为**:
- `show_units=false`: 题型分区（一、单选题 ... 二、填空题 ...）
- `show_units=true`: 单元分区 → 单元内题型分区，题型编号跨单元递增
- 题号全卷连续
- 工具栏: 导出 Word / 导出 PDF / 打印

**验收**:
- 预览与打印样式一致
- 预览与导出 Word/PDF 结构一致
- 切换组织方式后预览即时更新

### Step 5: 入库确认 — "检查+发布"

**职责**: 难度偏离报告 + 知识点覆盖 + 发布。

**内容**:
1. 试卷概要: 标题/学科/年级/题数/总分
2. 难度偏离表: 目标比例 vs 实际比例 vs 偏离值，±10% 内为 ✓
3. 选题清单（可折叠）: 按题型/单元列出所有题目
4. 操作: 保存草稿 | 发布试卷（选择班级 + 通知说明）

**验收**:
- 偏离值超阈值时红色 ⚠ 提示
- 发布按钮确认后弹窗选择班级

---

## 三、字段职责矩阵

| 字段 | Step1 | Step2 | Step3 | Step4 | Step5 | 后端存储 |
|------|-------|-------|-------|-------|-------|---------|
| title | ● | | | | | ExamPaper |
| subject | ● | | | | | ExamPaper |
| total_score | ● | | | | | ExamPaper |
| grade_level | ● | | | | | ExamPaper |
| duration_minutes | ● | | | | | ExamPaper |
| subtitle | ○ | | | | | ExamPaper |
| instructions | ○ | | | | | ExamPaper |
| difficulty_ratio | | ● | | | | ExamPaper(新增) |
| show_units | | ● | | | | ExamPaper(新增) |
| per_unit_timer | | ● | | | | ExamPaper(新增) |
| units[].question_config | | ● | | | | ExamPaperUnit |
| units[].questions | | | ● | | | ExamPaperUnitQuestion |
| knowledge_node_ids | ○ | | | | | ExamPaper(新增) |

● 核心  ○ 选填/高级

---

## 四、数据流

```
Step1 ─(updateMeta)─→ Zustand paperEditor ──(saveAll)──→ POST /exam-papers/{id}/save-all
Step2 ─(updateMeta/updateTypeConfig)─→ Zustand ──(saveAll)──→ 同上
Step3 ─(auto-generate)─→ GET units from DB → distribute_quotas → select_for_targets
     ─(swap)─→ POST /exam-papers/{id}/questions/{qid}/swap
Step4 ─(preview)─→ GET /exam-papers/{id}/preview → units + show_units
Step5 ─(publish)─→ POST /exam-papers/{id}/publish
```

---

## 五、涉及文件

### 前端
- `steps/BasicInfoStep.tsx` — 重写，简化布局
- `steps/StructureStep.tsx` — 重写，模式切换+难度比值（合并难度从 Step1 移来）
- `steps/RecommendStep.tsx` — 修改，到步自动生成
- `steps/PreviewStep.tsx` — 修改，跟随 show_units
- `steps/FinalizeStep.tsx` — 修改，难度偏离报告
- `PaperTemplatePreview.tsx` — 修改，跟随 show_units
- `PaperWizardPage.tsx` — 修改，步骤切换逻辑
- `store/paperEditor.ts` — 修改，清理状态
- `types/paper.ts` — 已更新（show_units/per_unit_timer）
- `api/papers.ts` — 已更新

### 后端
- `models/exam_paper.py` — 已更新（show_units/per_unit_timer）
- `schemas/exam_paper.py` — 已更新（ExamPaperFullSave）
- `api/v1/endpoints/exam_papers.py` — 已更新（save-all/preview）
- `services/exam_paper_export.py` — 已更新（双模式渲染）
- `services/recommendation_engine.py` — 已更新（放宽难度+shortfall）
- `alembic/versions/004_v4_show_units_timer.py` — 迁移已完成

---

## 六、验收标准

1. 新建试卷 → 5 步走完 → 发布成功，全程无报错
2. Step1 必填校验有效，选填区视觉弱化
3. Step2 难度比值合计校验，模式切换不丢数据，结构总分校验
4. Step3 到步自动生成推荐，换题即时更新，仪表盘精确显示匹配状态
5. Step4 预览样式与打印/导出一致
6. Step5 难度偏离表数据准确，发布可选择班级
