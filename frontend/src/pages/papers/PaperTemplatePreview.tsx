import { Tag, Button } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useReferenceValues, toLabelMap, toColorMap } from '../../hooks/useReferenceValues';


// Sections define the paper structure order
const DEFAULT_SECTIONS = [
  { type: 'FILL_BLANK', label: '一、填空题' },
  { type: 'SINGLE_CHOICE', label: '二、单选题' },
  { type: 'MULTIPLE_CHOICE', label: '三、多选题' },
  { type: 'SUBJECTIVE', label: '四、解答题' },
];

interface PaperTemplatePreviewProps {
  title?: string;
  subtitle?: string;
  notes?: string;
  sections?: any[];
  questions?: any[];
  onReplace?: (q: any, sectionType: string) => void;
  readonly?: boolean;
}

export default function PaperTemplatePreview(props: PaperTemplatePreviewProps) {
  const title = props.title || '试卷预览';
  const subtitle = props.subtitle || '';
  const notes = props.notes || '';
  const sections = props.sections || DEFAULT_SECTIONS;
  const questions = props.questions || [];
  const onReplace = props.onReplace;
  const readonly = props.readonly !== false;
  const { 'difficulty-levels': diffs } = useReferenceValues();

  // Group questions into sections by type
  const sectionQuestions: Record<string, any[]> = {};
  sections.forEach(function (s: any) { sectionQuestions[s.type] = []; });
  questions.forEach(function (q: any) {
    const t = q.question_type || 'SINGLE_CHOICE';
    if (!sectionQuestions[t]) sectionQuestions[t] = [];
    sectionQuestions[t].push(q);
  });

  let globalIndex = 0;

  // Title block
  const titleBlock = (
    <div style={{ textAlign: 'center', marginBottom: 8 }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: 2 }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  );

  // Notes block
  const notesBlock = notes ? (
    <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fffbe6', borderRadius: 4, fontSize: 12, color: '#666', border: '1px solid #ffe58f' }}>
      {notes}
    </div>
  ) : null;

  // Section blocks
  const sectionBlocks: any[] = [];
  sections.forEach(function (section: any) {
    const qs = sectionQuestions[section.type] || [];
    if (qs.length === 0 && readonly) return; // Skip empty sections in readonly mode

    const sectionScore = qs.reduce(function (s: number, q: any) { return s + (q.score || 0); }, 0);
    const sectionHeader = section.label + '（' + (section.description || (qs.length + '题，共' + sectionScore + '分')) + '）';

    let items: any[] = qs.map(function (q: any) {
      globalIndex++;
      let replaceBtn = null;
      if (!readonly && onReplace) {
        replaceBtn = (
          <Button size="small" type="link" icon={<SwapOutlined />}
            style={{ fontSize: 11 }} onClick={function () { onReplace(q, section.type); }}>
            替换
          </Button>
        );
      }

      let answerData = null;
      try { answerData = JSON.parse(q.correct_answer || '{}'); } catch {}
      const options = answerData && answerData.options;
      const isChoice = q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE';
      const isBlank = q.question_type === 'FILL_BLANK';

      let optionRows = null;
      if (isChoice && options && options.length > 0) {
        optionRows = (
          <div style={{ marginTop: 4, marginLeft: 20, fontSize: 13 }}>
            {options.map(function (opt: any) {
              return (
                <div key={opt.label} style={{ marginBottom: 2 }}>
                  {opt.label + '. ' + (opt.text || '')}
                </div>
              );
            })}
          </div>
        );
      }

      let blankLine = null;
      if (isBlank) {
        blankLine = <div style={{ marginTop: 4, marginLeft: 20, borderBottom: '1px solid #333', width: 200, height: 22 }} />;
      }

      let subjLine = null;
      if (q.question_type === 'SUBJECTIVE') {
        subjLine = <div style={{ marginTop: 4, marginLeft: 20, border: '1px dashed #ccc', minHeight: 60, borderRadius: 4 }} />;
      }

      return (
        <div key={q.id} style={{ padding: '8px 0', borderBottom: '1px dashed #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ flex: 1, lineHeight: 1.8 }}>
              <strong>{globalIndex + '. '}</strong>
              {(q.title || '').substring(0, 120)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 }}>
              <Tag color={toColorMap(diffs)[q.difficulty]?.color || 'default'} style={{ fontSize: 10 }}>
                {toLabelMap(diffs)[q.difficulty] || q.difficulty}
              </Tag>
              <span style={{ fontSize: 11, color: '#999' }}>{q.score + '分'}</span>
              {replaceBtn}
            </span>
          </div>
          {optionRows}
          {blankLine}
          {subjLine}
        </div>
      );
    });

    // Show placeholder for empty sections in edit mode
    if (qs.length === 0 && !readonly) {
      items = [<div key="empty" style={{ padding: 16, textAlign: 'center', color: '#ccc', fontSize: 13 }}>
        {'待选题（' + (section.count || 0) + '道）'}
      </div>];
    }

    sectionBlocks.push(
      <div key={section.type} style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #333' }}>{sectionHeader}</div>
        <div>{items}</div>
      </div>
    );
  });

  return (
    <div style={{ padding: '16px 24px', background: '#fff', maxWidth: 800, margin: '0 auto', fontFamily: 'SimSun, serif' }}>
      {titleBlock}
      {notesBlock}
      {sectionBlocks}
      <div style={{ textAlign: 'right', marginTop: 16, color: '#999', fontSize: 12 }}>
        {'共 ' + questions.length + ' 道试题'}
      </div>
    </div>
  );
}
