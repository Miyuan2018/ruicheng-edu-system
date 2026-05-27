import { useEffect, useState } from 'react';
import { Spin, Empty } from 'antd';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap } from '../../hooks/useReferenceValues';

const TYPE_ORDER = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SUBJECTIVE'];

interface QuestionItem {
  id: string;
  title?: string;
  question_type?: string;
  score?: number;
  correct_answer?: string;
}

export default function PrintPreviewPage() {
  const refs = useReferenceValues();
  const qtypes = refs['question-types'];
  const searchParams = new URLSearchParams(window.location.search);
  const paperId = searchParams.get('paperId');

  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paperId) { setLoading(false); return; }
    apiClient.get('/exam-papers/' + paperId + '/questions')
      .then((resp) => { setQuestions(resp.data || []); })
      .catch(() => { setQuestions([]); });
    apiClient.get('/exam-papers/' + paperId)
      .then((resp) => { setPaper(resp.data); })
      .catch(() => { setPaper(null); })
      .finally(() => { setLoading(false); });
  }, [paperId]);

  // Auto-print when loaded
  useEffect(() => {
    if (!loading && paper) {
      setTimeout(() => { window.print(); }, 500);
    }
  }, [loading, paper]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!paper) {
    return <Empty description="加载失败，请从试卷列表重新打开" />;
  }

  // Group questions by type
  const grouped: Record<string, QuestionItem[]> = {};
  questions.forEach((q) => {
    const t = q.question_type || 'SINGLE_CHOICE';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(q);
  });

  let globalIndex = 0;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'SimSun, serif', fontSize: 14 }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, margin: 0, letterSpacing: 2 }}>{paper.title}</h1>
      </div>
      {paper.subtitle && <div style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>{paper.subtitle}</div>}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginBottom: 12 }}>
        {(paper.subject || '') + ' | ' + (paper.grade_level || '') + ' | 总分: ' + (paper.total_score || 0) + '分 | 时长: ' + (paper.duration_minutes || 0) + '分钟'}
      </div>
      {paper.description && <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>{paper.description}</div>}
      {paper.instructions && (
        <div style={{ padding: '4px 8px', marginBottom: 12, border: '1px solid #d9d9d9', fontSize: 11, background: '#fafafa' }}>
          注意事项：{paper.instructions}
        </div>
      )}

      {/* Questions by type */}
      {TYPE_ORDER.map((t) => {
        const qs = grouped[t] || [];
        if (qs.length === 0) return null;

        const sectionScore = qs.reduce((s, q) => s + (q.score || 0), 0);
        return (
          <div key={t} style={{ marginBottom: 16 }}>
            <h3 style={{ borderBottom: '2px solid #333', paddingBottom: 4, fontSize: 15 }}>
              {toLabelMap(qtypes)[t]}（共{qs.length}题，{sectionScore}分）
            </h3>
            {qs.map((q) => {
              globalIndex++;
              let answerData: { options?: { label: string; text?: string }[] } | null = null;
              try { answerData = JSON.parse(q.correct_answer || '{}'); } catch {}
              const options = answerData && answerData.options;
              const isChoice = q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE';

              return (
                <div key={q.id} style={{ marginBottom: 8, pageBreakInside: 'avoid' as const }}>
                  <div style={{ lineHeight: 1.8 }}>
                    <strong>{globalIndex}. </strong>
                    {(q.title || '')}
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>（{q.score}分）</span>
                  </div>
                  {isChoice && options && (
                    <div style={{ marginLeft: 24, fontSize: 13 }}>
                      {options.map((opt) => (
                        <div key={opt.label}>{opt.label}. {opt.text || ''}</div>
                      ))}
                    </div>
                  )}
                  {q.question_type === 'FILL_BLANK' && (
                    <div style={{ marginLeft: 24, borderBottom: '1px solid #333', width: 200, height: 22 }} />
                  )}
                  {q.question_type === 'SUBJECTIVE' && (
                    <div style={{ marginLeft: 24, border: '1px dashed #ccc', minHeight: 60, borderRadius: 4, marginTop: 4 }} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ textAlign: 'right', marginTop: 16, fontSize: 11, color: '#999' }}>共 {questions.length} 道试题</div>
    </div>
  );
}
