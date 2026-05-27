import { Tag, Button } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useReferenceValues, toLabelMap, toColorMap } from '../../hooks/useReferenceValues';

const TYPE_ORDER = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SUBJECTIVE'];

interface QuestionItem {
  id: string;
  title?: string;
  question_type?: string;
  difficulty?: string;
  score?: number;
}

interface PaperStructurePreviewProps {
  questions?: QuestionItem[];
  totalScore?: number;
  onReplace?: (q: QuestionItem, qtype: string) => void;
  readonly?: boolean;
}

export default function PaperStructurePreview({ questions = [], totalScore = 100, onReplace, readonly = false }: PaperStructurePreviewProps) {
  const { 'question-types': qtypes, 'difficulty-levels': diffs } = useReferenceValues();

  const groups: Record<string, QuestionItem[]> = {};
  TYPE_ORDER.forEach((t) => { groups[t] = []; });
  questions.forEach((q) => {
    const t = q.question_type || 'SINGLE_CHOICE';
    if (groups[t]) groups[t].push(q);
  });

  let globalIndex = 0;
  const sections: React.ReactNode[] = [];

  TYPE_ORDER.forEach((qtype) => {
    const qs = groups[qtype] || [];
    if (qs.length === 0) return;

    const typeScore = qs.reduce((s, q) => s + (q.score || 0), 0);
    const headerText = toLabelMap(qtypes)[qtype] + ' (' + qs.length + '道，共' + typeScore + '分)';

    const items = qs.map((q) => {
      globalIndex++;
      const replaceBtn = !readonly && onReplace ? (
        <Button size="small" type="link" icon={<SwapOutlined />} style={{ fontSize: 11 }} onClick={() => onReplace(q, qtype)}>
          替换
        </Button>
      ) : null;

      return (
        <div key={q.id} style={{ padding: '8px 12px', marginBottom: 4, background: '#fafafa', borderRadius: 4, border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ flex: 1 }}>
              <strong>{globalIndex}. </strong>
              {(q.title || '').substring(0, 80)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Tag color={toColorMap(diffs)[q.difficulty || '']?.color || 'default'} style={{ fontSize: 10 }}>
                {toLabelMap(diffs)[q.difficulty || ''] || q.difficulty}
              </Tag>
              <span style={{ fontSize: 11, color: '#999' }}>{q.score}分</span>
              {replaceBtn}
            </span>
          </div>
        </div>
      );
    });

    sections.push(
      <div key={qtype} style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #1890ff' }}>
          {headerText}
        </div>
        <div>{items}</div>
      </div>
    );
  });

  const header = (
    <div style={{ textAlign: 'center', marginBottom: 20, padding: '12px', background: '#f6ffed', borderRadius: 8 }}>
      <div style={{ fontSize: 16, fontWeight: 'bold' }}>试卷结构预览</div>
      <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
        共 {questions.length} 道试题，总分 {totalScore} 分
      </div>
    </div>
  );

  return <div style={{ padding: '0 8px' }}>{header}{sections}</div>;
}
