import { useMemo } from 'react';
import { Card, Button, Select, InputNumber, Tag, Popconfirm, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { usePaperEditorStore } from '../../../store/paperEditor';
import type { QuestionConfigItem } from '../../../types/paper';

const QUESTION_TYPES = [
  { value: 'SINGLE_CHOICE', label: '单选题' },
  { value: 'MULTIPLE_CHOICE', label: '多选题' },
  { value: 'FILL_BLANK', label: '填空题' },
  { value: 'SUBJECTIVE', label: '解答题' },
];

const DEFAULT_PRESET: QuestionConfigItem[] = [
  { question_type: 'FILL_BLANK', count: 0, score_per_question: 5 },
  { question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 4 },
  { question_type: 'MULTIPLE_CHOICE', count: 0, score_per_question: 6 },
  { question_type: 'SUBJECTIVE', count: 0, score_per_question: 10 },
];

export default function StructureStep() {
  const { paper, addUnit, updateTypeConfig, addQuickUnits, removeTypeConfig, setDirty } = usePaperEditorStore();
  const units = paper?.units || [];
  const targetTotal = paper?.total_score || 0;

  // Flatten unit.question_config into row list
  const rows = useMemo(() => {
    const result: { unitId: string; cfg: QuestionConfigItem; idx: number }[] = [];
    units.forEach((u) => {
      (u.question_config || []).forEach((cfg, idx) => {
        result.push({ unitId: u.id || '', cfg, idx });
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
  const scoreMatched = targetTotal > 0 && computedTotal === targetTotal;

  const handleApplyPreset = () => {
    addQuickUnits('byType');
  };

  const handleAddRow = () => {
    addUnit({
      name: 'auto',
      question_config: [{ question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 5 }],
    });
  };

  const updateRow = (unitId: string, cfgIdx: number, field: string, value: any) => {
    updateTypeConfig(unitId, cfgIdx, { [field]: value });
    setDirty(true);
  };

  const removeRow = (unitId: string, cfgIdx: number) => {
    removeTypeConfig(unitId, cfgIdx);
    setDirty(true);
  };

  // Empty state
  if (rows.length === 0) {
    return (
      <Card size="small">
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 14, color: '#999', marginBottom: 16 }}>尚未设置题型结构</div>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleApplyPreset}>
              按题型分组
            </Button>
            <Button icon={<PlusOutlined />} onClick={handleAddRow}>自定义添加</Button>
          </Space>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Table */}
      <Card size="small" bodyStyle={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e8e8e8', fontSize: 13, color: '#666' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', width: '30%' }}>题型</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', width: '20%' }}>题数</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', width: '20%' }}>每题分值</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', width: '20%' }}>小计</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const subtotal = (row.cfg.count || 0) * (row.cfg.score_per_question || 0);
              return (
                <tr key={`${row.unitId}-${row.idx}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <Select
                      size="small"
                      variant="borderless"
                      style={{ width: '100%' }}
                      value={row.cfg.question_type}
                      onChange={(v) => updateRow(row.unitId, row.idx, 'question_type', v)}
                      options={QUESTION_TYPES}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <InputNumber
                      size="small"
                      variant="borderless"
                      style={{ width: 80 }}
                      min={0} max={200}
                      value={row.cfg.count}
                      onChange={(v) => updateRow(row.unitId, row.idx, 'count', v || 0)}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <InputNumber
                      size="small"
                      variant="borderless"
                      style={{ width: 80 }}
                      min={1} max={100}
                      value={row.cfg.score_per_question}
                      onChange={(v) => updateRow(row.unitId, row.idx, 'score_per_question', v || 1)}
                      suffix="分"
                    />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 500, color: '#1890ff' }}>
                    <Tag color="blue">{subtotal} 分</Tag>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <Popconfirm title="删除此行？" onConfirm={() => removeRow(row.unitId, row.idx)}>
                      <Button size="small" danger type="text" icon={<DeleteOutlined />} disabled={rows.length <= 1} />
                    </Popconfirm>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e8e8e8', fontWeight: 600, background: '#fafafa' }}>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                合计 {totalQuestions} 题
              </td>
              <td colSpan={2} />
              <td style={{ padding: '10px 12px', textAlign: 'center', color: scoreMatched ? '#52c41a' : '#ff4d4f' }}>
                {computedTotal} 分
                {!scoreMatched && targetTotal > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>
                    (目标 {targetTotal} 分，差 {Math.abs(computedTotal - targetTotal)} 分)
                  </div>
                )}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* Bottom actions */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button size="small" icon={<PlusOutlined />} onClick={handleAddRow}>添加题型</Button>
        {targetTotal > 0 && !scoreMatched && (
          <Tag color="error">
            结构总分（{computedTotal}）≠ 试卷总分（{targetTotal}），差值 {Math.abs(computedTotal - targetTotal)} 分
          </Tag>
        )}
      </div>
    </div>
  );
}
