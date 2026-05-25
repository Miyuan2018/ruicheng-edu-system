import React, { useEffect, useState } from 'react';
import { Spin, Empty, Tag } from 'antd';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap } from '../../hooks/useReferenceValues';

var TYPE_ORDER = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SUBJECTIVE'];

export default function PrintPreviewPage() {
  var refs = useReferenceValues(); var qtypes = refs['question-types']; var diffs = refs['difficulty-levels'];
  var searchParams = new URLSearchParams(window.location.search);
  var paperId = searchParams.get('paperId');

  var paperState = useState(null); var paper = paperState[0]; var setPaper = paperState[1];
  var questionsState = useState([]); var questions = questionsState[0]; var setQuestions = questionsState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];

  useEffect(function () {
    if (!paperId) { setLoading(false); return; }
    apiClient.get('/exam-papers/' + paperId + '/questions')
      .then(function (resp) { setQuestions(resp.data || []); })
      .catch(function () { setQuestions([]); });
    apiClient.get('/exam-papers/' + paperId)
      .then(function (resp) { setPaper(resp.data); })
      .catch(function () { setPaper(null); })
      .finally(function () { setLoading(false); });
  }, [paperId]);

  // Auto-print when loaded
  useEffect(function () {
    if (!loading && paper) {
      setTimeout(function () { window.print(); }, 500);
    }
  }, [loading, paper]);

  if (loading) {
    return React.createElement('div', { style: { textAlign: 'center', padding: 60 } },
      React.createElement(Spin, { size: 'large' })
    );
  }

  if (!paper) {
    return React.createElement(Empty, { description: '加载失败，请从试卷列表重新打开' });
  }

  // Group questions by type
  var grouped = {};
  questions.forEach(function (q) {
    var t = q.question_type || 'SINGLE_CHOICE';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(q);
  });

  var globalIndex = 0;

  return React.createElement('div', { style: { maxWidth: 800, margin: '0 auto', fontFamily: 'SimSun, serif', fontSize: 14 } },
    // Title
    React.createElement('div', { style: { textAlign: 'center', marginBottom: 4 } },
      React.createElement('h1', { style: { fontSize: 22, margin: 0, letterSpacing: 2 } }, paper.title)
    ),
    paper.subtitle ? React.createElement('div', { style: { textAlign: 'center', fontSize: 12, color: '#666' } }, paper.subtitle) : null,
    React.createElement('div', { style: { textAlign: 'center', fontSize: 11, color: '#666', marginBottom: 12 } },
      (paper.subject || '') + ' | ' + (paper.grade_level || '') + ' | 总分: ' + (paper.total_score || 0) + '分 | 时长: ' + (paper.duration_minutes || 0) + '分钟'
    ),
    paper.description ? React.createElement('div', { style: { fontSize: 11, color: '#999', marginBottom: 8 } }, paper.description) : null,
    paper.instructions ? React.createElement('div', { style: { padding: '4px 8px', marginBottom: 12, border: '1px solid #d9d9d9', fontSize: 11, background: '#fafafa' } }, '注意事项：' + paper.instructions) : null,

    // Questions by type
    ...TYPE_ORDER.map(function (t) {
      var qs = grouped[t] || [];
      if (qs.length === 0) return null;

      var sectionScore = qs.reduce(function (s, q) { return s + (q.score || 0); }, 0);
      return React.createElement('div', { key: t, style: { marginBottom: 16 } },
        React.createElement('h3', { style: { borderBottom: '2px solid #333', paddingBottom: 4, fontSize: 15 } },
          toLabelMap(qtypes)[t] + '（共' + qs.length + '题，' + sectionScore + '分）'
        ),
        ...qs.map(function (q) {
          globalIndex++;
          var answerData = null;
          try { answerData = JSON.parse(q.correct_answer || '{}'); } catch (e) {}
          var options = answerData && answerData.options;
          var isChoice = q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE';

          return React.createElement('div', { key: q.id, style: { marginBottom: 8, pageBreakInside: 'avoid' } },
            React.createElement('div', { style: { lineHeight: 1.8 } },
              React.createElement('strong', null, globalIndex + '. '),
              (q.title || ''),
              React.createElement('span', { style: { marginLeft: 8, fontSize: 11, color: '#999' } }, '（' + q.score + '分）')
            ),
            isChoice && options ? React.createElement('div', { style: { marginLeft: 24, fontSize: 13 } },
              ...(options || []).map(function (opt) {
                return React.createElement('div', { key: opt.label }, opt.label + '. ' + (opt.text || ''));
              })
            ) : null,
            q.question_type === 'FILL_BLANK' ? React.createElement('div', { style: { marginLeft: 24, borderBottom: '1px solid #333', width: 200, height: 22 } }) : null,
            q.question_type === 'SUBJECTIVE' ? React.createElement('div', { style: { marginLeft: 24, border: '1px dashed #ccc', minHeight: 60, borderRadius: 4, marginTop: 4 } }) : null
          );
        })
      );
    }),
    React.createElement('div', { style: { textAlign: 'right', marginTop: 16, fontSize: 11, color: '#999' } }, '共 ' + questions.length + ' 道试题')
  );
}
