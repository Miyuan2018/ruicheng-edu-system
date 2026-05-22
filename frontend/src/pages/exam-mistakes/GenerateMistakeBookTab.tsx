import React, { useState, useEffect } from 'react';
import { Card, Button, Select, Table, Tag, message, Typography, Space, Empty, Row, Col } from 'antd';
import { BookOutlined, FileTextOutlined, DeleteOutlined, EyeOutlined, PrinterOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

var Title = Typography.Title;
var Text = Typography.Text;
var userId = localStorage.getItem('user_id') || '';

export default function GenerateMistakeBookTab() {
  var papersState = useState([]); var papers = papersState[0]; var setPapers = papersState[1];
  var notebooksState = useState([]); var notebooks = notebooksState[0]; var setNotebooks = notebooksState[1];
  var selectedPaperState = useState(null); var selectedPaper = selectedPaperState[0]; var setSelectedPaper = selectedPaperState[1];
  var generatingState = useState(false); var generating = generatingState[0]; var setGenerating = generatingState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];

  useEffect(function () {
    setLoading(true);
    Promise.all([
      apiClient.get('/exam-papers', { params: { status: 'PUBLISHED', limit: 100 } }).catch(function () { return { data: [] }; }),
      loadNotebooks(),
    ]).finally(function () { setLoading(false); });
  }, []);

  function loadNotebooks() {
    return apiClient.get('/error-notebooks/student/' + userId).then(function (resp) {
      var data = resp.data || [];
      setNotebooks(Array.isArray(data) ? data : []);
    }).catch(function () {});
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      var params = {};
      if (selectedPaper) params.exam_paper_id = selectedPaper;
      var resp = await apiClient.post('/error-notebooks/generate', null, { params: params });
      message.success('错题本生成成功');
      setTimeout(function () { loadNotebooks(); }, 1000);
    } catch (e) {
      var detail = '生成失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
    setGenerating(false);
  }

  async function handleDelete(id) {
    try { await apiClient.delete('/error-notebooks/' + id); message.success('已删除'); loadNotebooks(); }
    catch (e) { message.error('删除失败'); }
  }

  return React.createElement('div', null,
    React.createElement(Card, { title: '生成纸质错题练习本', size: 'small', style: { marginBottom: 16 } },
      React.createElement(Row, { gutter: 16, align: 'middle' },
        React.createElement(Col, null, React.createElement(Text, { strong: true }, '选择试卷: ')),
        React.createElement(Col, { flex: 1 },
          React.createElement(Select, { placeholder: '全部试卷（不选则基于所有错题）', value: selectedPaper, onChange: setSelectedPaper,
            allowClear: true, style: { width: '100%', maxWidth: 400 },
            options: papers.map(function (p) { return { value: p.id, label: p.title + ' (' + (p.subject || '') + ')', }; }),
          })
        ),
        React.createElement(Col, null,
          React.createElement(Button, { type: 'primary', icon: React.createElement(PrinterOutlined), onClick: handleGenerate, loading: generating }, '生成纸质错题练习本')
        )
      )
    ),
    React.createElement(Card, { title: '已生成的错题本（' + notebooks.length + '）', size: 'small' },
      notebooks.length > 0
        ? React.createElement(Table, { rowKey: 'id', size: 'small', dataSource: notebooks, loading: loading, pagination: { pageSize: 10 },
            columns: [
              { title: '名称', dataIndex: 'title', ellipsis: true },
              { title: '题数', dataIndex: 'question_count', width: 60, align: 'center' },
              { title: '状态', dataIndex: 'status', width: 80, render: function (s) {
                var color = s === 'GENERATED' ? 'green' : s === 'DRAFT' ? 'default' : 'blue';
                return React.createElement(Tag, { color: color }, s === 'GENERATED' ? '已完成' : s === 'DRAFT' ? '生成中' : '已导出');
              }},
              { title: '时间', dataIndex: 'generated_at', width: 140, render: function (v) { return v ? v.substring(0, 16) : '-'; } },
              { title: '操作', width: 100, render: function (_, r) {
                return React.createElement(Space, null,
                  React.createElement(Button, { type: 'link', size: 'small', danger: true, icon: React.createElement(DeleteOutlined),
                    onClick: function () { handleDelete(r.id); } }, '删除')
                );
              }},
            ]
          })
        : React.createElement(Empty, { description: '暂无错题本，请先提交试卷作答或点击"生成错题本"', image: Empty.PRESENTED_IMAGE_SIMPLE })
    )
  );
}
