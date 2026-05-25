import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Input, Typography, Space, Tag, Select, Card } from 'antd';
import { ReloadOutlined, SearchOutlined, BulbOutlined } from '@ant-design/icons';
import apiClient from '../api/client';
import { useReferenceValues, toLabelMap, toSelectOptions } from '../hooks/useReferenceValues';

var Title = Typography.Title;
var Text = Typography.Text;

export default function TypicalQuestionsPage() {
  var questionsState = useState([]); var questions = questionsState[0]; var setQuestions = questionsState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var filterSubjectState = useState(undefined); var filterSubject = filterSubjectState[0]; var setFilterSubject = filterSubjectState[1];
  var filterGradeState = useState(undefined); var filterGrade = filterGradeState[0]; var setFilterGrade = filterGradeState[1];
  var refs = useReferenceValues();
  var qtypes = refs['question-types'];
  var diffs = refs['difficulty-levels'];
  var grades = refs['grade-levels'];
  var subjects = refs['subjects'];
  var typeMap = useMemo(function () { return toLabelMap(qtypes); }, [qtypes]);
  var diffMap = useMemo(function () { return toLabelMap(diffs); }, [diffs]);

  var loadQuestions = useCallback(async function () {
    setLoading(true);
    try {
      var params = {};
      if (filterSubject) params.subject = filterSubject;
      if (filterGrade) params.grade = filterGrade;
      var resp = await apiClient.get('/questions/typical', { params: params });
      setQuestions(Array.isArray(resp.data) ? resp.data : []);
    } catch (e) { setQuestions([]); }
    finally { setLoading(false); }
  }, [filterSubject, filterGrade]);

  useEffect(function () { loadQuestions(); }, [loadQuestions]);

  function parseOptions(v) {
    if (!v) return null;
    try { var p = typeof v === 'string' ? JSON.parse(v) : v; return p.options; } catch (e) { return null; }
  }
  function parseAnswer(v) {
    if (!v) return null;
    try {
      var p = typeof v === 'string' ? JSON.parse(v) : v;
      if (p.correct_answer === undefined) return null;
      var a = p.correct_answer;
      if (Array.isArray(a)) return a.join(', ');
      if (typeof a === 'object' && a !== null) return a.keywords ? a.keywords.join(', ') : null;
      return String(a);
    } catch (e) { return null; }
  }

  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 16 } },
      React.createElement(Title, { level: 4, style: { margin: 0 } }, React.createElement(BulbOutlined, { style: { marginRight: 8 } }), '试题讲解'),
      React.createElement(Space, null,
        React.createElement(Select, { placeholder: '学科', value: filterSubject, onChange: setFilterSubject,
          allowClear: true, style: { width: 100 }, size: 'small', options: toSelectOptions(subjects)
        }),
        React.createElement(Select, { placeholder: '年级', value: filterGrade, onChange: setFilterGrade,
          allowClear: true, style: { width: 100 }, size: 'small', options: toSelectOptions(grades)
        }),
        React.createElement(Button, { size: 'small', icon: React.createElement(ReloadOutlined), onClick: loadQuestions }, '刷新')
      )
    ),
    React.createElement(Table, { rowKey: 'id', loading: loading, dataSource: questions, size: 'middle',
      pagination: { pageSize: 15, showSizeChanger: false, showTotal: function (t) { return '共 ' + t + ' 题'; } },
      columns: [
        { title: '题目', dataIndex: 'title', ellipsis: true, width: 250 },
        { title: '题型', dataIndex: 'question_type', width: 70, render: function (t) { return React.createElement(Tag, null, typeMap[t] || t); } },
        { title: '难度', dataIndex: 'difficulty', width: 60, render: function (t) { return React.createElement(Tag, { color: t === 'EASY' ? 'green' : t === 'MEDIUM' ? 'gold' : 'red' }, diffMap[t] || t); } },
        { title: '选项', dataIndex: 'correct_answer', width: 150, render: function (v) {
          var opts = parseOptions(v);
          if (!opts || !Array.isArray(opts)) return React.createElement(Text, { type: 'secondary' }, '-');
          return React.createElement('span', { style: { fontSize: 12 } }, opts.map(function (o) { return (o.label || '') + '. ' + (o.text || o); }).join('  '));
        }},
        { title: '正确答案', dataIndex: 'correct_answer', width: 80, render: function (v) {
          var a = parseAnswer(v);
          return a ? React.createElement(Tag, { color: 'green' }, a) : React.createElement(Text, { type: 'secondary' }, '-');
        }},
        { title: '解题思路', dataIndex: 'explanation', ellipsis: true, width: 200, render: function (v) { return v || '-'; } },
      ],
      expandable: {
        expandedRowRender: function (r) {
          return React.createElement('div', { style: { padding: '8px 16px' } },
            React.createElement(Text, { strong: true }, '解题思路：'),
            React.createElement('div', { style: { marginTop: 4, whiteSpace: 'pre-wrap' } }, r.explanation || '暂无')
          );
        },
        rowExpandable: function (r) { return !!(r.explanation); },
      }
    })
  );
}
