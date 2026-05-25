import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Table, Button, Input, Row, Col, Tag, message, Typography, Tree, Tabs, Select, Modal, Form, Upload } from 'antd';
import { BookOutlined, ReloadOutlined, ApartmentOutlined, SearchOutlined, PlusOutlined, ImportOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';
import KnowledgeTreePage from './KnowledgeTreePage';
import * as XLSX from 'xlsx';

var Title = Typography.Title;

export default function SyllabusPage() {
  var refData = useReferenceValues();
  var gradeOptions = toSelectOptions(refData['grade-levels']);
  var provinceOptions = toSelectOptions(refData['provinces']);
  var subjectOptions = toSelectOptions(refData['subjects']);
  var syllabiState = useState([]); var syllabi = syllabiState[0]; var setSyllabi = syllabiState[1];
  var knowledgeTreeState = useState(null); var knowledgeTree = knowledgeTreeState[0]; var setKnowledgeTree = knowledgeTreeState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var selectedModelState = useState(''); var selectedModel = selectedModelState[0]; var setSelectedModel = selectedModelState[1];
  var searchTitleState = useState(''); var searchTitle = searchTitleState[0]; var setSearchTitle = searchTitleState[1];
  var filterGradeState = useState(undefined); var filterGrade = filterGradeState[0]; var setFilterGrade = filterGradeState[1];
  var filterProvinceState = useState(undefined); var filterProvince = filterProvinceState[0]; var setFilterProvince = filterProvinceState[1];
  var filterStatusState = useState(undefined); var filterStatus = filterStatusState[0]; var setFilterStatus = filterStatusState[1];
  var createOpenState = useState(false); var createOpen = createOpenState[0]; var setCreateOpen = createOpenState[1];
  var importOpenState = useState(false); var importOpen = importOpenState[0]; var setImportOpen = importOpenState[1];
  var importJsonState = useState(''); var importJson = importJsonState[0]; var setImportJson = importJsonState[1];
  var createFormRef = useRef(null);

  useEffect(function () {
    loadSyllabi();
    loadModel();
  }, []);

  var loadSyllabi = async function () {
    try { var r = await apiClient.get('/question-admin/syllabi'); setSyllabi(r.data); } catch (e) {}
  };
  var loadModel = async function () {
    try {
      var r = await apiClient.get('/admin/llm/config');
      var models = r.data.available_models || [];
      setSelectedModel(r.data.model || '');
    } catch (e) {}
  };

  var handleCreateSyllabus = async function (values) {
    try {
      await apiClient.post('/question-admin/syllabi', null, { params: values });
      message.success('考纲创建成功');
      setCreateOpen(false);
      loadSyllabi();
    } catch (e) { message.error('创建失败'); }
  };

  var handleDownloadTemplate = function () {
    var header = ['title', 'grade_level', 'province', 'subject'];
    var example = ['示例考纲标题', gradeOptions.length > 0 ? gradeOptions[0].value : '', provinceOptions.length > 0 ? provinceOptions[0].value : '', subjectOptions.length > 0 ? subjectOptions[0].value : ''];
    var ws = XLSX.utils.aoa_to_sheet([header, example]);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '考纲导入模板');
    XLSX.writeFile(wb, 'syllabus_import_template.xlsx');
  };

  var handleUploadExcel = function (file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(e.target.result, { type: 'binary' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) { message.warning('模板为空或格式不正确'); return; }
        var headers = rows[0];
        var dataRows = rows.slice(1).filter(function (r) { return r[0] || r[1] || r[2] || r[3]; });
        var result = dataRows.map(function (r) {
          var obj = {};
          headers.forEach(function (h, i) { if (h && r[i] !== undefined && r[i] !== '') obj[h] = String(r[i]); });
          return obj;
        });
        setImportJson(JSON.stringify(result, null, 2));
        message.success('已加载 ' + result.length + ' 条考纲');
      } catch (err) { message.error('Excel 解析失败'); }
    };
    reader.readAsBinaryString(file);
    return false; // prevent upload
  };

  var handleImportSyllabi = async function () {
    var items;
    try { items = JSON.parse(importJson); } catch (e) { message.error('JSON 格式无效'); return; }
    if (!Array.isArray(items)) { message.error('请输入 JSON 数组'); return; }
    var ok = 0;
    for (var i = 0; i < items.length; i++) {
      try {
        await apiClient.post('/question-admin/syllabi', null, { params: items[i] });
        ok++;
      } catch (e) {}
    }
    message.success('成功导入 ' + ok + ' / ' + items.length + ' 条考纲');
    setImportOpen(false);
    setImportJson('');
    loadSyllabi();
  };

  var handleExtractKnowledge = async function (syllabusId) {
    setLoading(true);
    try {
      var r = await apiClient.post('/question-admin/syllabi/' + syllabusId + '/extract-knowledge',
        null, { params: { model_config_id: selectedModel } });
      setKnowledgeTree(r.data.knowledge_tree);
      message.success('知识点提取完成');
      loadSyllabi();
    } catch (e) { message.error('提取失败'); }
    setLoading(false);
  };

  var gradeLabelMap = useMemo(function () {
    var m = {};
    refData['grade-levels'].forEach(function (g) { m[g.code] = g.name; });
    return m;
  }, [refData]);
  var provinceLabelMap = useMemo(function () {
    var m = {};
    refData['provinces'].forEach(function (p) { m[p.code] = p.name; });
    return m;
  }, [refData]);
  var subjectLabelMap = useMemo(function () {
    var m = {};
    refData['subjects'].forEach(function (s) { m[s.code] = s.name; });
    return m;
  }, [refData]);

  var renderTree = function (nodes) {
    if (!nodes || !Array.isArray(nodes)) return null;
    return nodes.map(function (n) {
      return {
        title: React.createElement('span', null, n.label || n.name || n.id,
          n.status ? React.createElement(Tag, { color: n.status === 'INACTIVE' ? 'red' : 'green', style: { marginLeft: 8, fontSize: 10 } }, n.status) : null
        ),
        key: n.id,
        children: n.children ? renderTree(n.children) : undefined,
      };
    });
  };

  var filteredSyllabi = useMemo(function () {
    return syllabi.filter(function (s) {
      if (searchTitle && !(s.title || '').toLowerCase().includes(searchTitle.toLowerCase())) return false;
      if (filterGrade && s.grade_level !== filterGrade) return false;
      if (filterProvince && s.province !== filterProvince) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      return true;
    });
  }, [syllabi, searchTitle, filterGrade, filterProvince, filterStatus]);

  var syllabusContent = React.createElement('div', null,
    React.createElement(Row, { gutter: 16 },
      React.createElement(Col, { span: 12 },
        React.createElement(Card, { title: '考纲列表', size: 'small' },
          React.createElement('div', { style: { marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            React.createElement(Button, { type: 'primary', size: 'small', icon: React.createElement(PlusOutlined), onClick: function () { setCreateOpen(true); } }, '新建考纲'),
            React.createElement(Button, { size: 'small', icon: React.createElement(ImportOutlined), onClick: function () { setImportOpen(true); } }, '导入考纲')
          ),
          React.createElement('div', { style: { marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            React.createElement(Input, { placeholder: '搜索标题', prefix: React.createElement(SearchOutlined), value: searchTitle, onChange: function (e) { setSearchTitle(e.target.value); }, allowClear: true, style: { width: 180 }, size: 'small' }),
            React.createElement(Select, { placeholder: '年级', value: filterGrade, onChange: setFilterGrade, allowClear: true, style: { width: 100 }, size: 'small', options: gradeOptions }),
            React.createElement(Select, { placeholder: '省份', value: filterProvince, onChange: setFilterProvince, allowClear: true, style: { width: 100 }, size: 'small', options: provinceOptions }),
            React.createElement(Select, { placeholder: '状态', value: filterStatus, onChange: setFilterStatus, allowClear: true, style: { width: 90 }, size: 'small', options: [{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }] })
          ),
          React.createElement(Table, {
            rowKey: 'id', dataSource: filteredSyllabi, pagination: false, size: 'small',
            columns: [
              { title: '标题', dataIndex: 'title', ellipsis: true },
              { title: '年级', dataIndex: 'grade_level', width: 80, render: function (v) { return gradeLabelMap[v] || v || '-'; } },
              { title: '省份', dataIndex: 'province', width: 80, render: function (v) { return provinceLabelMap[v] || v || '-'; } },
              { title: '状态', dataIndex: 'status', width: 80, render: function (s) { return React.createElement(Tag, null, s); } },
              { title: '操作', width: 120, render: function (_, r) {
                return React.createElement(Button, { size: 'small', onClick: function () { handleExtractKnowledge(r.id); }, loading: loading, icon: React.createElement(ReloadOutlined) }, '提取知识点');
              }},
            ]
          })
        )
      ),
      React.createElement(Col, { span: 12 },
        React.createElement(Card, { title: '知识树', size: 'small', style: { minHeight: 400 } },
          knowledgeTree
            ? React.createElement(Tree, { treeData: renderTree(knowledgeTree), defaultExpandAll: true })
            : React.createElement('div', { style: { textAlign: 'center', color: '#999', padding: 40 } }, '选择考纲点击"提取知识点"生成知识树')
        )
      )
    ),
    // 新建考纲 Modal
    React.createElement(Modal, { title: '新建考纲', open: createOpen, onCancel: function () { setCreateOpen(false); }, footer: null, destroyOnClose: true },
      React.createElement(Form, { ref: createFormRef, onFinish: handleCreateSyllabus, layout: 'vertical' },
        React.createElement(Form.Item, { name: 'title', label: '标题', rules: [{ required: true, message: '请输入标题' }] },
          React.createElement(Input, { placeholder: '如: 八年级数学(上海)', size: 'small' })
        ),
        React.createElement(Form.Item, { name: 'grade_level', label: '年级' },
          React.createElement(Select, { placeholder: '选择年级', size: 'small', options: gradeOptions })
        ),
        React.createElement(Form.Item, { name: 'province', label: '省份' },
          React.createElement(Select, { placeholder: '选择省份', size: 'small', options: provinceOptions })
        ),
        React.createElement(Form.Item, { name: 'subject', label: '学科' },
          React.createElement(Select, { placeholder: '选择学科', size: 'small', options: subjectOptions })
        ),
        React.createElement(Form.Item, null,
          React.createElement(Button, { type: 'primary', htmlType: 'submit', size: 'small', block: true }, '创建考纲')
        )
      )
    ),
    // 导入考纲 Modal
    React.createElement(Modal, { title: '导入考纲', open: importOpen, onCancel: function () { setImportOpen(false); setImportJson(''); }, onOk: handleImportSyllabi, okText: '批量导入', destroyOnClose: true, width: 650 },
      React.createElement('div', { style: { marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' } },
        React.createElement(Button, { size: 'small', icon: React.createElement(DownloadOutlined), onClick: handleDownloadTemplate }, '下载模板'),
        React.createElement(Upload, { accept: '.xlsx,.xls', showUploadList: false, beforeUpload: handleUploadExcel },
          React.createElement(Button, { size: 'small', icon: React.createElement(UploadOutlined) }, '打开模板')
        ),
        React.createElement('span', { style: { fontSize: 12, color: '#999', marginLeft: 'auto' } }, '下载模板 → 填写 → 打开上传 → 导入')
      ),
      React.createElement('div', { style: { marginBottom: 8, fontSize: 11, color: '#999' } }, '年级: ' + gradeOptions.map(function(g) { return g.value + '=' + g.label; }).join(', ')),
      React.createElement('div', { style: { marginBottom: 12, fontSize: 11, color: '#999' } }, '省份: ' + provinceOptions.map(function(p) { return p.value + '=' + p.label; }).join(', ')),
      React.createElement(Input.TextArea, { rows: 10, value: importJson, onChange: function (e) { setImportJson(e.target.value); }, placeholder: '下载模板填写后用"打开模板"上传，或直接粘贴 JSON 数组', style: { fontFamily: 'monospace', fontSize: 12 } })
    )
  );

  return React.createElement('div', null,
    React.createElement(Title, { level: 4, style: { marginBottom: 16 } },
      React.createElement(BookOutlined, { style: { marginRight: 8 } }), '考纲与知识树'
    ),
    React.createElement(Tabs, {
      defaultActiveKey: 'syllabus',
      items: [
        { key: 'syllabus', label: React.createElement('span', null, React.createElement(BookOutlined, null), ' 考纲管理'), children: syllabusContent },
        { key: 'knowledge-tree', label: React.createElement('span', null, React.createElement(ApartmentOutlined, null), ' 知识树'), children: React.createElement(KnowledgeTreePage, null) },
      ]
    })
  );
}
