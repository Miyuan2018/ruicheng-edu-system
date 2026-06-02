import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Radio, Checkbox, Input, message, Collapse, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import apiClient from '../../../api/client';
import { usePaperEditorStore } from '../../../store/paperEditor';
import { useReferenceValues, toLabelMap, toColorMap } from '../../../hooks/useReferenceValues';

export default function FinalizeStep() {
  const navigate = useNavigate();
  const { paper, saveAll, setDirty } = usePaperEditorStore();
  const { 'difficulty-levels': diffs } = useReferenceValues();
  const diffLabels = toLabelMap(diffs);
  const diffColors = toColorMap(diffs);

  const [publishMode, setPublishMode] = useState<'draft' | 'publish'>('draft');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [publishNote, setPublishNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [classOptions, setClassOptions] = useState<{ value: string; label: string }[]>([]);
  const [classLoading, setClassLoading] = useState(false);

  const units = paper?.units || [];
  const totalQuestions = units.reduce((sum, u) => sum + (u.questions?.length || 0), 0);
  const totalScore = units.reduce((sum, u) => sum + (u.questions || []).reduce((s, q) => s + (q.score || 0), 0), 0);

  // Load classes when publish mode selected
  const loadClasses = async () => {
    if (classOptions.length > 0) return;
    setClassLoading(true);
    try {
      const resp = await apiClient.get('/classes');
      const data = resp.data;
      const items = Array.isArray(data) ? data : (data.items || data.data || []);
      setClassOptions(items.map((c: any) => ({ value: c.id, label: c.name || c.class_name || c.id })));
    } catch {
      // Silently fail - classes might not be available
    } finally {
      setClassLoading(false);
    }
  };

  const handlePublishToggle = (v: 'draft' | 'publish') => {
    setPublishMode(v);
    if (v === 'publish') {
      loadClasses();
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Paper summary */}
      <Card title="试卷概要" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 14 }}>
          <div><span style={{ color: '#888' }}>标题：</span>{paper?.title || '未命名'}</div>
          <div><span style={{ color: '#888' }}>学科：</span>{paper?.subject || '-'}</div>
          <div><span style={{ color: '#888' }}>年级：</span>{(paper?.grade_level?.grades || []).join(', ') || '-'}</div>
          <div><span style={{ color: '#888' }}>时长：</span>{paper?.duration_minutes ? paper.duration_minutes + '分钟' : '不限时'}</div>
          <div><span style={{ color: '#888' }}>总题数：</span>{totalQuestions}</div>
          <div><span style={{ color: '#888' }}>总分：</span><span style={{ color: '#1890ff', fontWeight: 600 }}>{totalScore}</span></div>
        </div>
      </Card>

      {/* Difficulty deviation */}
      {(() => {
        const targetRatio = paper?.difficulty_ratio || { EASY: 20, MEDIUM: 50, HARD: 30 };
        const actualCounts: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
        units.forEach((u) => {
          (u.questions || []).forEach((q) => {
            const d = q.question?.difficulty || q.difficulty || 'MEDIUM';
            if (actualCounts[d] !== undefined) actualCounts[d]++;
          });
        });
        const actualTotal = actualCounts.EASY + actualCounts.MEDIUM + actualCounts.HARD || 1;
        const diffs = ['EASY', 'MEDIUM', 'HARD'] as const;
        const threshold = 10; // ±10% acceptable
        const allOk = diffs.every((d) => {
          const actual = Math.round((actualCounts[d] / actualTotal) * 100);
          const target = targetRatio[d] || 0;
          return Math.abs(actual - target) <= threshold;
        });
        return (
          <Card
            title={
              <span>难度偏离
                <Tag color={allOk ? 'success' : 'warning'} style={{ marginLeft: 8 }}>
                  {allOk ? '在阈值内' : '偏差较大'}
                </Tag>
              </span>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#999', borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>难度</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>目标比例</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>实际题数</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>实际比例</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>偏离</th>
                  <th style={{ padding: 8, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => {
                  const target = targetRatio[d] || 0;
                  const actual = Math.round((actualCounts[d] / actualTotal) * 100);
                  const deviation = actual - target;
                  const ok = Math.abs(deviation) <= threshold;
                  return (
                    <tr key={d} style={{ borderBottom: '1px solid #fafafa' }}>
                      <td style={{ padding: 8 }}>{diffLabels[d] || d}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>{target}%</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>{actualCounts[d]}题</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>{actual}%</td>
                      <td style={{ padding: 8, textAlign: 'center', color: ok ? '#52c41a' : '#ff4d4f' }}>
                        {deviation > 0 ? '+' : ''}{deviation}%
                      </td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <Tag color={ok ? 'success' : 'error'} style={{ fontSize: 10 }}>{ok ? '✓' : '⚠'}</Tag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })()}

      {/* Publish options */}
      <Card title="发布设置" style={{ marginBottom: 16 }}>
        <Radio.Group value={publishMode} onChange={(e) => handlePublishToggle(e.target.value)}>
          <Radio value="draft">存入草稿</Radio>
          <Radio value="publish">立即发布</Radio>
        </Radio.Group>

        {publishMode === 'publish' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, color: '#666', fontSize: 13 }}>发布到班级</label>
              <Checkbox.Group
                options={classOptions}
                value={selectedClasses}
                onChange={(v) => setSelectedClasses(v as string[])}
              />
              {classLoading && <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>加载中...</span>}
              {!classLoading && classOptions.length === 0 && (
                <div style={{ color: '#999', fontSize: 12 }}>暂未创建班级，可直接发布（仅保存发布状态）</div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: '#666', fontSize: 13 }}>发布说明（可选）</label>
              <Input.TextArea
                rows={2}
                placeholder="通知学生时的附加说明..."
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Question list in collapse */}
      <Card title="选题清单" size="small">
        {units.map((unit, uIdx) => {
          const unitKey = unit.id || String(uIdx);
          const qs = unit.questions || [];
          return (
            <Collapse
              key={unitKey}
              size="small"
              style={{ marginBottom: 8 }}
              items={[
                {
                  key: unitKey,
                  label: (
                    <span>
                      <Tag>{unit.name || '分组' + (uIdx + 1)}</Tag>
                      <span style={{ fontSize: 12, color: '#999' }}>{qs.length + '题'}</span>
                    </span>
                  ),
                  children: qs.length === 0 ? (
                    <div style={{ color: '#ccc', fontSize: 12, padding: 8, textAlign: 'center' }}>暂无选题</div>
                  ) : (
                    qs.map((q, qIdx) => (
                      <div key={q.question_id} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#999', fontSize: 11, width: 24 }}>{qIdx + 1}</span>
                        <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(q.question?.title || '').substring(0, 80)}
                        </span>
                        <Tag color={diffColors[q.question?.difficulty || '']?.color || 'default'} style={{ fontSize: 10 }}>
                          {diffLabels[q.question?.difficulty || ''] || q.question?.difficulty}
                        </Tag>
                        <span style={{ fontSize: 12, color: '#999' }}>{q.score + '分'}</span>
                      </div>
                    ))
                  ),
                },
              ]}
            />
          );
        })}
      </Card>

      {/* Submit button */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <Button
          type="primary"
          size="large"
          icon={<CheckCircleOutlined />}
          loading={submitting}
          onClick={async () => {
            if (!paper?.id) {
              message.warning('试卷尚未保存，请先点击上方"保存草稿"');
              return;
            }
            setSubmitting(true);
            try {
              await saveAll();
              if (publishMode === 'publish') {
                await apiClient.post(`/exam-papers/${paper.id}/publish`, {
                  class_ids: selectedClasses,
                  note: publishNote || undefined,
                });
                message.success('试卷已发布并通知学生');
              } else {
                message.success('试卷已保存为草稿');
              }
              setDirty(false);
              setTimeout(() => navigate('/papers'), 500);
            } catch (err: any) {
              message.error(err?.response?.data?.detail || '操作失败');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {publishMode === 'publish' ? '确认发布' : '确认入库'}
        </Button>
      </div>
    </div>
  );
}
