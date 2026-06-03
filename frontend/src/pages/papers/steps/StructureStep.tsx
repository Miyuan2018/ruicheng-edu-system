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
  { value: 'knowledge_block', label: 'A 知识模块', desc: '单元标题显示 / 卡片编辑 / 题号跨单元连续 / 单元间可选分页' },
  { value: 'question_type', label: 'B 题型', desc: '无单元标题 / 平表编辑 / 不分页 / 仅整卷计时' },
  { value: 'difficulty_progression', label: 'C 难度递进', desc: '难度标签(⭐) / 逐层计时+解锁 / 层级间分隔' },
  { value: 'volume', label: 'D 卷别', desc: '卷别标题 / 强制分页 / 两卷独立计时 / 不可回退' },
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
  const templateType = (paper?.template_type || 'generic') as TemplateType;
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

  return (
    <div>
      {/* Zone 1: Template Selector */}
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

      {/* Zone 2: Editing Area */}
      {isFlatView ? (
        /* Flat table for Template B (question_type) */
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
              {(units[0]?.question_config || []).map((cfg: QuestionConfigItem, idx: number) => {
                const subtotal = (cfg.count || 0) * (cfg.score_per_question || 0);
                return (
                  <tr key={`${units[0]?.id}-${idx}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
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
        /* Card view for Templates A/C/D/E */
        <div>
          {units.map((unit) => {
            const configs = unit.question_config || [];
            const unitScore = configs.reduce((s: number, c: QuestionConfigItem) => s + (c.count || 0) * (c.score_per_question || 0), 0);
            const unitQCount = configs.reduce((s: number, c: QuestionConfigItem) => s + (c.count || 0), 0);
            const canDeleteUnit = !fixedCount || units.length > fixedCount;
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
                  canDeleteUnit ? (
                    <Popconfirm title="删除此单元？" onConfirm={() => removeUnit(unit.id!)}>
                      <Button size="small" danger type="text">删除</Button>
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
                    {configs.map((cfg: QuestionConfigItem, idx: number) => {
                      const subtotal = (cfg.count || 0) * (cfg.score_per_question || 0);
                      return (
                        <tr key={`${unit.id}-${idx}`} style={{ borderBottom: '1px solid #fafafa' }}>
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

      {/* Zone 3: Summary Bar */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {!isFlatView && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={perUnitTimer}
                onChange={(e) => updateMeta({ per_unit_timer: e.target.checked })}
                style={{ margin: 0 }}
              />
              逐单元计时
            </label>
          </div>
        )}
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
