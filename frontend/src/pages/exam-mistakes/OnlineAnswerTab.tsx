import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Input, Select, Space, Tag, Typography, Radio, message, Progress, Empty, Row, Col, Tooltip, Popconfirm } from 'antd';
import { SearchOutlined, PlayCircleOutlined, EyeOutlined, DeleteOutlined, CheckCircleOutlined, ArrowUpOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import PaperPreviewDrawer from '../papers/PaperPreviewDrawer';
import { useReferenceValues, toLabelMap } from '../../hooks/useReferenceValues';

var Title = Typography.Title;
var Text = Typography.Text;
var SUBJECT_OPTIONS = [
  { value: '数学', label: '数学' }, { value: '语文', label: '语文' }, { value: '英语', label: '英语' },
  { value: '物理', label: '物理' }, { value: '化学', label: '化学' },
];

export default function OnlineAnswerTab() {
  var allPapersState = useState([]); var allPapers = allPapersState[0]; var setAllPapers = allPapersState[1];
  var pendingPapersState = useState([]); var pendingPapers = pendingPapersState[0]; var setPendingPapers = pendingPapersState[1];
  var pendingFilterState = useState(''); var pendingFilter = pendingFilterState[0]; var setPendingFilter = pendingFilterState[1];
  var pendingSubjState = useState(''); var pendingSubj = pendingSubjState[0]; var setPendingSubj = pendingSubjState[1];
  var allFilterState = useState(''); var allFilter = allFilterState[0]; var setAllFilter = allFilterState[1];
  var allSubjFilterState = useState(''); var allSubjFilter = allSubjFilterState[0]; var setAllSubjFilter = allSubjFilterState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];
  var selectedRowKeysState = useState([]); var selectedRowKeys = selectedRowKeysState[0]; var setSelectedRowKeys = selectedRowKeysState[1];

  // Answering flow
  var answeringState = useState(null); var answeringPaper = answeringState[0]; var setAnsweringPaper = answeringState[1];
  var questionsState = useState([]); var questions = questionsState[0]; var setQuestions = questionsState[1];
  var answersState = useState({}); var answers = answersState[0]; var setAnswers = answersState[1];
  var resultState = useState(null); var result = resultState[0]; var setResult = resultState[1];
  var submittingState = useState(false); var submitting = submittingState[0]; var setSubmitting = submittingState[1];
  var previewOpenState = useState(false); var previewOpen = previewOpenState[0]; var setPreviewOpen = previewOpenState[1];
  var previewIdState = useState(null); var previewId = previewIdState[0]; var setPreviewId = previewIdState[1];
  var userId = localStorage.getItem('user_id') || '';
  var userType = localStorage.getItem('user_type') || 'STUDENT';
  var { 'question-types': qtypes } = useReferenceValues();

  useEffect(function () { loadData(); }, []);

  function loadData() {
    setLoading(true);
    Promise.all([
      apiClient.get('/exam-papers', { params: { status: 'PUBLISHED', limit: 100 } }).catch(function () { return { data: [] }; }),
      apiClient.get('/answers/student/' + userId).catch(function () { return { data: [] }; }),
    ]).then(function (results) {
      var papers = results[0].data || [];
      setAllPapers(Array.isArray(papers) ? papers : []);
      var submissions = results[1].data || [];
      var submittedIds = {};
      (Array.isArray(submissions) ? submissions : []).forEach(function (s) { submittedIds[s.exam_paper_id] = true; });
      setPendingPapers(papers.filter(function (p) { return !submittedIds[p.id]; }));
    }).finally(function () { setLoading(false); });
  }

  function startAnswering(paper) {
    setAnsweringPaper(paper);
    setAnswers({});
    setResult(null);
    apiClient.get('/exam-papers/' + paper.id + '/questions').then(function (resp) {
      setQuestions(Array.isArray(resp.data) ? resp.data : []);
    }).catch(function () { message.error('加载试题失败'); });
  }

  async function handleSubmit() {
    var qs = questions;
    var unanswered = qs.filter(function (q) { return !answers[q.id]; });
    if (unanswered.length > 0) { message.warning('还有 ' + unanswered.length + ' 题未作答'); return; }
    setSubmitting(true);
    try {
      var answerList = qs.map(function (q) { return { question_id: q.id, student_answer: answers[q.id] || '' }; });
      var resp = await apiClient.post('/answers', {
        exam_paper_id: answeringPaper.id, submission_type: 'ONLINE', answers: answerList,
      });
      var subId = resp.data.id;
      var resultResp = await apiClient.get('/answers/' + subId);
      setResult(resultResp.data);
      message.success('提交成功！得分: ' + (resultResp.data.total_score || 0));
    } catch (e) {
      var detail = '提交失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
    setSubmitting(false);
  }

  function moveToPending(paperIds) {
    var ids = Array.isArray(paperIds) ? paperIds : [paperIds];
    var toAdd = allPapers.filter(function (p) { return ids.indexOf(p.id) >= 0 && !pendingPapers.find(function (pp) { return pp.id === p.id; }); });
    if (toAdd.length > 0) {
      setPendingPapers(pendingPapers.concat(toAdd));
      message.success('已加入 ' + toAdd.length + ' 份试卷到待作答区');
    }
    setSelectedRowKeys([]);
  }

  function removeFromPending(paperId) {
    setPendingPapers(pendingPapers.filter(function (p) { return p.id !== paperId; }));
  }

  function handlePreview(paperId) { setPreviewId(paperId); setPreviewOpen(true); }

  async function handleDeletePaper(paperId) {
    try {
      await apiClient.delete('/exam-papers/' + paperId);
      message.success('试卷已删除');
      setAllPapers(allPapers.filter(function (p) { return p.id !== paperId; }));
      setPendingPapers(pendingPapers.filter(function (p) { return p.id !== paperId; }));
    } catch (e) {
      message.error('删除失败');
    }
  }

  function goBack() { setAnsweringPaper(null); setResult(null); setQuestions([]); loadData(); }

  function filterPapers(list, title, subject) {
    return list.filter(function (p) {
      if (title && (p.title || '').indexOf(title) < 0) return false;
      if (subject && p.subject !== subject) return false;
      return true;
    });
  }

  var paperColumns = [
    { title: '试卷名称', dataIndex: 'title', ellipsis: true },
    { title: '学科', dataIndex: 'subject', width: 60 },
    { title: '年级', dataIndex: 'grade_level', width: 70 },
    { title: '总分', dataIndex: 'total_score', width: 60, align: 'center' },
    { title: '时长', dataIndex: 'duration_minutes', width: 70, align: 'center', render: function (v) { return v ? v + '分钟' : '-'; } },
  ];

  var pendingColumns = paperColumns.concat([
    { title: '操作', width: 120, render: function (_, r) {
      return React.createElement(Space, { size: 4 },
        React.createElement(Button, { type: 'primary', size: 'small', icon: React.createElement(PlayCircleOutlined),
          onClick: function () { startAnswering(r); } }, '开始答题'),
        React.createElement(Button, { type: 'text', size: 'small', danger: true,
          onClick: function () { removeFromPending(r.id); } }, '移除')
      );
    }},
  ]);

  var allColumns = paperColumns.concat([
    { title: '状态', dataIndex: 'status', width: 70, render: function () {
      return React.createElement(Tag, { color: 'green' }, '可作答');
    }},
    { title: '操作', width: userType !== 'STUDENT' ? 130 : 70, render: function (_, r) {
      return React.createElement(Space, { size: 2 },
        React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(EyeOutlined),
          onClick: function () { handlePreview(r.id); } }, '预览'),
        userType !== 'STUDENT' ? React.createElement(Popconfirm, { title: '确定删除该试卷？', onConfirm: function () { handleDeletePaper(r.id); } },
          React.createElement(Button, { type: 'link', size: 'small', danger: true, icon: React.createElement(DeleteOutlined) }, '删除')
        ) : null
      );
    }},
  ]);

  var pendingFiltered = filterPapers(pendingPapers, pendingFilter, pendingSubj);
  var allFiltered = filterPapers(allPapers, allFilter, allSubjFilter);

  // Answering UI
  if (answeringPaper) {
    if (result) {
      var correctDetails = (result.answers || []).filter(function (d) { return d.is_correct; });
      var wrongDetails = (result.answers || []).filter(function (d) { return !d.is_correct; });
      return React.createElement('div', null,
        React.createElement(Button, { onClick: goBack, style: { marginBottom: 12 } }, '← 返回试卷列表'),
        React.createElement(Card, { style: { marginBottom: 16, textAlign: 'center' } },
          React.createElement(Title, { level: 5 }, answeringPaper.title + ' — 答题结果'),
          React.createElement(Progress, { type: 'circle', size: 100, percent: result.percentage || 0, format: function () { return (result.total_score || 0) + '分'; } }),
          React.createElement('div', { style: { marginTop: 12 } },
            React.createElement(Space, { size: 24 },
              React.createElement(Text, null, '总分: ' + React.createElement(Text, { strong: true }, answeringPaper.total_score || 0)),
              React.createElement(Text, null, '得分: ' + React.createElement(Text, { strong: true, type: (result.total_score || 0) >= (answeringPaper.total_score || 60) * 0.6 ? 'success' : 'danger' }, result.total_score || 0)),
              React.createElement(Text, null, '正确: ' + React.createElement(Text, { strong: true, type: 'success' }, correctDetails.length)),
              React.createElement(Text, null, '错误: ' + React.createElement(Text, { strong: true, type: 'danger' }, wrongDetails.length))
            )
          )
        ),
        wrongDetails.length > 0 ? React.createElement(Card, { title: '错题信息（共' + wrongDetails.length + '题）', size: 'small' },
          wrongDetails.map(function (d, i) {
            var q = questions.find(function (q) { return q.id === d.question_id; });
            return React.createElement('div', { key: i, style: { marginBottom: 8, padding: 10, background: '#fff7f5', borderRadius: 6, border: '1px solid #ffd8d2' } },
              React.createElement(Text, { strong: true }, (i+1) + '. ' + ((q && q.title) || d.question_id)),
              React.createElement('div', null, React.createElement(Text, { type: 'danger' }, '你的答案: ' + (d.student_answer || '未作答'))),
              d.feedback ? React.createElement('div', null, React.createElement(Text, { type: 'secondary' }, d.feedback)) : null
            );
          })
        ) : React.createElement(Card, { style: { textAlign: 'center', padding: 20 } },
          React.createElement(CheckCircleOutlined, { style: { fontSize: 48, color: '#52c41a' } }),
          React.createElement(Title, { level: 5, style: { marginTop: 12 } }, '全部正确！')
        ),
        React.createElement('div', { style: { marginTop: 16, textAlign: 'center' } },
          React.createElement(Button, { type: 'primary', size: 'large', onClick: goBack }, '返回试卷列表')
        )
      );
    }
    var answeredCount = Object.keys(answers).filter(function (k) { return answers[k]; }).length;
    return React.createElement('div', null,
      React.createElement('div', { style: { marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement(Button, { onClick: goBack }, '← 返回试卷列表'),
        React.createElement(Space, null,
          React.createElement(Text, { type: 'secondary' }, '已答 ' + answeredCount + '/' + questions.length + ' 题'),
          React.createElement(Button, { type: 'primary', size: 'large', onClick: handleSubmit, loading: submitting,
            disabled: answeredCount < questions.length, icon: React.createElement(CheckCircleOutlined) }, '提交试卷')
        )
      ),
      React.createElement(Card, { title: answeringPaper.title + '（共' + questions.length + '题，满分' + (answeringPaper.total_score || 0) + '分）' },
        questions.map(function (q, i) {
          var answerData = null;
          try { answerData = JSON.parse(q.correct_answer || '{}'); } catch (e) {}
          var options = answerData && answerData.options;
          var qType = q.question_type;
          return React.createElement(Card, { key: q.id, size: 'small', style: { marginBottom: 8 },
            title: React.createElement(Space, null,
              React.createElement(Tag, null, toLabelMap(qtypes)[qType] || qType),
              React.createElement(Text, null, (i+1) + '. ' + (q.title || '').substring(0, 80) + '（' + (q.score || 0) + '分）')
            )
          },
            (qType === 'SINGLE_CHOICE' || qType === 'MULTIPLE_CHOICE') && options
              ? React.createElement(Radio.Group, { value: answers[q.id], onChange: function (e) { var a = {}; Object.keys(answers).forEach(function (k) { a[k] = answers[k]; }); a[q.id] = e.target.value; setAnswers(a); },
                  style: { display: 'block', marginLeft: 16 } },
                  ...options.map(function (opt) { return React.createElement(Radio, { key: opt.label, value: opt.label, style: { display: 'block', marginBottom: 6, padding: 6, borderRadius: 4, background: answers[q.id] === opt.label ? '#f0f5ff' : 'transparent' } }, opt.label + '. ' + (opt.text || '')); })
                )
              : React.createElement('div', { style: { marginLeft: 16 } },
                  React.createElement(Input.TextArea, { rows: 3, placeholder: '请输入答案', value: answers[q.id] || '',
                    onChange: function (e) { var a = {}; Object.keys(answers).forEach(function (k) { a[k] = answers[k]; }); a[q.id] = e.target.value; setAnswers(a); },
                    style: { maxWidth: 500 }
                  })
                )
          );
        })
      )
    );
  }

  // ── Top-Bottom Layout ──
  return React.createElement('div', null,
    // Top: 待作答试卷
    React.createElement(Card, {
      title: React.createElement(Space, null,
        React.createElement(Text, { strong: true, style: { fontSize: 15 } }, '待作答试卷'),
        React.createElement(Tag, { color: 'blue' }, pendingFiltered.length)
      ),
      size: 'small',
      style: { marginBottom: 8 },
      extra: pendingFiltered.length > 0 ? React.createElement(Text, { type: 'secondary', style: { fontSize: 12 } }, '点击"开始答题"进入作答') : null
    },
      React.createElement(Row, { gutter: 12, style: { marginBottom: 12 } },
        React.createElement(Col, { flex: 1 },
          React.createElement(Input, { placeholder: '搜索试卷名称', value: pendingFilter, onChange: function (e) { setPendingFilter(e.target.value); },
            prefix: React.createElement(SearchOutlined), allowClear: true
          })
        ),
        React.createElement(Col, null,
          React.createElement(Select, { placeholder: '学科', value: pendingSubj || undefined, onChange: function (v) { setPendingSubj(v || ''); },
            allowClear: true, style: { width: 100 }, options: SUBJECT_OPTIONS
          })
        )
      ),
      pendingFiltered.length > 0
        ? React.createElement(Table, { rowKey: 'id', size: 'small', dataSource: pendingFiltered, columns: pendingColumns, pagination: false, loading: loading })
        : React.createElement(Empty, { description: '暂无待作答试卷', image: Empty.PRESENTED_IMAGE_SIMPLE,
            style: { padding: '20px 0' } })
    ),

    // Transition zone
    React.createElement('div', { style: { textAlign: 'center', margin: '4px 0' } },
      React.createElement(Tooltip, { title: '在下栏勾选试卷后，点击此按钮加入待作答区' },
        React.createElement(Button, { type: 'dashed', size: 'small', icon: React.createElement(ArrowUpOutlined),
          disabled: selectedRowKeys.length === 0,
          onClick: function () { moveToPending(selectedRowKeys); }
        }, selectedRowKeys.length > 0 ? '加入待作答 (' + selectedRowKeys.length + ')' : '↑ 从下方勾选试卷加入待作答 ↑')
      )
    ),

    // Bottom: 我所有的试卷
    React.createElement(Card, {
      title: React.createElement(Space, null,
        React.createElement(Text, { strong: true, style: { fontSize: 15 } }, '我所有的试卷'),
        React.createElement(Tag, { color: 'default' }, allFiltered.length)
      ),
      size: 'small',
      extra: selectedRowKeys.length > 0 ? React.createElement(Space, null,
        React.createElement(Text, { type: 'secondary', style: { fontSize: 12 } }, '已选 ' + selectedRowKeys.length + ' 份'),
        React.createElement(Button, { type: 'primary', size: 'small', icon: React.createElement(ArrowUpOutlined),
          onClick: function () { moveToPending(selectedRowKeys); } }, '加入待作答')
      ) : React.createElement(Text, { type: 'secondary', style: { fontSize: 12 } }, '勾选试卷后可加入上方待作答区')
    },
      React.createElement(Row, { gutter: 12, style: { marginBottom: 12 } },
        React.createElement(Col, { flex: 1 },
          React.createElement(Input, { placeholder: '搜索试卷名称', value: allFilter, onChange: function (e) { setAllFilter(e.target.value); },
            prefix: React.createElement(SearchOutlined), allowClear: true
          })
        ),
        React.createElement(Col, null,
          React.createElement(Select, { placeholder: '学科', value: allSubjFilter || undefined, onChange: function (v) { setAllSubjFilter(v || ''); },
            allowClear: true, style: { width: 100 }, options: SUBJECT_OPTIONS
          })
        )
      ),
      allFiltered.length > 0
        ? React.createElement(Table, {
            rowKey: 'id', size: 'small', dataSource: allFiltered, columns: allColumns,
            loading: loading, pagination: { pageSize: 10, showSizeChanger: false, showTotal: function (t) { return '共 ' + t + ' 份'; } },
            rowSelection: {
              selectedRowKeys: selectedRowKeys,
              onChange: function (keys) { setSelectedRowKeys(keys); },
              getCheckboxProps: function (r) { return { disabled: !!pendingPapers.find(function (p) { return p.id === r.id; }) }; },
            }
          })
        : React.createElement(Empty, { description: '暂无试卷', image: Empty.PRESENTED_IMAGE_SIMPLE, style: { padding: '20px 0' } })
    ),

    React.createElement(PaperPreviewDrawer, { open: previewOpen, paperId: previewId, onClose: function () { setPreviewOpen(false); } })
  );
}
