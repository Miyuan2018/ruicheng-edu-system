import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Typography, Space, Input, Select, message, Popconfirm, Dropdown } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SearchOutlined, DownloadOutlined, PrinterOutlined, CameraOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import PaperEditModal from './PaperEditModal';
import PaperImportModal from './PaperImportModal';
import PaperPreviewDrawer from './PaperPreviewDrawer';

var Title = Typography.Title;

export default function PaperListPage() {
  var userType = localStorage.getItem('user_type') || 'STUDENT';
  var isStudent = userType === 'STUDENT';
  var ps = useState([]); var papers = ps[0]; var setPapers = ps[1];
  var ls = useState(false); var loading = ls[0]; var setLoading = ls[1];
  var modalOpenState = useState(false); var modalOpen = modalOpenState[0]; var setModalOpen = modalOpenState[1];
  var importOpenState = useState(false); var importOpen = importOpenState[0]; var setImportOpen = importOpenState[1];
  var editPaperState = useState(null); var editPaper = editPaperState[0]; var setEditPaper = editPaperState[1];
  var previewOpenState = useState(false); var previewOpen = previewOpenState[0]; var setPreviewOpen = previewOpenState[1];
  var previewIdState = useState(null); var previewId = previewIdState[0]; var setPreviewId = previewIdState[1];
  var searchTitleState = useState(''); var searchTitle = searchTitleState[0]; var setSearchTitle = searchTitleState[1];
  var searchStatusState = useState(''); var searchStatus = searchStatusState[0]; var setSearchStatus = searchStatusState[1];

  var fetchPapers = useCallback(async function () {
    setLoading(true);
    try {
      var params = { limit: 50 };
      if (searchTitle) params.title = searchTitle;
      if (searchStatus) params.status = searchStatus;
      var resp = await apiClient.get('/exam-papers', { params: params });
      var data = resp.data;
      if (Array.isArray(data)) { setPapers(data); }
      else if (data && data.data && Array.isArray(data.data)) { setPapers(data.data); }
      else if (data && data.items) { setPapers(data.items); }
      else { setPapers([]); }
    } catch (e) { message.error('加载试卷列表失败'); }
    finally { setLoading(false); }
  }, [searchTitle, searchStatus]);

  useEffect(function () { fetchPapers(); }, [fetchPapers]);

  function handleNew() { setEditPaper(null); setModalOpen(true); }
  function handleEdit(paper) { setEditPaper(paper); setModalOpen(true); }
  function handlePreview(id) { setPreviewId(id); setPreviewOpen(true); }

  async function handleDelete(id) {
    try { await apiClient.delete('/exam-papers/' + id); message.success('删除成功'); fetchPapers(); }
    catch (e) { message.error('删除失败'); }
  }

  function handleSuccess() { setModalOpen(false); fetchPapers(); }
  function handleImportSuccess() { setImportOpen(false); fetchPapers(); }

  function handleExport(paperId, format) {
    var a = document.createElement('a');
    a.href = '/api/v1/exam-papers/' + paperId + '/export/' + format;
    var token = localStorage.getItem('access_token');
    if (token) {
      // Use fetch to download with auth header
      fetch(a.href, { headers: { Authorization: 'Bearer ' + token } })
        .then(function (r) {
          if (!r.ok) { message.error('导出失败'); return; }
          return r.blob();
        })
        .then(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          a.href = url;
          a.download = 'paper.' + format;
          a.click();
          URL.revokeObjectURL(url);
          message.success('导出成功');
        })
        .catch(function () { message.error('导出失败'); });
    }
  }

  function handlePrint(paperId, title) {
    var w = window.open('/print-preview?paperId=' + paperId, '_blank', 'width=900,height=700');
    if (!w) { message.info('请允许弹出窗口以预览打印'); }
  }

  var columns = [
    { title: '试卷名称', dataIndex: 'title', ellipsis: true,
      render: function (text, record) {
        return React.createElement('a', { onClick: function () { handlePreview(record.id); } }, text);
      }
    },
    { title: '学科', dataIndex: 'subject', width: 80 },
    { title: '年级', dataIndex: 'grade_level', width: 80 },
    { title: '题数', dataIndex: 'question_count', width: 60, align: 'center' },
    { title: '总分', dataIndex: 'total_score', width: 60, align: 'center' },
    { title: '时长(分)', dataIndex: 'duration_minutes', width: 70, align: 'center' },
    { title: '状态', dataIndex: 'status', width: 80, render: function (s) {
      var color = s === 'PUBLISHED' ? 'green' : s === 'DRAFT' ? 'default' : 'orange';
      var label = s === 'PUBLISHED' ? '已发布' : s === 'DRAFT' ? '草稿' : s;
      return React.createElement(Tag, { color: color }, label);
    }},
    { title: '操作', width: 280, render: function (_, record) {
      var exportItems = {
        items: [
          { key: 'word', label: '导出 Word (.docx)', icon: React.createElement(DownloadOutlined), onClick: function () { handleExport(record.id, 'word'); } },
          { key: 'pdf', label: '导出 PDF', icon: React.createElement(DownloadOutlined), onClick: function () { handleExport(record.id, 'pdf'); } },
        ]
      };
      return React.createElement(Space, null,
        React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(EyeOutlined),
          onClick: function () { handlePreview(record.id); } }, '预览'),
        React.createElement(Dropdown, { menu: exportItems },
          React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(DownloadOutlined) }, '导出')
        ),
        React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(PrinterOutlined),
          onClick: function () { handlePrint(record.id, record.title); } }, '打印'),
        React.createElement(Popconfirm, { title: '确定删除该试卷？', onConfirm: function () { handleDelete(record.id); } },
          React.createElement(Button, { type: 'link', size: 'small', danger: true, icon: React.createElement(DeleteOutlined) }, '删除')
        )
      );
    }}
  ];

  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 16 } },
      React.createElement(Title, { level: 4, style: { margin: 0 } }, isStudent ? '我的试卷' : '试卷管理'),
      isStudent ? null : React.createElement(Space, null,
        React.createElement(Button, { icon: React.createElement(CameraOutlined), onClick: function () { setImportOpen(true); } }, '试卷录入'),
        React.createElement(Button, { type: 'primary', icon: React.createElement(PlusOutlined), onClick: handleNew }, '新建试卷')
      )
    ),
    React.createElement('div', { style: { marginBottom: 16, display: 'flex', gap: 12 } },
      React.createElement(Input, { placeholder: '搜索试卷名称', value: searchTitle, onChange: function (e) { setSearchTitle(e.target.value); },
        style: { width: 200 }, prefix: React.createElement(SearchOutlined), allowClear: true }),
      React.createElement(Select, { placeholder: '状态筛选', value: searchStatus || undefined, onChange: function (v) { setSearchStatus(v || ''); },
        style: { width: 120 }, allowClear: true,
        options: [{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }, { value: 'ARCHIVED', label: '已归档' }]
      })
    ),
    React.createElement(Table, { rowKey: 'id', loading: loading, dataSource: papers, columns: columns, size: 'middle' }),
    React.createElement(PaperEditModal, { open: modalOpen, paper: editPaper, onClose: function () { setModalOpen(false); }, onSuccess: handleSuccess }),
    React.createElement(PaperImportModal, { open: importOpen, onClose: function () { setImportOpen(false); }, onSuccess: handleImportSuccess }),
    React.createElement(PaperPreviewDrawer, { open: previewOpen, paperId: previewId, onClose: function () { setPreviewOpen(false); } })
  );
}
