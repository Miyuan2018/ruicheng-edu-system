import React from 'react';
import { Tag, Button } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useReferenceValues, toLabelMap, toColorMap } from '../../hooks/useReferenceValues';

var TYPE_ORDER = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SUBJECTIVE'];

export default function PaperStructurePreview(props) {
  var questions = props.questions || [];
  var totalScore = props.totalScore || 100;
  var onReplace = props.onReplace;
  var readonly = props.readonly || false;
  var { 'question-types': qtypes, 'difficulty-levels': diffs } = useReferenceValues();

  var groups = {};
  TYPE_ORDER.forEach(function (t) { groups[t] = []; });
  questions.forEach(function (q) {
    var t = q.question_type || 'SINGLE_CHOICE';
    if (groups[t]) groups[t].push(q);
  });

  var globalIndex = 0;
  var sections = [];

  TYPE_ORDER.forEach(function (qtype) {
    var qs = groups[qtype] || [];
    if (qs.length === 0) return;

    var typeScore = qs.reduce(function (s, q) { return s + (q.score || 0); }, 0);
    var headerText = toLabelMap(qtypes)[qtype] + ' (' + qs.length + '道，共' + typeScore + '分)';

    var items = qs.map(function (q) {
      globalIndex++;
      var replaceBtn = null;
      if (!readonly && onReplace) {
        replaceBtn = React.createElement(Button, {
          size: 'small', type: 'link', icon: React.createElement(SwapOutlined),
          style: { fontSize: 11 },
          onClick: function () { onReplace(q, qtype); }
        }, '替换');
      }

      return React.createElement('div', {
        key: q.id,
        style: { padding: '8px 12px', marginBottom: 4, background: '#fafafa', borderRadius: 4, border: '1px solid #f0f0f0' }
      },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('span', { style: { flex: 1 } },
            React.createElement('strong', null, globalIndex + '. '),
            (q.title || '').substring(0, 80)
          ),
          React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 } },
            React.createElement(Tag, { color: toColorMap(diffs)[q.difficulty]?.color || 'default', style: { fontSize: 10 } }, toLabelMap(diffs)[q.difficulty] || q.difficulty),
            React.createElement('span', { style: { fontSize: 11, color: '#999' } }, q.score + '分'),
            replaceBtn
          )
        )
      );
    });

    sections.push(
      React.createElement('div', { key: qtype, style: { marginBottom: 20 } },
        React.createElement('div', { style: { fontWeight: 'bold', fontSize: 15, marginBottom: 8, padding: '4px 0', borderBottom: '2px solid #1890ff' } }, headerText),
        React.createElement('div', null, ...items)
      )
    );
  });

  var header = React.createElement('div', { style: { textAlign: 'center', marginBottom: 20, padding: '12px', background: '#f6ffed', borderRadius: 8 } },
    React.createElement('div', { style: { fontSize: 16, fontWeight: 'bold' } }, '试卷结构预览'),
    React.createElement('div', { style: { color: '#666', fontSize: 13, marginTop: 4 } },
      '共 ' + questions.length + ' 道试题，总分 ' + totalScore + ' 分'
    )
  );

  return React.createElement('div', { style: { padding: '0 8px' } }, header, ...sections);
}
