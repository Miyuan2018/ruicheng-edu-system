import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Select, Tag, Statistic, Row, Col, Spin, Empty, Progress, Space, Button } from 'antd';
import { FileTextOutlined, QuestionCircleOutlined, UserOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toColorMap } from '../../hooks/useReferenceValues';

var Title = Typography.Title;
var Text = Typography.Text;


function ChoiceDistribution(props) {
  var dist = props.distribution;
  if (!dist) return null;
  var colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  return React.createElement('div', { style: { marginTop: 4 } },
    React.createElement(Text, { type: 'secondary', style: { fontSize: 11 } }, '选项分布: '),
    ...dist.options.map(function (opt, i) {
      var count = dist.distribution[opt.label] || 0;
      var pct = dist.total_responses > 0 ? Math.round(count / dist.total_responses * 100) : 0;
      return React.createElement('span', { key: opt.label, style: { marginRight: 6, fontSize: 11 } },
        React.createElement(Tag, { color: colors[i % colors.length], style: { margin: 0 } },
          opt.label + ': ' + count + '(' + pct + '%)'
        )
      );
    })
  );
}

export default function PaperStatsPage() {
  var papersState = useState([]); var papers = papersState[0]; var setPapers = papersState[1];
  var selectedPaperState = useState(null); var selectedPaper = selectedPaperState[0]; var setSelectedPaper = selectedPaperState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var statsState = useState(null); var stats = statsState[0]; var setStats = statsState[1];
  var refs = useReferenceValues();
  var qtypes = refs['question-types'];
  var diffs = refs['difficulty-levels'];

  useEffect(function () {
    apiClient.get('/teacher/stats/papers').then(function (r) { setPapers(r.data || []); }).catch(function () {});
  }, []);

  function loadStats(paperId) {
    setLoading(true);
    apiClient.get('/teacher/stats/paper/' + paperId).then(function (r) {
      setStats(r.data);
    }).catch(function () { setStats(null); })
    .finally(function () { setLoading(false); });
  }

  function handleSelect(paperId) {
    setSelectedPaper(paperId);
    if (paperId) loadStats(paperId);
  }

  var columns = [
    { title: '#', dataIndex: 'position', width: 40 },
    { title: '题目', dataIndex: 'title', ellipsis: true, render: function (t, r) {
      return React.createElement(Space, null,
        React.createElement(Tag, { color: toColorMap(diffs)[r.difficulty]?.color }, toLabelMap(diffs)[r.difficulty] || r.difficulty),
        React.createElement(Tag, null, toLabelMap(qtypes)[r.question_type] || r.question_type),
        React.createElement(Text, null, (t || '').substring(0, 50))
      );
    }},
    { title: '分值', dataIndex: 'score', width: 50, align: 'center' },
    { title: '作答', dataIndex: 'attempted', width: 70, align: 'center',
      render: function (v, r) { return v + '/' + r.total_students; }
    },
    { title: '正确率', dataIndex: 'correct_rate', width: 200,
      render: function (v, r) {
        return React.createElement(Progress, { percent: v, size: 'small',
          format: function () { return v + '% (' + r.correct_count + '/' + r.attempted + ')'; },
          strokeColor: v >= 80 ? '#52c41a' : v >= 60 ? '#faad14' : '#f5222d'
        });
      }
    },
    { title: '选项分布', render: function (_, r) {
      return React.createElement(ChoiceDistribution, { distribution: r.choice_distribution });
    }},
  ];

  return React.createElement('div', null,
    React.createElement(Title, { level: 4, style: { marginBottom: 16 } }, React.createElement(FileTextOutlined, { style: { marginRight: 8 } }), '试卷答题统计'),
    React.createElement(Card, { size: 'small', style: { marginBottom: 16 } },
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        React.createElement(Text, { strong: true }, '选择试卷: '),
        React.createElement(Select, { placeholder: '请选择一份试卷查看每题统计', value: selectedPaper, onChange: handleSelect,
          style: { width: 400 }, showSearch: true, allowClear: true, size: 'small',
          filterOption: function (input, option) { return (option.label || '').indexOf(input) >= 0; },
          options: papers.map(function (p) { return { value: p.id, label: p.title + ' (' + (p.subject || '') + ' ' + (p.grade_level || '') + ')' }; }),
        }),
        React.createElement(Button, { size: 'small', icon: React.createElement(ReloadOutlined), onClick: function () { if (selectedPaper) loadStats(selectedPaper); } }, '刷新')
      )
    ),
    loading ? React.createElement(Spin, { style: { display: 'block', textAlign: 'center', padding: 40 } })
    : stats ? React.createElement('div', null,
        React.createElement(Row, { gutter: 16, style: { marginBottom: 16 } },
          React.createElement(Col, { span: 6 }, React.createElement(Card, null,
            React.createElement(Statistic, { title: '参与学生', value: stats.total_students || 0, prefix: React.createElement(UserOutlined) })
          )),
          React.createElement(Col, { span: 6 }, React.createElement(Card, null,
            React.createElement(Statistic, { title: '试题数', value: (stats.questions || []).length, prefix: React.createElement(QuestionCircleOutlined) })
          )),
          React.createElement(Col, { span: 12 }, React.createElement(Card, null,
            React.createElement(Statistic, { title: '试卷', value: stats.paper ? stats.paper.title : '', valueStyle: { fontSize: 15 } })
          ))
        ),
        (stats.questions || []).length > 0
          ? React.createElement(Table, { rowKey: 'question_id', dataSource: stats.questions, columns: columns,
              pagination: false, size: 'middle', scroll: { x: 900 }
            })
          : React.createElement(Empty, { description: '该试卷暂无答题记录' })
      )
    : React.createElement(Empty, { description: '请选择试卷查看统计' })
  );
}
