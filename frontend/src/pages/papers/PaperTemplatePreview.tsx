import React from 'react';
import { Tag, Button } from 'antd';
import { SwapOutlined } from '@ant-design/icons';

var TYPE_LABELS = { FILL_BLANK: '填空题', SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', SUBJECTIVE: '解答题' };
var DIFF_COLORS = { EASY: 'green', MEDIUM: 'orange', HARD: 'red' };
var DIFF_NAMES = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };

// Sections define the paper structure order
var DEFAULT_SECTIONS = [
  { type: 'FILL_BLANK', label: '一、填空题' },
  { type: 'SINGLE_CHOICE', label: '二、单选题' },
  { type: 'MULTIPLE_CHOICE', label: '三、多选题' },
  { type: 'SUBJECTIVE', label: '四、解答题' },
];

export default function PaperTemplatePreview(props) {
  var title = props.title || '试卷预览';
  var subtitle = props.subtitle || '';
  var notes = props.notes || '';
  var sections = props.sections || DEFAULT_SECTIONS;
  var questions = props.questions || [];
  var onReplace = props.onReplace;
  var readonly = props.readonly !== false;

  // Group questions into sections by type
  var sectionQuestions = {};
  sections.forEach(function (s) { sectionQuestions[s.type] = []; });
  questions.forEach(function (q) {
    var t = q.question_type || 'SINGLE_CHOICE';
    if (!sectionQuestions[t]) sectionQuestions[t] = [];
    sectionQuestions[t].push(q);
  });

  var globalIndex = 0;

  // Title block
  var titleBlock = React.createElement('div', { style: { textAlign: 'center', marginBottom: 8 } },
    React.createElement('div', { style: { fontSize: 20, fontWeight: 'bold', letterSpacing: 2 } }, title),
    subtitle ? React.createElement('div', { style: { fontSize: 13, color: '#666', marginTop: 4 } }, subtitle) : null
  );

  // Notes block
  var notesBlock = notes ? React.createElement('div', {
    style: { marginBottom: 16, padding: '8px 12px', background: '#fffbe6', borderRadius: 4, fontSize: 12, color: '#666', border: '1px solid #ffe58f' }
  }, notes) : null;

  // Section blocks
  var sectionBlocks = [];
  sections.forEach(function (section) {
    var qs = sectionQuestions[section.type] || [];
    if (qs.length === 0 && readonly) return; // Skip empty sections in readonly mode

    var sectionScore = qs.reduce(function (s, q) { return s + (q.score || 0); }, 0);
    var sectionHeader = section.label + '（' + (section.description || (qs.length + '题，共' + sectionScore + '分')) + '）';

    var items = qs.map(function (q) {
      globalIndex++;
      var replaceBtn = null;
      if (!readonly && onReplace) {
        replaceBtn = React.createElement(Button, { size: 'small', type: 'link', icon: React.createElement(SwapOutlined),
          style: { fontSize: 11 }, onClick: function () { onReplace(q, section.type); } }, '替换');
      }

      var answerData = null;
      try { answerData = JSON.parse(q.correct_answer || '{}'); } catch(e) {}
      var options = answerData && answerData.options;
      var isChoice = q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE';
      var isBlank = q.question_type === 'FILL_BLANK';

      var optionRows = null;
      if (isChoice && options && options.length > 0) {
        optionRows = React.createElement('div', { style: { marginTop: 4, marginLeft: 20, fontSize: 13 } },
          ...options.map(function (opt) {
            return React.createElement('div', { key: opt.label, style: { marginBottom: 2 } },
              opt.label + '. ' + (opt.text || '')
            );
          })
        );
      }

      var blankLine = null;
      if (isBlank) {
        blankLine = React.createElement('div', { style: { marginTop: 4, marginLeft: 20, borderBottom: '1px solid #333', width: 200, height: 22 } });
      }

      var subjLine = null;
      if (q.question_type === 'SUBJECTIVE') {
        subjLine = React.createElement('div', { style: { marginTop: 4, marginLeft: 20, border: '1px dashed #ccc', minHeight: 60, borderRadius: 4 } });
      }

      return React.createElement('div', { key: q.id, style: { padding: '8px 0', borderBottom: '1px dashed #f0f0f0' } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('span', { style: { flex: 1, lineHeight: 1.8 } },
            React.createElement('strong', null, globalIndex + '. '),
            (q.title || '').substring(0, 120)
          ),
          React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 } },
            React.createElement(Tag, { color: DIFF_COLORS[q.difficulty] || 'default', style: { fontSize: 10 } }, DIFF_NAMES[q.difficulty] || q.difficulty),
            React.createElement('span', { style: { fontSize: 11, color: '#999' } }, q.score + '分'),
            replaceBtn
          )
        ),
        optionRows,
        blankLine,
        subjLine
      );
    });

    // Show placeholder for empty sections in edit mode
    if (qs.length === 0 && !readonly) {
      items = [React.createElement('div', { key: 'empty', style: { padding: 16, textAlign: 'center', color: '#ccc', fontSize: 13 } },
        '待选题（' + (section.count || 0) + '道）')];
    }

    sectionBlocks.push(
      React.createElement('div', { key: section.type, style: { marginBottom: 20 } },
        React.createElement('div', { style: { fontWeight: 'bold', fontSize: 15, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #333' } }, sectionHeader),
        React.createElement('div', null, ...items)
      )
    );
  });

  return React.createElement('div', { style: { padding: '16px 24px', background: '#fff', maxWidth: 800, margin: '0 auto', fontFamily: 'SimSun, serif' } },
    titleBlock,
    notesBlock,
    ...sectionBlocks,
    React.createElement('div', { style: { textAlign: 'right', marginTop: 16, color: '#999', fontSize: 12 } },
      '共 ' + questions.length + ' 道试题'
    )
  );
}
