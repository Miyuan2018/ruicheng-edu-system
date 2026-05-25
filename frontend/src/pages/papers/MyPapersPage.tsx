import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Typography, Space, Tag, message, Popconfirm, Modal, Radio, Card, Progress, Descriptions, Tooltip } from 'antd';
import { SearchOutlined, FileTextOutlined, EyeOutlined, DeleteOutlined, CameraOutlined, EditOutlined, PrinterOutlined, BookOutlined, PlayCircleOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toColorMap } from '../../hooks/useReferenceValues';
import PaperPreviewDrawer from './PaperPreviewDrawer';
import PaperImportModal from './PaperImportModal';
import PhotoScanTab from '../exam-mistakes/PhotoScanTab';

var Title = Typography.Title;
var Text = Typography.Text;

export default function MyPapersPage() {
  var papersState = useState([]); var papers = papersState[0]; var setPapers = papersState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var searchTitleState = useState(''); var searchTitle = searchTitleState[0]; var setSearchTitle = searchTitleState[1];
  var filterGradeState = useState(undefined); var filterGrade = filterGradeState[0]; var setFilterGrade = filterGradeState[1];
  var filterStatusState = useState(undefined); var filterStatus = filterStatusState[0]; var setFilterStatus = filterStatusState[1];
  var importOpenState = useState(false); var importOpen = importOpenState[0]; var setImportOpen = importOpenState[1];
  var previewOpenState = useState(false); var previewOpen = previewOpenState[0]; var setPreviewOpen = previewOpenState[1];
  var previewIdState = useState(''); var previewId = previewIdState[0]; var setPreviewId = previewIdState[1];
  var selectedRowKeysState = useState([]); var selectedRowKeys = selectedRowKeysState[0]; var setSelectedRowKeys = selectedRowKeysState[1];
  var scanOpenState = useState(false); var scanOpen = scanOpenState[0]; var setScanOpen = scanOpenState[1];

  // Answering flow
  var answeringState = useState(null); var answeringPaper = answeringState[0]; var setAnsweringPaper = answeringState[1];
  var questionsState = useState([]); var questions = questionsState[0]; var setQuestions = questionsState[1];
  var answersState = useState({}); var answers = answersState[0]; var setAnswers = answersState[1];
  var answerResultState = useState(null); var answerResult = answerResultState[0]; var setAnswerResult = answerResultState[1];
  var submittingState = useState(false); var submitting = submittingState[0]; var setSubmitting = submittingState[1];

  var refs = useReferenceValues();
  var paperStatuses = refs['paper-statuses'];
  var grades = refs['grade-levels'];
  var statusLabels = toLabelMap(paperStatuses);
  var statusColors = toColorMap(paperStatuses);
  var gradeOptions = (grades || []).map(function (g) { return { value: g.code, label: g.name }; });
  var statusOptions = (paperStatuses || []).map(function (s) { return { value: s.code, label: s.name }; });

  function loadPapers() {
    setLoading(true);
    var params = {};
    if (searchTitle) params.title = searchTitle;
    if (filterGrade) params.grade = filterGrade;
    if (filterStatus) params.status = filterStatus;
    apiClient.get('/exam-papers/my', { params: params }).then(function (resp) {
      setPapers(Array.isArray(resp.data) ? resp.data : []);
    }).catch(function () { setPapers([]); })
    .finally(function () { setLoading(false); });
  }

  useEffect(function () { loadPapers(); }, []);

  function handlePreview(id) { setPreviewId(id); setPreviewOpen(true); }

  function handleDelete(id) {
    apiClient.delete('/exam-papers/' + id).then(function () {
      message.success('已删除'); loadPapers();
    }).catch(function () { message.error('删除失败'); });
  }

  function handlePrint(paperId) {
    var w = window.open('/print-preview?paperId=' + paperId, '_blank', 'width=900,height=700');
    if (!w) { message.info('请允许弹出窗口以预览打印'); }
  }

  function handleBatchDelete() {
    if (selectedRowKeys.length === 0) { message.warning('请先选中试卷'); return; }
    Promise.all(selectedRowKeys.map(function (id) {
      return apiClient.delete('/exam-papers/' + id);
    })).then(function () {
      message.success('已删除 ' + selectedRowKeys.length + ' 份试卷');
      setSelectedRowKeys([]); loadPapers();
    }).catch(function () { message.error('批量删除失败'); });
  }

  function generateMistakeBook(paperId) {
    apiClient.post('/error-notebooks/generate', { exam_paper_id: paperId }).then(function () {
      message.success('错题本已生成');
      loadPapers();
    }).catch(function (e) { message.error(e.response?.data?.detail || '生成失败'); });
  }

  function handleStatusChange(record) {
    Modal.confirm({
      title: '修改试卷状态',
      content: '确定将试卷状态从"已生成"改为"重新判"？修改后可以重新生成错题本。',
      okText: '确认修改',
      cancelText: '取消',
      onOk: function () {
        return apiClient.put('/exam-papers/' + record.id + '/submission-status', { status_in: '重新判' }).then(function () {
          message.success('状态已修改为"重新判"');
          loadPapers();
        }).catch(function (e) { message.error(e.response?.data?.detail || '状态修改失败'); });
      }
    });
  }

  // ── Online Answering ──
  function startAnswering(paper) {
    setAnsweringPaper(paper);
    setAnswers({});
    setAnswerResult(null);
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
    var body = { exam_paper_id: answeringPaper.id, submission_type: 'ONLINE', answers: questions.map(function (q) { return { question_id: q.id, student_answer: answers[q.id] || '' }; }) };
    apiClient.post('/answers', body).then(function (resp) {
      setAnswerResult(resp.data || resp);
      message.success('提交成功');
    }).catch(function (err) {
      var detail = '提交失败';
      if (err && err.response && err.response.data) {
        detail = err.response.data.detail || JSON.stringify(err.response.data);
      }
      message.error(detail);
    })
    .finally(function () { setSubmitting(false); });
  }

  // Answering view
  if (answeringPaper) {
    return React.createElement('div', null,
      React.createElement('div', { style: { marginBottom: 16 } },
        React.createElement(Button, { size: 'small', onClick: function () { setAnsweringPaper(null); } }, '← 返回试卷列表'),
        React.createElement(Text, { strong: true, style: { marginLeft: 16, fontSize: 16 } }, answeringPaper.title)
      ),
      answerResult ? React.createElement(Card, { title: '答题结果', size: 'small' },
        React.createElement(Descriptions, { column: 2, size: 'small' },
          React.createElement(Descriptions.Item, { label: '总分' }, answerResult.total_score + '/' + (answerResult.max_score || '?')),
          React.createElement(Descriptions.Item, { label: '正确率' },
            React.createElement(Progress, { percent: answerResult.percentage || 0, size: 'small', strokeColor: (answerResult.percentage || 0) >= 60 ? '#52c41a' : '#ff4d4f' })
          )
        ),
        React.createElement(Button, { size: 'small', type: 'primary', style: { marginTop: 12 }, onClick: function () { setAnsweringPaper(null); loadPapers(); } }, '完成')
      ) : React.createElement(Card, { title: '在线答题', size: 'small', extra: React.createElement(Button, { size: 'small', type: 'primary', loading: submitting, onClick: submitAnswers, disabled: questions.length === 0 }, '提交答案') },
        questions.length === 0 ? React.createElement(Text, { type: 'secondary' }, '加载试题中...') :
          questions.map(function (q, idx) {
            var options = [];
            try { var ca = JSON.parse(q.correct_answer || '{}'); options = ca.options || []; } catch (e) {}
            return React.createElement(Card, { key: q.id, size: 'small', style: { marginBottom: 8 } },
              React.createElement(Text, { strong: true }, (idx + 1) + '. ' + q.title),
              options.length > 0 ? React.createElement('div', { style: { marginTop: 8 } },
                React.createElement(Radio.Group, { onChange: function (e) { handleAnswerChange(q.id, e.target.value); }, value: answers[q.id] },
                  React.createElement(Space, { direction: 'vertical' },
                    options.map(function (o) { return React.createElement(Radio, { key: o.label, value: o.label }, o.label + '. ' + (o.text || o)); })
                  )
                )
              ) : React.createElement('div', { style: { marginTop: 8 } },
                React.createElement(Input, { placeholder: '请输入答案', size: 'small', style: { width: 300 }, onChange: function (e) { handleAnswerChange(q.id, e.target.value); } })
              )
            );
          })
      )
    );
  }

  // Paper list view
  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 16 } },
      React.createElement(Title, { level: 4, style: { margin: 0 } }, React.createElement(FileTextOutlined, { style: { marginRight: 8 } }), '我的试卷'),
      React.createElement(Space, null,
        React.createElement(Button, { size: 'small', icon: React.createElement(CameraOutlined), onClick: function () { setImportOpen(true); } }, '拍照/扫描导入'),
        selectedRowKeys.length > 0 ? React.createElement(Popconfirm, { title: '确定删除选中的 ' + selectedRowKeys.length + ' 份试卷？', onConfirm: handleBatchDelete },
          React.createElement(Button, { size: 'small', danger: true, icon: React.createElement(DeleteOutlined) }, '批量删除(' + selectedRowKeys.length + ')')
        ) : null
      )
    ),
    React.createElement('div', { style: { marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' } },
      React.createElement(Input, { placeholder: '搜索试卷名称', value: searchTitle, onChange: function (e) { setSearchTitle(e.target.value); },
        style: { width: 180 }, prefix: React.createElement(SearchOutlined), allowClear: true, size: 'small',
        onPressEnter: loadPapers
      }),
      React.createElement(Select, { placeholder: '年级', value: filterGrade, onChange: setFilterGrade,
        allowClear: true, style: { width: 100 }, size: 'small', options: gradeOptions
      }),
      React.createElement(Select, { placeholder: '状态', value: filterStatus, onChange: setFilterStatus,
        allowClear: true, style: { width: 100 }, size: 'small', options: statusOptions
      }),
      React.createElement(Button, { size: 'small', icon: React.createElement(SearchOutlined), onClick: loadPapers }, '查询')
    ),
    React.createElement(Table, { rowKey: 'id', loading: loading, dataSource: papers, size: 'middle',
      rowSelection: { selectedRowKeys: selectedRowKeys, onChange: function (keys) { setSelectedRowKeys(keys); } },
      columns: [
        { title: '试卷名称', dataIndex: 'title', ellipsis: true,
          render: function (text, record) {
            return React.createElement('a', { onClick: function () { handlePreview(record.id); } }, text);
          }
        },
        { title: '学科', dataIndex: 'subject', width: 70 },
        { title: '年级', dataIndex: 'grade_level', width: 120, render: function (v) {
          if (!v) return '-';
          try { var gl = typeof v === 'string' ? JSON.parse(v) : v; var gs = gl.grades || []; return gs.map(function (g) { var found = grades.find(function (r) { return r.code === g; }); return found ? found.name : g; }).join('、'); } catch (e) { return String(v); }
        }},
        { title: '判分状态', dataIndex: 'submission_status', width: 100, render: function (s, r) {
          if (!s) return React.createElement(Tag, null, '未提交');
          var map = { '已判分': { color: 'green', label: '已判分' }, '已生成': { color: 'blue', label: '已生成' }, '重新判': { color: 'orange', label: '重新判' } };
          var m = map[s] || { color: 'default', label: s };
          return React.createElement(Tag, { color: m.color }, m.label);
        }},
        { title: '操作', width: 220, render: function (_, record) {
          return React.createElement(Space, { size: 2 },
            React.createElement(Tooltip, { title: '预览' }, React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(EyeOutlined), onClick: function () { handlePreview(record.id); } })),
            React.createElement(Tooltip, { title: record.submission_status === '已生成' ? '修改试卷状态：重新判' : '仅已生成状态可修改' }, React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(EditOutlined), disabled: record.submission_status !== '已生成', onClick: function () { handleStatusChange(record); } })),
            React.createElement(Tooltip, { title: '打印' }, React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(PrinterOutlined), onClick: function () { handlePrint(record.id); } })),
            React.createElement(Tooltip, { title: '在线答题' }, React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(PlayCircleOutlined), style: { color: '#1890ff' }, onClick: function () { startAnswering(record); } })),
            React.createElement(Tooltip, { title: '拍照/扫描录入' }, React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(CameraOutlined), onClick: function () { setScanOpen(true); } })),
            React.createElement(Tooltip, { title: record.submission_status === '已生成' ? '已生成错题本，如需重新生成请先修改试卷状态' : '生成错题' }, React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(BookOutlined), style: { color: record.submission_status === '已生成' ? '#ccc' : '#52c41a' }, disabled: record.submission_status === '已生成', onClick: function () { generateMistakeBook(record.id); } })),
            React.createElement(Popconfirm, { title: '确定删除该试卷？', onConfirm: function () { handleDelete(record.id); } },
              React.createElement(Tooltip, { title: '删除' }, React.createElement(Button, { type: 'link', size: 'small', danger: true, icon: React.createElement(DeleteOutlined) }))
            )
          );
        }}
      ]
    }),
    React.createElement(PaperPreviewDrawer, { open: previewOpen, paperId: previewId, onClose: function () { setPreviewOpen(false); } }),
    React.createElement(PaperImportModal, { open: importOpen, onClose: function () { setImportOpen(false); }, onSuccess: function () { setImportOpen(false); loadPapers(); } }),
    React.createElement(Modal, { title: '拍照/扫描录入答案', open: scanOpen, width: 750, footer: null, onCancel: function () { setScanOpen(false); } },
      React.createElement(PhotoScanTab)
    ),
  );
}
