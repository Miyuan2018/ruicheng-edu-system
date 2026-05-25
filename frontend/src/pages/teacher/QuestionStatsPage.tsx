import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Select, Tag, Progress, Space, Button } from 'antd';
import { QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toColorMap, toSelectOptions } from '../../hooks/useReferenceValues';

var Title = Typography.Title;


function ChoiceDistribution(props) {
  var dist = props.distribution;
  if (!dist) return null;
  var colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  return React.createElement('div', { style: { marginTop: 4 } },
    React.createElement(Typography.Text, { type: 'secondary', style: { fontSize: 11 } }, '选项分布: '),
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

export default function QuestionStatsPage() {
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var statsState = useState([]); var stats = statsState[0]; var setStats = statsState[1];
  var filterSubjectState = useState(''); var filterSubject = filterSubjectState[0]; var setFilterSubject = filterSubjectState[1];
  var filterTypeState = useState(''); var filterType = filterTypeState[0]; var setFilterType = filterTypeState[1];
  var refs = useReferenceValues();
  var qtypes = refs['question-types'];
  var diffs = refs['difficulty-levels'];
  var subjects = refs['subjects'];

  function loadStats() {
    setLoading(true);
    var params = {};
    if (filterSubject) params.subject = filterSubject;
    if (filterType) params.question_type = filterType;
    apiClient.get('/teacher/stats/questions', { params: params }).then(function (r) {
      setStats(r.data.questions || []);
    }).catch(function () { setStats([]); })
    .finally(function () { setLoading(false); });
  }

  useEffect(function () { loadStats(); }, [filterSubject, filterType]);

  var columns = [
    { title: '题目', dataIndex: 'title', ellipsis: true, width: 300, render: function (t, r) {
      return React.createElement(Space, null,
        React.createElement(Tag, { color: toColorMap(diffs)[r.difficulty]?.color }, toLabelMap(diffs)[r.difficulty] || r.difficulty),
        React.createElement(Tag, null, toLabelMap(qtypes)[r.question_type] || r.question_type),
        React.createElement(Typography.Text, null, (t || '').substring(0, 50))
      );
    }},
    { title: '作答次数', dataIndex: 'attempted', width: 80, align: 'center' },
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
    React.createElement(Title, { level: 4, style: { marginBottom: 16 } }, React.createElement(QuestionCircleOutlined, { style: { marginRight: 8 } }), '试题答题统计'),
    React.createElement(Card, { size: 'small', style: { marginBottom: 16 } },
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        React.createElement(Typography.Text, { strong: true }, '筛选: '),
        React.createElement(Select, { placeholder: '学科', value: filterSubject || undefined, onChange: setFilterSubject,
          allowClear: true, style: { width: 100 }, size: 'small',
          options: toSelectOptions(subjects)
        }),
        React.createElement(Select, { placeholder: '题型', value: filterType || undefined, onChange: setFilterType,
          allowClear: true, style: { width: 110 }, size: 'small',
          options: toSelectOptions(qtypes)
        }),
        React.createElement(Button, { size: 'small', icon: React.createElement(ReloadOutlined), onClick: loadStats }, '刷新')
      )
    ),
    React.createElement(Table, { rowKey: 'question_id', dataSource: stats, columns: columns,
      loading: loading, size: 'middle', scroll: { x: 900 }
    })
  );
}
