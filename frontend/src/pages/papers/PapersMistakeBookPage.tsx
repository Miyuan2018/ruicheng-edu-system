import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Typography, Space, Tag, message, Modal, Radio, Card, Progress, Descriptions, Tabs } from 'antd';
import { EditOutlined, CameraOutlined, PrinterOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import PaperPreviewDrawer from './PaperPreviewDrawer';
import GenerateMistakeBookTab from '../exam-mistakes/GenerateMistakeBookTab';
import PhotoScanTab from '../exam-mistakes/PhotoScanTab';

var Title = Typography.Title;
var Text = Typography.Text;

export default function PapersMistakeBookPage() {
  var activeTabState = useState('list'); var activeTab = activeTabState[0]; var setActiveTab = activeTabState[1];

  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 } },
      React.createElement(Title, { level: 4, style: { margin: 0 } }, '试卷错题本')
    ),
    React.createElement(Tabs, { activeKey: activeTab, onChange: setActiveTab, size: 'large', items: [
      { key: 'list',
        label: React.createElement(Space, null, React.createElement(EditOutlined, null), '试卷列表'),
        children: React.createElement(PaperListWithActions)
      },
      { key: 'generate',
        label: React.createElement(Space, null, React.createElement(PrinterOutlined, null), '生成纸质错题练习本'),
        children: React.createElement(GenerateMistakeBookTab)
      },
    ]})
  );
}


function PaperListWithActions() {
  var papersState = useState([]); var papers = papersState[0]; var setPapers = papersState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];
  var searchState = useState(''); var search = searchState[0]; var setSearch = searchState[1];
  var subjFilterState = useState(''); var subjFilter = subjFilterState[0]; var setSubjFilter = subjFilterState[1];
  var previewOpenState = useState(false); var previewOpen = previewOpenState[0]; var setPreviewOpen = previewOpenState[1];
  var previewIdState = useState(null); var previewId = previewIdState[0]; var setPreviewId = previewIdState[1];

  // Answering flow
  var answeringState = useState(null); var answeringPaper = answeringState[0]; var setAnsweringPaper = answeringState[1];
  var questionsState = useState([]); var questions = questionsState[0]; var setQuestions = questionsState[1];
  var answersState = useState({}); var answers = answersState[0]; var setAnswers = answersState[1];
  var resultState = useState(null); var result = resultState[0]; var setResult = resultState[1];
  var submittingState = useState(false); var submitting = submittingState[0]; var setSubmitting = submittingState[1];

  // Photo scan modal
  var scanOpenState = useState(false); var scanOpen = scanOpenState[0]; var setScanOpen = scanOpenState[1];

  var userId = localStorage.getItem('user_id') || '';
  useEffect(function () { loadPapers(); }, []);

  function loadPapers() {
    setLoading(true);
    apiClient.get('/exam-papers', { params: { status: 'PUBLISHED', limit: 100 } }).then(function (resp) {
      setPapers(Array.isArray(resp.data) ? resp.data : []);
    }).catch(function () { setPapers([]); })
    .finally(function () { setLoading(false); });
  }

  // ── Online Answering ──
  function startAnswering(paper) {
    setAnsweringPaper(paper);
    setAnswers({});
    setResult(null);
    apiClient.get('/exam-papers/' + paper.id + '/questions').then(function (resp) {
      setQuestions(Array.isArray(resp.data) ? resp.data : []);
    }).catch(function () { message.error('加载试题失败'); });
  }

  function handleAnswerChange(qid, value) {
    var newAnswers = {}; Object.keys(answers).forEach(function (k) { newAnswers[k] = answers[k]; });
    newAnswers[qid] = value; setAnswers(newAnswers);
  }

  function submitAnswers() {
    setSubmitting(true);
    var body = { exam_paper_id: answeringPaper.id, answers: questions.map(function (q) { return { question_id: q.id, answer_text: answers[q.id] || '' }; }) };
    apiClient.post('/answers', body).then(function (resp) {
      setResult(resp.data || resp);
      message.success('提交成功');
    }).catch(function () { message.error('提交失败'); })
    .finally(function () { setSubmitting(false); });
  }

  // ── Generate Mistake Book ──
  function generateMistakeBook(paperId) {
    apiClient.post('/error-notebooks/generate', { exam_paper_id: paperId }).then(function () {
      message.success('错题本已生成');
    }).catch(function () { message.error('生成失败'); });
  }

  function handlePreview(id) { setPreviewId(id); setPreviewOpen(true); }

  // Filter
  var filteredPapers = papers.filter(function (p) {
    if (search && !(p.title || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (subjFilter && p.subject !== subjFilter) return false;
    return true;
  });

  return React.createElement('div', null,
    // ── Answering View ──
    answeringPaper ? React.createElement('div', null,
      React.createElement('div', { style: { marginBottom: 16 } },
        React.createElement(Button, { size: 'small', onClick: function () { setAnsweringPaper(null); } }, '← 返回试卷列表'),
        React.createElement(Text, { strong: true, style: { marginLeft: 16, fontSize: 16 } }, answeringPaper.title)
      ),
      result ? React.createElement(Card, { title: '答题结果', size: 'small' },
        React.createElement(Descriptions, { column: 2, size: 'small' },
          React.createElement(Descriptions.Item, { label: '总分' }, result.total_score + '/' + (result.max_score || '?')),
          React.createElement(Descriptions.Item, { label: '正确率' },
            React.createElement(Progress, { percent: result.percentage || 0, size: 'small', strokeColor: (result.percentage || 0) >= 60 ? '#52c41a' : '#ff4d4f' })
          )
        ),
        React.createElement(Button, { size: 'small', type: 'primary', onClick: function () { setAnsweringPaper(null); loadPapers(); } }, '完成')
      ) : React.createElement(Card, { title: '在线答题', size: 'small', extra: React.createElement(Button, { size: 'small', type: 'primary', loading: submitting, onClick: submitAnswers, disabled: questions.length === 0 }, '提交答案') },
        questions.length === 0 ? React.createElement(Text, { type: 'secondary' }, '加载试题中...') :
          questions.map(function (q, idx) {
            return React.createElement(Card, { key: q.id, size: 'small', style: { marginBottom: 8 } },
              React.createElement(Text, { strong: true }, (idx + 1) + '. ' + q.title),
              React.createElement('div', { style: { marginTop: 8 } },
                React.createElement(Radio.Group, { onChange: function (e) { handleAnswerChange(q.id, e.target.value); }, value: answers[q.id] },
                  React.createElement(Space, { direction: 'vertical' },
                    (q.correct_answer ? (function () { try { var ca = JSON.parse(q.correct_answer); return (ca.options || []).map(function (o) { return React.createElement(Radio, { key: o.label, value: o.label }, o.label + '. ' + (o.text || o)); }); } catch (e) { return null; } })() : null)
                  )
                )
              )
            );
          })
      )
    ) :
    // ── Paper List ──
    React.createElement('div', null,
      React.createElement('div', { style: { marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' } },
        React.createElement(Input, { placeholder: '搜索试卷名称', value: search, onChange: function (e) { setSearch(e.target.value); },
          style: { width: 180 }, prefix: React.createElement(SearchOutlined), allowClear: true, size: 'small'
        }),
        React.createElement(Select, { placeholder: '学科', value: subjFilter || undefined, onChange: setSubjFilter,
          allowClear: true, style: { width: 100 }, size: 'small',
          options: [{ value: '数学', label: '数学' }, { value: '语文', label: '语文' }, { value: '英语', label: '英语' }, { value: '物理', label: '物理' }, { value: '化学', label: '化学' }]
        })
      ),
      React.createElement(Table, { rowKey: 'id', loading: loading, dataSource: filteredPapers, size: 'middle',
        columns: [
          { title: '试卷名称', dataIndex: 'title', ellipsis: true,
            render: function (text, record) { return React.createElement('a', { onClick: function () { handlePreview(record.id); } }, text); }
          },
          { title: '学科', dataIndex: 'subject', width: 80 },
          { title: '年级', dataIndex: 'grade_level', width: 80 },
          { title: '总分', dataIndex: 'total_score', width: 60, align: 'center' },
          { title: '时长(分)', dataIndex: 'duration_minutes', width: 70, align: 'center' },
          { title: '状态', dataIndex: 'status', width: 80, render: function (s) { return React.createElement(Tag, null, s); } },
          { title: '操作', width: 280, render: function (_, record) {
            return React.createElement(Space, null,
              React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(EditOutlined), onClick: function () { startAnswering(record); } }, '在线答题'),
              React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(CameraOutlined), onClick: function () { setScanOpen(true); } }, '拍照/扫描录入'),
              React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(EyeOutlined), onClick: function () { handlePreview(record.id); } }, '预览'),
              React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(PrinterOutlined), onClick: function () { generateMistakeBook(record.id); } }, '生成错题')
            );
          }}
        ]
      }),
      React.createElement(PaperPreviewDrawer, { open: previewOpen, paperId: previewId, onClose: function () { setPreviewOpen(false); } }),

      // Photo Scan Modal
      React.createElement(Modal, { title: '拍照/扫描录入答案', open: scanOpen, width: 750, footer: null, onCancel: function () { setScanOpen(false); } },
        React.createElement(PhotoScanTab)
      )
    )
  );
}
