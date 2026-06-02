import { Tag, Button } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useReferenceValues, toLabelMap, toColorMap } from '../../hooks/useReferenceValues';
import type { ExamPaperUnit } from '../../types/paper';

interface PaperTemplatePreviewProps {
  title?: string;
  subtitle?: string;
  instructions?: string;
  units?: ExamPaperUnit[];
  // Backward compat
  sections?: any[];
  questions?: any[];
  onReplace?: (q: any, sectionTypeOrUnitId: string) => void;
  readonly?: boolean;
}

export default function PaperTemplatePreview(props: PaperTemplatePreviewProps) {
  const title = props.title || '试卷预览';
  const subtitle = props.subtitle || '';
  const instructions = props.instructions || '';
  const readonly = props.readonly !== false;
  const { 'difficulty-levels': diffs } = useReferenceValues();
  const diffLabels = toLabelMap(diffs);
  const diffColors = toColorMap(diffs);

  // Prefer unit structure; fall back to legacy sections
  const units = props.units;

  // Title block
  const titleBlock = (
    <div style={{ textAlign: 'center', marginBottom: 8 }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: 2 }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  );

  // Instructions block
  const notesBlock = instructions ? (
    <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fffbe6', borderRadius: 4, fontSize: 12, color: '#666', border: '1px solid #ffe58f' }}>
      {instructions}
    </div>
  ) : null;

  // Render a question row
  const renderQuestion = (q: any, globalIndex: number, onReplace: ((q: any, id: string) => void) | undefined, contextId: string) => {
    const question = q.question || {};
    const rawTitle = question.title || q.title || '';
    const difficulty = question.difficulty || q.difficulty || '';
    const score = q.score || 0;
    const isChoice = q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE';
    const isSubjective = q.question_type === 'SUBJECTIVE';

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

    let qTitle = rawTitle;
    if (options.length > 0) {
      const optMatch = rawTitle.match(/\s*A[.．、）\)]\s/);
      if (optMatch && optMatch.index !== undefined && optMatch.index > 0) {
        qTitle = rawTitle.substring(0, optMatch.index).replace(/[（(]\s*[）)]\s*$/, '').trim();
      }
    }

    let replaceBtn = null;
    if (!readonly && onReplace) {
      replaceBtn = (
        <Button size="small" type="link" icon={<SwapOutlined />}
          style={{ fontSize: 11 }} onClick={() => onReplace(q, contextId)}>
          替换
        </Button>
      );
    }

    let optionRows = null;
    if (isChoice && options.length > 0) {
      optionRows = (
        <div style={{ marginTop: 4, marginLeft: 24, fontSize: 13 }}>
          {options.map((opt: any, idx: number) => {
            const label = opt.label || opt.id || String.fromCharCode(65 + idx);
            const text = opt.text || opt.content || '';
            return <div key={label} style={{ marginBottom: 2 }}>{label + '. ' + text}</div>;
          })}
        </div>
      );
    }

    let subjLine = null;
    if (isSubjective) {
      subjLine = <div style={{ marginTop: 4, marginLeft: 20, border: '1px dashed #ccc', minHeight: 60, borderRadius: 4 }} />;
    }

    return (
      <div key={q.question_id || q.id || globalIndex} style={{ padding: '8px 0', borderBottom: '1px dashed #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ flex: 1, lineHeight: 1.8 }}>
            <strong>{globalIndex + '. '}</strong>
            {qTitle.substring(0, 120)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 }}>
            <Tag color={diffColors[difficulty]?.color || 'default'} style={{ fontSize: 10 }}>
              {diffLabels[difficulty] || difficulty}
            </Tag>
            <span style={{ fontSize: 11, color: '#999' }}>{score + '分'}</span>
            {replaceBtn}
          </span>
        </div>
        {optionRows}
        {subjLine}
      </div>
    );
  };

  // --- Rendering: follow show_units or fallback to type grouping ---
  if (units && units.length > 0) {
    // Check if we have show_units in the first unit (passed through from paper)
    const showUnits = (props as any).show_units ?? false;
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

    const TYPE_ORDER = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SUBJECTIVE'];
    const qtypeLabels: Record<string, string> = {
      SINGLE_CHOICE: '单选题',
      MULTIPLE_CHOICE: '多选题',
      FILL_BLANK: '填空题',
      SUBJECTIVE: '解答题',
    };
    const numLabels = ['一', '二', '三', '四', '五', '六', '七', '八'];

    let globalIndex = 0;
    let sectionIndex = 0;

    // Render based on mode
    const renderContent = () => {
      if (showUnits) {
        // 按单元 → 单元内按题型
        return units.map((unit) => {
          const uqs = unit.questions || [];
          if (uqs.length === 0) return null;
          const uScore = uqs.reduce((s, q) => s + (q.score || 0), 0);
          const uGrouped: Record<string, any[]> = {};
          uqs.forEach((q) => {
            const qt = q.question_type || 'SINGLE_CHOICE';
            if (!uGrouped[qt]) uGrouped[qt] = [];
            uGrouped[qt].push(q);
          });
          return (
            <div key={unit.id} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #333' }}>
                {unit.name || '未命名'}
                <span style={{ fontWeight: 'normal', fontSize: 12, color: '#999', marginLeft: 8 }}>
                  （共{uqs.length}题、{uScore}分）
                </span>
              </div>
              {TYPE_ORDER.map((qt) => {
                const qs = uGrouped[qt];
                if (!qs || qs.length === 0) return null;
                const typeScore = qs.reduce((s, q) => s + (q.score || 0), 0);
                const label = qtypeLabels[qt] || qt;
                const numLabel = numLabels[sectionIndex] || String(sectionIndex + 1);
                sectionIndex++;
                return (
                  <div key={qt} style={{ marginBottom: 16, paddingLeft: 8 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>
                      {numLabel + '、' + label + '（每题' + (qs[0]?.score || 0) + '分，共' + qs.length + '题，合计' + typeScore + '分）'}
                    </div>
                    {qs.map((q) => {
                      globalIndex++;
                      return renderQuestion(q, globalIndex, props.onReplace, unit.id || unit.name || qt);
                    })}
                  </div>
                );
              })}
            </div>
          );
        });
      }

      // 按题型
      return TYPE_ORDER.map((qt) => {
        const qs = grouped[qt];
        if (!qs || qs.length === 0) return null;
        const typeScore = qs.reduce((s, q) => s + (q.score || 0), 0);
        const label = qtypeLabels[qt] || qt;
        const numLabel = numLabels[sectionIndex] || String(sectionIndex + 1);
        sectionIndex++;
        return (
          <div key={qt} style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #333' }}>
              {numLabel + '、' + label + '（每题' + (qs[0]?.score || 0) + '分，共' + qs.length + '题，合计' + typeScore + '分）'}
            </div>
            {qs.map((q) => {
              globalIndex++;
              const unit = units.find(u => (u.questions || []).some(uq => uq.question_id === q.question_id));
              return renderQuestion(q, globalIndex, props.onReplace, unit?.id || unit?.name || qt);
            })}
          </div>
        );
      }).filter(Boolean);
    };

    const unitContent = [renderContent()];

    const totalQs = units.reduce((s, u) => s + (u.questions?.length || 0), 0);

    return (
      <div style={{ padding: '16px 24px', background: '#fff', maxWidth: 800, margin: '0 auto', fontFamily: "'Times New Roman', 'Noto Serif CJK SC', serif" }}>
        {titleBlock}
        {notesBlock}
        {unitContent}
        <div style={{ textAlign: 'right', marginTop: 16, color: '#999', fontSize: 12 }}>
          {'共 ' + totalQs + ' 道试题'}
        </div>
      </div>
    );
  }

  // 无单元数据时返回空
  return (
    <div style={{ padding: '16px 24px', background: '#fff', maxWidth: 800, margin: '0 auto', fontFamily: "'Times New Roman', 'Noto Serif CJK SC', serif" }}>
      {titleBlock}
      {notesBlock}
      <div style={{ padding: 40, textAlign: 'center', color: '#ccc', fontSize: 13 }}>暂无试卷内容</div>
    </div>
  );
}
