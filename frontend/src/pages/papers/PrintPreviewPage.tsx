import { useEffect, useState } from 'react';
import { Spin, Empty, Button, Result } from 'antd';
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

function fmtGrade(gl: any): string {
  if (!gl) return '';
  if (typeof gl === 'string') return gl;
  if (gl.grades && Array.isArray(gl.grades)) return gl.grades.join(', ');
  return '';
}

export default function PrintPreviewPage() {
  const refs = useReferenceValues();
  const qtypes = refs['question-types'];
  const searchParams = new URLSearchParams(window.location.search);
  const paperId = searchParams.get('paperId');

  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!paperId) { setLoading(false); setError('未指定试卷ID'); return; }
    setLoading(true);
    apiClient.get('/exam-papers/' + paperId + '/preview')
    .then((resp) => {
      const data = resp.data;
      setPaper(data.paper || null);
      // Extract all questions from units into flat list with continuous numbering
      const allQuestions: QuestionItem[] = [];
      const units = data.units || [];
      let idx = 0;
      units.forEach((u: any) => {
        (u.questions || []).forEach((q: any) => {
          idx++;
          allQuestions.push({
            id: q.question_id || q.id,
            title: q.title || q.question?.title || '',
            question_type: q.question_type || q.question?.question_type || '',
            score: q.score || 0,
            correct_answer: q.correct_answer || q.question?.correct_answer || '',
          });
        });
      });
      setQuestions(allQuestions);
      setError('');
    }).catch((err) => {
      const status = err?.response?.status;
      if (status === 404) setError('试卷不存在或已被删除');
      else if (status === 403) setError('没有权限查看该试卷');
      else setError('加载试卷失败');
      setPaper(null);
      setQuestions([]);
    }).finally(() => { setLoading(false); });
  }, [paperId]);

  // Auto-print when loaded
  useEffect(() => {
    if (!loading && paper && questions.length > 0) {
      setTimeout(() => { window.print(); }, 500);
    }
  }, [loading, paper, questions]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!paper) {
    return (
      <Result status="error" title="加载失败" subTitle={error}
        extra={<Button onClick={() => window.close()}>关闭</Button>} />
    );
  }

  // Group questions by type
  const grouped: Record<string, QuestionItem[]> = {};
  questions.forEach((q) => {
    const t = q.question_type || 'SINGLE_CHOICE';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(q);
  });

  let globalIndex = 0;
  const gradeText = fmtGrade(paper.grade_level);
  const subParts: string[] = [];
  if (paper.subject) subParts.push(paper.subject);
  if (gradeText) subParts.push(gradeText);
  subParts.push('总分: ' + (paper.total_score ?? 0) + '分');
  if (paper.duration_minutes != null) subParts.push('时长: ' + paper.duration_minutes + '分钟');

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: "'Times New Roman', 'Noto Serif CJK SC', sans-serif", fontSize: 14 }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, margin: 0, letterSpacing: 2 }}>{paper.title}</h1>
      </div>
      {paper.subtitle && <div style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>{paper.subtitle}</div>}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginBottom: 12 }}>
        {subParts.join(' | ')}
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

        const perQScore = qs[0]?.score || 0;
        const totalTypeScore = qs.reduce((s, q) => s + (q.score || 0), 0);
        return (
          <div key={t} style={{ marginBottom: 16 }}>
            <h3 style={{ borderBottom: '2px solid #333', paddingBottom: 4, fontSize: 15 }}>
              {toLabelMap(qtypes)[t]}（每题{perQScore}分，共{qs.length}题，合计{totalTypeScore}分）
            </h3>
            {qs.map((q) => {
              globalIndex++;
              // 优先用后端规范化的options，兜底解析correct_answer
              let options: any[] = q.options || [];
              if (options.length === 0 && q.correct_answer) {
                try {
                  const parsed = JSON.parse(q.correct_answer);
                  options = Array.isArray(parsed?.options) ? parsed.options : [];
                } catch {}
              }

              let displayTitle = q.title || '';
              const isChoice = q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE';

              return (
                <div key={q.id} style={{ marginBottom: 8, pageBreakInside: 'avoid' as const }}>
                  <div style={{ lineHeight: 1.8 }}>
                    <strong>{globalIndex}. </strong>
                    {displayTitle}
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>（{q.score}分）</span>
                  </div>
                  {isChoice && options && options.length > 0 && (
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
{/* 填空题空白线已在题干中用 ________ 表示 */}
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
