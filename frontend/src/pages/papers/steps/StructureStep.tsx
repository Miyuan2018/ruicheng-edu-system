import { useMemo } from 'react';
import { Card, Button, Select, InputNumber, Tag, Popconfirm, Space, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { usePaperEditorStore } from '../../../store/paperEditor';
import type { QuestionConfigItem } from '../../../types/paper';

const QTYPE_OPTIONS = [
  { value: 'SINGLE_CHOICE', label: '单选题' },
  { value: 'MULTIPLE_CHOICE', label: '多选题' },
  { value: 'FILL_BLANK', label: '填空题' },
  { value: 'SUBJECTIVE', label: '解答题' },
];

type RowItem = {
  unitId: string;
  unitName: string;
  unitTime: number | null | undefined;
  cfg: QuestionConfigItem;
  cfgIdx: number;
};

export default function StructureStep() {
  const {
    paper, updateMeta, addUnit, updateUnit, removeUnit,
    updateTypeConfig, addTypeConfig, removeTypeConfig,
    addQuickUnits, setDirty,
  } = usePaperEditorStore();

  const units = paper?.units || [];
  const targetTotal = paper?.total_score || 0;
  const showUnits = paper?.show_units ?? false;
  const perUnitTimer = paper?.per_unit_timer ?? false;

  // Flatten to rows
  const rows: RowItem[] = useMemo(() => {
    const result: RowItem[] = [];
    units.forEach((u) => {
      (u.question_config || []).forEach((cfg, idx) => {
        result.push({ unitId: u.id || '', unitName: u.name, unitTime: u.time_limit_minutes, cfg, cfgIdx: idx });
      });
    });
    return result;
  }, [units]);

  const computedTotal = useMemo(() =>
    rows.reduce((s, r) => s + (r.cfg.count || 0) * (r.cfg.score_per_question || 0), 0),
    [rows],
  );
  const totalQuestions = useMemo(() =>
    rows.reduce((s, r) => s + (r.cfg.count || 0), 0),
    [rows],
  );
  const scoreOk = targetTotal > 0 && computedTotal === targetTotal;

  const handleModeChange = (mode: 'type' | 'unit') => {
    updateMeta({ show_units: mode === 'unit' });
    setDirty(true);
  };

  const addTypeToUnit = (unitId: string) => {
    addTypeConfig(unitId, {
      question_type: 'SINGLE_CHOICE',
      count: 0,
      score_per_question: 5,
    });
    setDirty(true);
  };

  const addNewUnit = () => {
    addUnit({
      name: '新单元',
      question_config: [{ question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 5 }],
    });
    setDirty(true);
  };

  const updateRow = (unitId: string, cfgIdx: number, field: string, value: any) => {
    // 修改题型时，自动切换到对应同名单元
    if (field === 'question_type' && !showUnits) {
      const cfg = (units.find(u => u.id === unitId)?.question_config || [])[cfgIdx];
      if (cfg && cfg.question_type !== value) {
        const typeLabel = QTYPE_OPTIONS.find(o => o.value === value)?.label || value;
        let targetUid = units.find(u => u.name === typeLabel)?.id;
        if (!targetUid) {
          addUnit({ name: typeLabel, question_config: [] });
          targetUid = usePaperEditorStore.getState().paper?.units?.find(u => u.name === typeLabel)?.id || '';
        }
        if (targetUid && targetUid !== unitId) {
          removeTypeConfig(unitId, cfgIdx);
          addTypeConfig(targetUid, { question_type: value, count: cfg.count, score_per_question: cfg.score_per_question });
          setDirty(true);
          return;
        }
      }
    }
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

  // Group rows by unit for unit mode
  const unitGroups = useMemo(() => {
    const groups: { unitId: string; unitName: string; unitTime: number | null | undefined; rows: RowItem[] }[] = [];
    const seen = new Set<string>();
    rows.forEach((r) => {
      if (!seen.has(r.unitId)) {
        seen.add(r.unitId);
        groups.push({
          unitId: r.unitId,
          unitName: r.unitName,
          unitTime: r.unitTime,
          rows: rows.filter(x => x.unitId === r.unitId),
        });
      }
    });
    return groups;
  }, [rows]);

  const totalUnitTime = perUnitTimer
    ? units.reduce((sum, u) => sum + (u.time_limit_minutes || 0), 0)
    : null;

  return (
    <div>
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

      {/* Mode toggle */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, padding: '8px 12px', background: '#f8f9fa', borderRadius: 8,
      }}>
        <Radio.Group
          value={showUnits ? 'unit' : 'type'}
          onChange={(e) => handleModeChange(e.target.value)}
          optionType="button" buttonStyle="solid" size="small"
        >
          <Radio.Button value="type">按题型分组</Radio.Button>
          <Radio.Button value="unit">按单元分区</Radio.Button>
        </Radio.Group>
        {showUnits && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
            <label style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
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
      </div>

      {!showUnits ? (
        /* ── 按题型模式：平表 ── */
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
              {rows.map((row) => {
                const subtotal = (row.cfg.count || 0) * (row.cfg.score_per_question || 0);
                return (
                  <tr key={`${row.unitId}-${row.cfgIdx}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <Select
                        size="small" variant="borderless" style={{ width: '100%' }}
                        value={row.cfg.question_type}
                        onChange={(v) => updateRow(row.unitId, row.cfgIdx, 'question_type', v)}
                        options={QTYPE_OPTIONS}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <InputNumber size="small" variant="borderless" style={{ width: 80 }}
                        min={0} max={200} value={row.cfg.count}
                        onChange={(v) => updateRow(row.unitId, row.cfgIdx, 'count', v || 0)} />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <InputNumber size="small" variant="borderless" style={{ width: 80 }}
                        min={1} max={100} value={row.cfg.score_per_question}
                        onChange={(v) => updateRow(row.unitId, row.cfgIdx, 'score_per_question', v || 1)}
                        suffix="分" />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 500 }}>
                      <Tag color="blue">{subtotal} 分</Tag>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Popconfirm title="删除此行？" onConfirm={() => deleteRow(row.unitId, row.cfgIdx)}>
                        <Button size="small" danger type="text" icon={<DeleteOutlined />} disabled={rows.length <= 1} />
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
        </Card>
      ) : (
        /* ── 按单元模式：卡片嵌套 ── */
        <div>
          {unitGroups.map((group) => {
            const unitScore = group.rows.reduce((s, r) => s + (r.cfg.count || 0) * (r.cfg.score_per_question || 0), 0);
            const unitQCount = group.rows.reduce((s, r) => s + (r.cfg.count || 0), 0);
            return (
              <Card
                key={group.unitId}
                size="small"
                style={{ marginBottom: 12 }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 600, fontSize: 14, width: 120 }}
                      value={group.unitName}
                      onChange={(e) => updateUnitMeta(group.unitId, 'name', e.target.value)}
                      placeholder="单元名称"
                    />
                    {perUnitTimer && (
                      <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
                        限时
                        <InputNumber size="small" variant="borderless" style={{ width: 60 }}
                          min={0} max={300} value={group.unitTime || undefined}
                          onChange={(v) => updateUnitMeta(group.unitId, 'time_limit_minutes', v || null)}
                          placeholder="不限"
                        />
                        分钟
                      </span>
                    )}
                    <Tag style={{ marginLeft: 12 }}>{unitQCount}题 {unitScore}分</Tag>
                  </div>
                }
                extra={
                  <Popconfirm title="删除此单元？" onConfirm={() => removeUnit(group.unitId)}>
                    <Button size="small" danger type="text" disabled={unitGroups.length <= 1}>删除</Button>
                  </Popconfirm>
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
                    {group.rows.map((row) => {
                      const subtotal = (row.cfg.count || 0) * (row.cfg.score_per_question || 0);
                      return (
                        <tr key={`${row.unitId}-${row.cfgIdx}`} style={{ borderBottom: '1px solid #fafafa' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <Select size="small" variant="borderless" style={{ width: '100%' }}
                              value={row.cfg.question_type}
                              onChange={(v) => updateRow(row.unitId, row.cfgIdx, 'question_type', v)}
                              options={QTYPE_OPTIONS} />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <InputNumber size="small" variant="borderless" style={{ width: 70 }}
                              min={0} max={200} value={row.cfg.count}
                              onChange={(v) => updateRow(row.unitId, row.cfgIdx, 'count', v || 0)} />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <InputNumber size="small" variant="borderless" style={{ width: 70 }}
                              min={1} max={100} value={row.cfg.score_per_question}
                              onChange={(v) => updateRow(row.unitId, row.cfgIdx, 'score_per_question', v || 1)}
                              suffix="分" />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', color: '#1890ff' }}>{subtotal} 分</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <Popconfirm title="删除此行？"
                              onConfirm={() => deleteRow(row.unitId, row.cfgIdx)}
                              disabled={group.rows.length <= 1}>
                              <Button size="small" danger type="text"
                                icon={<DeleteOutlined />}
                                disabled={group.rows.length <= 1} />
                            </Popconfirm>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: 8 }}>
                  <Button size="small" type="dashed" icon={<PlusOutlined />}
                    onClick={() => addTypeToUnit(group.unitId)} block>
                    添加题型
                  </Button>
                </div>
              </Card>
            );
          })}
          <Button type="dashed" icon={<PlusOutlined />} onClick={addNewUnit} block style={{ marginTop: 8 }}>
            添加单元
          </Button>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {!showUnits && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => {
            // 为该题型创建同名单元（如已有则复用）
            const typeLabel = '单选题';
            let uid = units.find(u => u.name === typeLabel)?.id;
            if (!uid) {
              addUnit({ name: typeLabel, question_config: [] });
              uid = usePaperEditorStore.getState().paper?.units?.find(u => u.name === typeLabel)?.id || '';
            }
            if (uid) addTypeConfig(uid, { question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 5 });
            setDirty(true);
          }}>
            添加题型
          </Button>
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
