import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Table, Button, Input, Row, Col, Tag, message, Typography, Tree, Tabs, Select, Modal, Form, Upload } from 'antd';
import { BookOutlined, ReloadOutlined, ApartmentOutlined, SearchOutlined, PlusOutlined, ImportOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';
import KnowledgeTreePage from './KnowledgeTreePage';
import * as XLSX from 'xlsx';

const Title = Typography.Title;

export default function SyllabusPage() {
  const refData = useReferenceValues();
  const gradeOptions = toSelectOptions(refData['grade-levels']);
  const provinceOptions = toSelectOptions(refData['provinces']);
  const subjectOptions = toSelectOptions(refData['subjects']);
  const syllabiState = useState<any[]>([]); const syllabi = syllabiState[0]; const setSyllabi = syllabiState[1];
  const knowledgeTreeState = useState<any>(null); const knowledgeTree = knowledgeTreeState[0]; const setKnowledgeTree = knowledgeTreeState[1];
  const loadingState = useState(false); const loading = loadingState[0]; const setLoading = loadingState[1];
  const selectedModelState = useState(''); const selectedModel = selectedModelState[0]; const setSelectedModel = selectedModelState[1];
  const searchTitleState = useState(''); const searchTitle = searchTitleState[0]; const setSearchTitle = searchTitleState[1];
  const filterGradeState = useState(undefined); const filterGrade = filterGradeState[0]; const setFilterGrade = filterGradeState[1];
  const filterProvinceState = useState(undefined); const filterProvince = filterProvinceState[0]; const setFilterProvince = filterProvinceState[1];
  const filterStatusState = useState(undefined); const filterStatus = filterStatusState[0]; const setFilterStatus = filterStatusState[1];
  const createOpenState = useState(false); const createOpen = createOpenState[0]; const setCreateOpen = createOpenState[1];
  const importOpenState = useState(false); const importOpen = importOpenState[0]; const setImportOpen = importOpenState[1];
  const importJsonState = useState(''); const importJson = importJsonState[0]; const setImportJson = importJsonState[1];
  const createFormRef = useRef(null);

  useEffect(function () {
    loadSyllabi();
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSyllabi = async function () {
    try { const r = await apiClient.get('/question-admin/syllabi'); setSyllabi(r.data); } catch {}
  };
  const loadModel = async function () {
    try {
      const r = await apiClient.get('/admin/llm/config');
      setSelectedModel(r.data.model || '');
    } catch {}
  };

  const handleCreateSyllabus = async function (values: any) {
    try {
      await apiClient.post('/question-admin/syllabi', null, { params: values });
      message.success('考纲创建成功');
      setCreateOpen(false);
      loadSyllabi();
    } catch { message.error('创建失败'); }
  };

  const handleDownloadTemplate = function () {
    const header = ['title', 'grade_level', 'province', 'subject'];
    const example = ['示例考纲标题', gradeOptions.length > 0 ? gradeOptions[0].value : '', provinceOptions.length > 0 ? provinceOptions[0].value : '', subjectOptions.length > 0 ? subjectOptions[0].value : ''];
    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '考纲导入模板');
    XLSX.writeFile(wb, 'syllabus_import_template.xlsx');
  };

  const handleUploadExcel = function (file: any) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) { message.warning('模板为空或格式不正确'); return; }
        const headers = rows[0] as any[];
        const dataRows = rows.slice(1).filter(function (r: any) { return r[0] || r[1] || r[2] || r[3]; });
        const result = dataRows.map(function (r: any) {
          const obj: Record<string, any> = {};
          headers.forEach(function (h: any, i: number) { if (h && r[i] !== undefined && r[i] !== '') obj[h] = String(r[i]); });
          return obj;
        });
        setImportJson(JSON.stringify(result, null, 2));
        message.success('已加载 ' + result.length + ' 条考纲');
      } catch { message.error('Excel 解析失败'); }
    };
    reader.readAsBinaryString(file);
    return false; // prevent upload
  };

  const handleImportSyllabi = async function () {
    let items;
    try { items = JSON.parse(importJson); } catch { message.error('JSON 格式无效'); return; }
    if (!Array.isArray(items)) { message.error('请输入 JSON 数组'); return; }
    let ok = 0;
    for (let i = 0; i < items.length; i++) {
      try {
        await apiClient.post('/question-admin/syllabi', null, { params: items[i] });
        ok++;
      } catch {}
    }
    message.success('成功导入 ' + ok + ' / ' + items.length + ' 条考纲');
    setImportOpen(false);
    setImportJson('');
    loadSyllabi();
  };

  const handleExtractKnowledge = async function (syllabusId: string) {
    setLoading(true);
    try {
      const r = await apiClient.post('/question-admin/syllabi/' + syllabusId + '/extract-knowledge',
        null, { params: { model_config_id: selectedModel } });
      setKnowledgeTree(r.data.knowledge_tree);
      message.success('知识点提取完成');
      loadSyllabi();
    } catch { message.error('提取失败'); }
    setLoading(false);
  };

  const gradeLabelMap = useMemo(function () {
    const m: Record<string, any> = {};
    refData['grade-levels'].forEach(function (g: any) { m[g.code] = g.name; });
    return m;
  }, [refData]);
  const provinceLabelMap = useMemo(function () {
    const m: Record<string, any> = {};
    refData['provinces'].forEach(function (p: any) { m[p.code] = p.name; });
    return m;
  }, [refData]);

  const renderTree = function (nodes: any): any {
    if (!nodes || !Array.isArray(nodes)) return null;
    return nodes.map(function (n: any) {
      return {
        title: (
          <span>
            {n.label || n.name || n.id}
            {n.status ? <Tag color={n.status === 'INACTIVE' ? 'red' : 'green'} style={{ marginLeft: 8, fontSize: 10 }}>{n.status}</Tag> : null}
          </span>
        ),
        key: n.id,
        children: n.children ? renderTree(n.children) : undefined,
      };
    });
  };

  const filteredSyllabi = useMemo(function () {
    return syllabi.filter(function (s: any) {
      if (searchTitle && !(s.title || '').toLowerCase().includes(searchTitle.toLowerCase())) return false;
      if (filterGrade && s.grade_level !== filterGrade) return false;
      if (filterProvince && s.province !== filterProvince) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      return true;
    });
  }, [syllabi, searchTitle, filterGrade, filterProvince, filterStatus]);

  const syllabusContent = (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="考纲列表" size="small">
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); }}>新建考纲</Button>
              <Button size="small" icon={<ImportOutlined />} onClick={() => { setImportOpen(true); }}>导入考纲</Button>
            </div>
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Input placeholder="搜索标题" prefix={<SearchOutlined />} value={searchTitle} onChange={(e) => { setSearchTitle(e.target.value); }} allowClear style={{ width: 180 }} size="small" />
              <Select placeholder="年级" value={filterGrade} onChange={setFilterGrade as any} allowClear style={{ width: 100 }} size="small" options={gradeOptions} />
              <Select placeholder="省份" value={filterProvince} onChange={setFilterProvince as any} allowClear style={{ width: 100 }} size="small" options={provinceOptions} />
              <Select placeholder="状态" value={filterStatus} onChange={setFilterStatus as any} allowClear style={{ width: 90 }} size="small" options={[{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }]} />
            </div>
            <Table
              rowKey="id"
              dataSource={filteredSyllabi}
              pagination={false}
              size="small"
              columns={[
                { title: '标题', dataIndex: 'title', ellipsis: true },
                { title: '年级', dataIndex: 'grade_level', width: 80, render: function (v: any) { return gradeLabelMap[v] || v || '-'; } },
                { title: '省份', dataIndex: 'province', width: 80, render: function (v: any) { return provinceLabelMap[v] || v || '-'; } },
                { title: '状态', dataIndex: 'status', width: 80, render: (s: any) => <Tag>{s}</Tag> },
                { title: '操作', width: 120, render: (_: any, r: any) => {
                  return <Button size="small" onClick={() => { handleExtractKnowledge(r.id); }} loading={loading} icon={<ReloadOutlined />}>提取知识点</Button>;
                }},
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="知识树" size="small" style={{ minHeight: 400 }}>
            {knowledgeTree
              ? <Tree treeData={renderTree(knowledgeTree)} defaultExpandAll />
              : <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>选择考纲点击"提取知识点"生成知识树</div>
            }
          </Card>
        </Col>
      </Row>
      {/* 新建考纲 Modal */}
      <Modal title="新建考纲" open={createOpen} onCancel={() => { setCreateOpen(false); }} footer={null} destroyOnClose>
        <Form ref={createFormRef} onFinish={handleCreateSyllabus} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如: 八年级数学(上海)" size="small" />
          </Form.Item>
          <Form.Item name="grade_level" label="年级">
            <Select placeholder="选择年级" size="small" options={gradeOptions} />
          </Form.Item>
          <Form.Item name="province" label="省份">
            <Select placeholder="选择省份" size="small" options={provinceOptions} />
          </Form.Item>
          <Form.Item name="subject" label="学科">
            <Select placeholder="选择学科" size="small" options={subjectOptions} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="small" block>创建考纲</Button>
          </Form.Item>
        </Form>
      </Modal>
      {/* 导入考纲 Modal */}
      <Modal title="导入考纲" open={importOpen} onCancel={() => { setImportOpen(false); setImportJson(''); }} onOk={handleImportSyllabi} okText="批量导入" destroyOnClose width={650}>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模板</Button>
          <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleUploadExcel}>
            <Button size="small" icon={<UploadOutlined />}>打开模板</Button>
          </Upload>
          <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>下载模板 → 填写 → 打开上传 → 导入</span>
        </div>
        <div style={{ marginBottom: 8, fontSize: 11, color: '#999' }}>年级: {gradeOptions.map(function(g) { return g.value + '=' + g.label; }).join(', ')}</div>
        <div style={{ marginBottom: 12, fontSize: 11, color: '#999' }}>省份: {provinceOptions.map(function(p) { return p.value + '=' + p.label; }).join(', ')}</div>
        <Input.TextArea rows={10} value={importJson} onChange={(e) => { setImportJson(e.target.value); }} placeholder={'下载模板填写后用"打开模板"上传，或直接粘贴 JSON 数组'} style={{ fontFamily: 'monospace', fontSize: 12 }} />
      </Modal>
    </div>
  );

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <BookOutlined style={{ marginRight: 8 }} />考纲与知识树
      </Title>
      <Tabs
        defaultActiveKey="syllabus"
        items={[
          { key: 'syllabus', label: <span><BookOutlined /> 考纲管理</span>, children: syllabusContent },
          { key: 'knowledge-tree', label: <span><ApartmentOutlined /> 知识树</span>, children: <KnowledgeTreePage /> },
        ]}
      />
    </div>
  );
}
