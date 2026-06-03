import { Card, Button, Space, Tag, Tooltip, message } from 'antd';
import {
  PrinterOutlined, FileWordOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { usePaperEditorStore } from '../../../store/paperEditor';
import { useReferenceValues, toLabelMap, toColorMap } from '../../../hooks/useReferenceValues';

export default function PreviewStep() {
  const { paper } = usePaperEditorStore();
  const { 'difficulty-levels': diffs, 'question-types': qtypes } = useReferenceValues();
  const diffLabels = toLabelMap(diffs);
  const diffColors = toColorMap(diffs);
  const qtypeLabels = toLabelMap(qtypes);

  const units = paper?.units || [];

  // Calculate stats
  const totalQuestions = units.reduce((sum, u) => {
    return sum + (u.questions?.length || 0);
  }, 0);
  const totalScore = units.reduce((sum, u) => {
    const uScore = (u.questions || []).reduce((s, q) => s + (q.score || 0), 0);
    return sum + uScore;
  }, 0);

  // Generate cross-unit continuous numbering
  let globalIndex = 0;
  const TYPE_ORDER = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SUBJECTIVE'];

  const handleExport = async (format: 'word' | 'pdf') => {
    if (!paper?.id) {
      message.warning('请先保存试卷');
      return;
    }
    try {
      const { saveAll } = usePaperEditorStore.getState();
      // 先保存到数据库，确保导出内容是最新的
      if (paper.units.length > 0) {
        await saveAll();
      }
      const apiClient = (await import('../../../api/client')).default;
      const resp = await apiClient.get(`/exam-papers/${paper.id}/export/${format}`, {
        responseType: 'blob',
      });
      const blob = resp.data;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `paper.${format === 'word' ? 'docx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      message.success('导出成功');
    } catch {
      message.error('导出失败，请检查试题是否已保存');
    }
  };

  const handlePrint = () => {
    if (!paper?.id) {
      message.warning('请先保存试卷');
      return;
    }
    // 先保存确保导出内容是最新的
    if (paper.units.length > 0) {
      const { saveAll } = usePaperEditorStore.getState();
      saveAll();
    }
    const url = `/print-preview?paperId=${paper.id}`;
    window.open(url, '_blank', 'width=900,height=700');
    // PrintPreviewPage 自身会在数据加载完成后自动触发 window.print()
  };

  // Render a question item
  const renderQuestion = (q: any, index: number) => {
    const question = q.question || {};
    let rawTitle = question.title || q.title || '';
    const difficulty = question.difficulty || q.difficulty || '';
    const score = q.score || 0;

    let options: any[] = [];
    try {
      if (question.options) {
        options = question.options;
      } else if (question.correct_answer) {
        const parsed = typeof question.correct_answer === 'string'
          ? JSON.parse(question.correct_answer)
          : question.correct_answer;
        options = parsed.options || [];
      }
    } catch { /* ignore */ }

    // 有独立选项时，裁剪题干中的行内选项文本
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
                const m = opt.match(/^([A-D])[.．、）\)]\s*(.*)/);
                label = m ? m[1] : String.fromCharCode(65 + idx);
                text = m ? m[2] : opt;
              } else {
                label = opt.label || opt.id || String.fromCharCode(65 + idx);
                text = opt.text || opt.content || '';
              }
              return <div key={label} style={{ marginBottom: 2 }}>{label + '. ' + text}</div>;
            })}
          </div>
        )}

        {isSubjective && (
          <div style={{ marginTop: 4, marginLeft: 24, border: '1px dashed #ccc', minHeight: 60, borderRadius: 4 }} />
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Tooltip title="导出 Word">
            <Button icon={<FileWordOutlined />} onClick={() => handleExport('word')}>导出 Word</Button>
          </Tooltip>
          <Tooltip title="导出 PDF">
            <Button icon={<FilePdfOutlined />} onClick={() => handleExport('pdf')}>导出 PDF</Button>
          </Tooltip>
          <Tooltip title="打印">
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
          </Tooltip>
        </Space>
      </div>

      {/* Overview bar */}
      <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
        <Space split={<span style={{ color: '#ddd' }}>|</span>}>
          <span>{units.length + '大题'}</span>
          <span>{totalQuestions + '题'}</span>
          <span style={{ color: '#1890ff', fontWeight: 500 }}>{'总分 ' + totalScore}</span>
          {paper?.subject && <span>{paper.subject}</span>}
          {paper?.grade_level?.grades && paper.grade_level.grades.length > 0 && (
            <span>{(paper.grade_level.grades as string[]).join(', ')}</span>
          )}
        </Space>
      </Card>

      {/* A4-style preview */}
      <div style={{
        background: '#fff',
        maxWidth: 800,
        margin: '0 auto',
        padding: '24px 32px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        fontFamily: "'Times New Roman', 'Noto Serif CJK SC', sans-serif",
        fontSize: 14,
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: 2 }}>{paper?.title || '试卷预览'}</div>
          {paper?.subtitle ? <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{paper.subtitle}</div> : null}
        </div>

        {/* Instructions */}
        {paper?.instructions ? (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fffbe6', borderRadius: 4, fontSize: 12, color: '#666', border: '1px solid #ffe58f' }}>
            {paper.instructions}
          </div>
        ) : null}

        {/* Questions: follow show_units mode */}
        {(() => {
          const showUnits = paper?.show_units ?? false;
          const numLabels = ['一', '二', '三', '四', '五', '六', '七', '八'];
          let sectionIndex = 0;

          if (showUnits) {
            // 按单元 → 单元内按题型
            return units.map((unit) => {
              const uQuestions = unit.questions || [];
              if (uQuestions.length === 0) return null;
              const uScore = uQuestions.reduce((s, q) => s + (q.score || 0), 0);
              const typeGroups: Record<string, any[]> = {};
              uQuestions.forEach((q) => {
                const qt = q.question_type || 'SINGLE_CHOICE';
                if (!typeGroups[qt]) typeGroups[qt] = [];
                typeGroups[qt].push(q);
              });
              return (
                <div key={unit.id} style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #333' }}>
                    {unit.name}
                    <span style={{ fontWeight: 'normal', fontSize: 12, color: '#999', marginLeft: 8 }}>
                      （共{uQuestions.length}题、{uScore}分）
                      {unit.time_limit_minutes ? ` | 限时${unit.time_limit_minutes}分钟` : ''}
                    </span>
                  </div>
                  {TYPE_ORDER.map((qt) => {
                    const qs = typeGroups[qt];
                    if (!qs || qs.length === 0) return null;
                    const typeScore = qs.reduce((s, q) => s + (q.score || 0), 0);
                    const sectionName = qtypeLabels[qt] || qt;
                    const numLabel = numLabels[sectionIndex] || String(sectionIndex + 1);
                    sectionIndex++;
                    return (
                      <div key={qt} style={{ marginBottom: 16, paddingLeft: 8 }}>
                        <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>
                          {numLabel + '、' + sectionName + '（每题' + (qs[0]?.score || 0) + '分，共' + qs.length + '题，合计' + typeScore + '分）'}
                        </div>
                        {qs.map((q) => {
                          globalIndex++;
                          return renderQuestion(q, globalIndex - 1);
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            });
          }

          // 按题型：直接摊平
          const allQuestions: any[] = [];
          units.forEach((u) => {
            (u.questions || []).forEach((q) => allQuestions.push(q));
          });
          const grouped: Record<string, any[]> = {};
          allQuestions.forEach((q) => {
            const qt = q.question_type || 'SINGLE_CHOICE';
            if (!grouped[qt]) grouped[qt] = [];
            grouped[qt].push(q);
          });
          return TYPE_ORDER.map((qt) => {
            const qs = grouped[qt];
            if (!qs || qs.length === 0) return null;
            const typeScore = qs.reduce((s, q) => s + (q.score || 0), 0);
            const sectionName = qtypeLabels[qt] || qt;
            const numLabel = numLabels[sectionIndex] || String(sectionIndex + 1);
            sectionIndex++;
            return (
              <div key={qt} style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #333' }}>
                  {numLabel + '、' + sectionName + '（每题' + (qs[0]?.score || 0) + '分，共' + qs.length + '题，合计' + typeScore + '分）'}
                </div>
                {qs.map((q) => {
                  globalIndex++;
                  return renderQuestion(q, globalIndex - 1);
                })}
              </div>
            );
          }).filter(Boolean);
        })()}

        {units.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#ccc', fontSize: 13 }}>暂无试卷内容，请先完成选题</div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'right', marginTop: 16, color: '#999', fontSize: 12 }}>
          {'共 ' + totalQuestions + ' 道试题'}
        </div>
      </div>
    </div>
  );
}
