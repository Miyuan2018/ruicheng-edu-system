import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, message, Collapse, Tag, Tabs, Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import apiClient from '../../../api/client';
import { usePaperEditorStore } from '../../../store/paperEditor';
import { useReferenceValues, toLabelMap, toColorMap } from '../../../hooks/useReferenceValues';

export default function PreviewFinalizeStep() {
  const navigate = useNavigate();
  const { paper, saveAll, setDirty } = usePaperEditorStore();
  const { 'difficulty-levels': diffs, 'question-types': qtypes } = useReferenceValues();
  const diffLabels = toLabelMap(diffs);
  const diffColors = toColorMap(diffs);
  const qtypeLabels = toLabelMap(qtypes);

  // Finalize state
  const [selectedClasses] = useState<string[]>([]);
  const [publishNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const units = paper?.units || [];
  const templateType = paper?.template_type || 'generic';
  const isFlatView = templateType === 'question_type';
  // 归一化 grades 为数组（防御旧版草稿数据中 grades 为字符串的情况）
  const grades: string[] = (() => {
    const raw = paper?.grade_level?.grades;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw) return [raw];
    return [];
  })();
  const totalQuestions = units.reduce((sum, u) => sum + (u.questions?.length || 0), 0);
  const totalScore = units.reduce((sum, u) => sum + (u.questions || []).reduce((s, q) => s + (q.score || 0), 0), 0);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await saveAll();
      message.success('已保存');
      usePaperEditorStore.getState().setDirty(false);
      setTimeout(() => navigate('/papers'), 500);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      message.error(typeof detail === 'string' ? detail : '保存失败');
    } finally { setSubmitting(false); }
  };

  const handleSaveAndPublish = async () => {
    setSubmitting(true);
    try {
      await saveAll();
      const pid = usePaperEditorStore.getState().paper?.id;
      if (pid) {
        await apiClient.post(`/exam-papers/${pid}/publish`, {
          class_ids: selectedClasses,
          note: publishNote || undefined,
        });
      }
      message.success('已保存并发布');
      usePaperEditorStore.getState().setDirty(false);
      setTimeout(() => navigate('/papers'), 500);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      message.error(typeof detail === 'string' ? detail : '保存失败');
    } finally { setSubmitting(false); }
  };

  const handleCancelEdit = async () => {
    if (!paper?.id) return;
    try {
      const { draftApi } = await import('../../../api/drafts');
      const resp = await draftApi.getByPaper(paper.id);
      const drafts = Array.isArray(resp?.data) ? resp.data : [];
      for (const d of drafts) await draftApi.delete(d.id);
      message.info('已取消修改');
      navigate('/papers');
    } catch { message.error('操作失败'); }
  };

  // ── Finalize Tab ──
  const finalizeTab = (
    <div>
      <Card title="试卷概要" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 14 }}>
          <div><span style={{ color: '#888' }}>标题：</span>{paper?.title || '未命名'}</div>
          <div><span style={{ color: '#888' }}>学科：</span>{paper?.subject || '-'}</div>
          <div><span style={{ color: '#888' }}>年级：</span>{grades.join(', ') || '-'}</div>
          <div><span style={{ color: '#888' }}>时长：</span>{paper?.duration_minutes ? paper.duration_minutes + '分钟' : '不限时'}</div>
          <div><span style={{ color: '#888' }}>总题数：</span>{totalQuestions}</div>
          <div><span style={{ color: '#888' }}>总分：</span><span style={{ color: '#1890ff', fontWeight: 600 }}>{totalScore}</span></div>
        </div>
      </Card>

      {(() => {
        const targetRatio = paper?.difficulty_ratio || { EASY: 20, MEDIUM: 50, HARD: 30 };
        const actualCounts: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
        units.forEach((u) => {
          (u.questions || []).forEach((q) => {
            const d = q.question?.difficulty || 'MEDIUM';
            if (actualCounts[d] !== undefined) actualCounts[d]++;
          });
        });
        const actualTotal = actualCounts.EASY + actualCounts.MEDIUM + actualCounts.HARD || 1;
        const diffs = ['EASY', 'MEDIUM', 'HARD'] as const;
        const threshold = 10;
        const allOk = diffs.every((d) => {
          const actual = Math.round((actualCounts[d] / actualTotal) * 100);
          return Math.abs(actual - (targetRatio[d] || 0)) <= threshold;
        });
        return (
          <Card
            title={<span>难度偏离<Tag color={allOk ? 'success' : 'warning'} style={{ marginLeft: 8 }}>{allOk ? '在阈值内' : '偏差较大'}</Tag></span>}
            size="small" style={{ marginBottom: 16 }}
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
                      <td style={{ padding: 8, textAlign: 'center', color: ok ? '#52c41a' : '#ff4d4f' }}>{deviation > 0 ? '+' : ''}{deviation}%</td>
                      <td style={{ padding: 8, textAlign: 'center' }}><Tag color={ok ? 'success' : 'error'} style={{ fontSize: 10 }}>{ok ? '✓' : '⚠'}</Tag></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })()}

      <Card title="选题清单" size="small">
        {isFlatView ? (
          (() => {
            const allQuestions = units.flatMap(u => u.questions || []);
            const typeGroups: Record<string, typeof allQuestions> = {};
            allQuestions.forEach(q => {
              const qt = q.question_type || 'SINGLE_CHOICE';
              if (!typeGroups[qt]) typeGroups[qt] = [];
              typeGroups[qt].push(q);
            });
            return Object.entries(typeGroups).map(([qt, qs]) => {
              const qtypeLabels: Record<string, string> = { SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', FILL_BLANK: '填空题', SUBJECTIVE: '解答题' };
              return (
                <Collapse key={qt} size="small" style={{ marginBottom: 8 }}
                  items={[{
                    key: qt,
                    label: <span><Tag color="blue">{qtypeLabels[qt] || qt}</Tag><span style={{ fontSize: 12, color: '#999' }}>{qs.length + '题'}</span></span>,
                    children: qs.length === 0
                      ? <div style={{ color: '#ccc', fontSize: 12, padding: 8, textAlign: 'center' }}>暂无选题</div>
                      : qs.map((q, qIdx) => (
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
                      )),
                  }]}
                />
              );
            });
          })()
        ) : (
          units.map((unit, uIdx) => {
            const unitKey = unit.id || String(uIdx);
            const qs = unit.questions || [];
            return (
              <Collapse key={unitKey} size="small" style={{ marginBottom: 8 }}
                items={[{
                  key: unitKey,
                  label: <span><Tag>{unit.name || '分组' + (uIdx + 1)}</Tag><span style={{ fontSize: 12, color: '#999' }}>{qs.length + '题'}</span></span>,
                  children: qs.length === 0
                    ? <div style={{ color: '#ccc', fontSize: 12, padding: 8, textAlign: 'center' }}>暂无选题</div>
                    : qs.map((q, qIdx) => (
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
                    )),
                }]}
              />
            );
          })
        )}
      </Card>
    </div>
  );

  // ── Preview Tab ──
  const TYPE_ORDER = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SUBJECTIVE'];
  let globalIndex = 0;

  const renderQuestion = (q: any, index: number) => {
    const question = q.question || {};
    let rawTitle = question.title || q.title || '';
    const difficulty = question.difficulty || q.difficulty || '';
    const score = q.score || 0;

    let options: any[] = question.options || [];
    // 兜底：从correct_answer JSON解析，并规范化字符串选项为{label,text}
    if (options.length === 0 && question.correct_answer) {
      try {
        const parsed = typeof question.correct_answer === 'string'
          ? JSON.parse(question.correct_answer)
          : question.correct_answer;
        const raw = parsed?.options;
        if (Array.isArray(raw)) {
          options = raw.map((opt: any) => {
            if (typeof opt === 'string') {
              const m = opt.match(/^([A-H])[.．、）\)]\s*(.*)/);
              if (m) return { label: m[1], text: m[2] };
              if (/^[A-H]$/.test(opt)) return { label: opt, text: '' };
            }
            return opt;
          });
        }
      } catch { /* */ }
    }

    let title = rawTitle;
    if (options.length > 0) {
      const optMatch = rawTitle.match(/\s*A[.．、）\)]\s/);
      if (optMatch && optMatch.index !== undefined && optMatch.index > 0) {
        title = rawTitle.substring(0, optMatch.index).replace(/[（(]\s*[）)]\s*$/, '').trim();
      }
    }
    const isChoice = q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE';
    const isSubjective = q.question_type === 'SUBJECTIVE';

    return (
      <div key={q.question_id || index} style={{ padding: '8px 0', borderBottom: '1px dashed #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ flex: 1, lineHeight: 1.8, fontSize: 14 }}>
            <strong>{index + 1 + '. '}</strong>
            {title.substring(0, 200)}
          </span>
          <Space size={4} style={{ flexShrink: 0, marginLeft: 12 }}>
            <Tag color={diffColors[difficulty]?.color || 'default'} style={{ fontSize: 10 }}>
              {diffLabels[difficulty] || difficulty}
            </Tag>
            <span style={{ fontSize: 12, color: '#999' }}>{score + '分'}</span>
          </Space>
        </div>
        {isChoice && options.length > 0 && (
          <div style={{ marginTop: 4, marginLeft: 24, fontSize: 13 }}>
            {options.map((opt: any, idx: number) => {
              let label: string, text: string;
              if (typeof opt === 'string') {
                const m = opt.match(/^([A-H])[.．、）\)]\s*(.*)/);
                label = m ? m[1] : String.fromCharCode(65 + idx);
                text = m ? m[2] : opt;
              } else {
                label = opt.label || opt.id || String.fromCharCode(65 + idx);
                text = opt.text || opt.content || '';
              }
              return <div key={label} style={{ marginBottom: 2 }}>{label + '、' + text}</div>;
            })}
          </div>
        )}
        {isSubjective && (
          <div style={{ marginTop: 4, marginLeft: 24, border: '1px dashed #ccc', minHeight: 60, borderRadius: 4 }} />
        )}
      </div>
    );
  };

  const previewTab = (
    <div style={{
      background: '#fff', maxWidth: 800, margin: '0 auto',
      padding: '24px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      fontFamily: "'Times New Roman', 'Noto Serif CJK SC', sans-serif", fontSize: 14,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: 2 }}>{paper?.title || '试卷预览'}</div>
      </div>
      {paper?.subtitle ? <div style={{ textAlign: 'center', fontSize: 13, color: '#666', marginTop: 4 }}>{paper.subtitle}</div> : null}
      <div style={{ textAlign: 'center', fontSize: 12, color: '#666', marginBottom: 12 }}>
        {[
          paper?.subject || '',
          grades.join(', ') || '',
          '总分: ' + (paper?.total_score ?? 0) + '分',
          paper?.duration_minutes != null ? '时长: ' + paper.duration_minutes + '分钟' : '',
        ].filter(Boolean).join(' | ')}
      </div>
      {paper?.instructions ? (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fffbe6', borderRadius: 4, fontSize: 12, color: '#666', border: '1px solid #ffe58f' }}>
          {paper.instructions}
        </div>
      ) : null}

      {(() => {
        const showUnits = templateType !== 'question_type';
        const numLabels = ['一', '二', '三', '四', '五', '六', '七', '八'];
        let sectionIndex = 0;

        if (showUnits) {
          return units.map((unit) => {
            const uQuestions = unit.questions || [];
            if (uQuestions.length === 0) return null;
            const uScore = uQuestions.reduce((s, q) => s + (q.score || 0), 0);
            const typeGroups: Record<string, any[]> = {};
            uQuestions.forEach((q) => { const qt = q.question_type || 'SINGLE_CHOICE'; if (!typeGroups[qt]) typeGroups[qt] = []; typeGroups[qt].push(q); });
            return (
              <div key={unit.id} style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #333' }}>
                  {unit.name}<span style={{ fontWeight: 'normal', fontSize: 12, color: '#999', marginLeft: 8 }}>（共{uQuestions.length}题、{uScore}分）</span>
                </div>
                {TYPE_ORDER.map((qt) => {
                  const qs = typeGroups[qt]; if (!qs || qs.length === 0) return null;
                  const typeScore = qs.reduce((s, q) => s + (q.score || 0), 0);
                  const numLabel = numLabels[sectionIndex] || String(sectionIndex + 1); sectionIndex++;
                  return (
                    <div key={qt} style={{ marginBottom: 16, paddingLeft: 8 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>
                        {numLabel + '、' + (qtypeLabels[qt] || qt) + '（每题' + (qs[0]?.score || 0) + '分，共' + qs.length + '题，合计' + typeScore + '分）'}
                      </div>
                      {qs.map((q) => { globalIndex++; return renderQuestion(q, globalIndex - 1); })}
                    </div>
                  );
                })}
              </div>
            );
          });
        }

        const allQuestions: any[] = [];
        units.forEach((u) => { (u.questions || []).forEach((q) => allQuestions.push(q)); });
        const grouped: Record<string, any[]> = {};
        allQuestions.forEach((q) => { const qt = q.question_type || 'SINGLE_CHOICE'; if (!grouped[qt]) grouped[qt] = []; grouped[qt].push(q); });
        return TYPE_ORDER.map((qt) => {
          const qs = grouped[qt]; if (!qs || qs.length === 0) return null;
          const typeScore = qs.reduce((s, q) => s + (q.score || 0), 0);
          const numLabel = numLabels[sectionIndex] || String(sectionIndex + 1); sectionIndex++;
          return (
            <div key={qt} style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #333' }}>
                {numLabel + '、' + (qtypeLabels[qt] || qt) + '（每题' + (qs[0]?.score || 0) + '分，共' + qs.length + '题，合计' + typeScore + '分）'}
              </div>
              {qs.map((q) => { globalIndex++; return renderQuestion(q, globalIndex - 1); })}
            </div>
          );
        }).filter(Boolean);
      })()}

      {units.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#ccc', fontSize: 13 }}>暂无试卷内容，请先完成选题</div>}
      <div style={{ textAlign: 'right', marginTop: 16, color: '#999', fontSize: 12 }}>{'共 ' + totalQuestions + ' 道试题'}</div>
    </div>
  );

  const tabItems = [
    { key: 'finalize', label: '试卷信息', children: finalizeTab },
    { key: 'preview', label: '试卷预览', children: previewTab },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button type="primary" size="large" icon={<CheckCircleOutlined />} loading={submitting} onClick={handleSave}>
            保存
          </Button>
          <Button type="primary" size="large" ghost icon={<CheckCircleOutlined />} loading={submitting} onClick={handleSaveAndPublish}>
            保存并发布
          </Button>
          {paper?.id && (
            <Button size="large" danger onClick={handleCancelEdit}>取消修改</Button>
          )}
        </Space>
      </div>

      {/* Tabs */}
      <Tabs defaultActiveKey="finalize" items={tabItems} />
    </div>
  );
}
