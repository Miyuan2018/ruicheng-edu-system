import { useState, useEffect } from 'react';
import { Tabs, Card, Form, InputNumber, Select, Button, message, Typography, Space, Input, Table, Tag, Popconfirm, Modal } from 'antd';
import { SaveOutlined, PlusOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

const { Title } = Typography;

export default function BasicConfigPage() {
  const [form] = Form.useForm();
  const [gradingLoading, setGradingLoading] = useState(false);
  const [mistakeLoading, setMistakeLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // ─── 学科管理 state ───
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [subForm] = Form.useForm();

  const loadSubjects = async () => {
    try { const { data } = await apiClient.get('/subjects/all'); setSubjects(data); } catch {}
  };
  useEffect(() => { loadSubjects(); }, []);

  const handleAddSubject = () => { setEditingSubject(null); subForm.resetFields(); setSubModalOpen(true); };
  const handleEditSubject = (s: any) => { setEditingSubject(s); subForm.setFieldsValue(s); setSubModalOpen(true); };
  const handleSubSubmit = async () => {
    const values = await subForm.validateFields();
    try {
      if (editingSubject) {
        await apiClient.put(`/subjects/${editingSubject.id}`, null, { params: values });
        message.success('已更新');
      } else {
        await apiClient.post('/subjects', null, { params: values });
        message.success('已添加');
      }
      setSubModalOpen(false); loadSubjects();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '操作失败';
      message.error(detail);
    }
  };
  const handleDeleteSubject = async (id: string) => {
    try { await apiClient.delete(`/subjects/${id}`); message.success('已停用'); loadSubjects(); }
    catch (err: any) {
      const detail = err?.response?.data?.detail || '操作失败';
      message.error(detail);
    }
  };
  const handleRestoreSubject = async (id: string) => {
    try {
      await apiClient.put(`/subjects/${id}`, null, { params: { is_active: true } });
      message.success('已启用'); loadSubjects();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '操作失败';
      message.error(detail);
    }
  };

  // ─── 年级管理 state ───
  const [grades, setGrades] = useState<any[]>([]);
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [gradeForm] = Form.useForm();

  const loadGrades = async () => {
    try { const { data } = await apiClient.get('/reference/grade-levels'); setGrades(data); } catch {}
  };
  useEffect(() => { loadGrades(); }, []);

  const handleAddGrade = () => { setEditingGrade(null); gradeForm.resetFields(); setGradeModalOpen(true); };
  const handleEditGrade = (g: any) => { setEditingGrade(g); gradeForm.setFieldsValue(g); setGradeModalOpen(true); };
  const handleGradeSubmit = async () => {
    const values = await gradeForm.validateFields();
    try {
      if (editingGrade) {
        await apiClient.put(`/reference/grade-levels/${editingGrade.id}`, null, { params: values });
        message.success('已更新');
      } else {
        await apiClient.post('/reference/grade-levels', null, { params: values });
        message.success('已添加');
      }
      setGradeModalOpen(false); loadGrades();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '操作失败';
      message.error(detail);
    }
  };
  const handleDeleteGrade = async (id: string) => {
    try { await apiClient.delete(`/reference/grade-levels/${id}`); message.success('已停用'); loadGrades(); }
    catch (err: any) { message.error(err?.response?.data?.detail || '操作失败'); }
  };
  const handleRestoreGrade = async (id: string) => {
    try {
      await apiClient.put(`/reference/grade-levels/${id}`, null, { params: { is_active: true } });
      message.success('已启用'); loadGrades();
    } catch (err: any) { message.error(err?.response?.data?.detail || '操作失败'); }
  };

  // ─── 应用参数 save ───
  const setLoading = (section: string, v: boolean) => {
    if (section === 'grading') setGradingLoading(v);
    else if (section === 'mistake') setMistakeLoading(v);
    else if (section === 'export') setExportLoading(v);
  };

  const handleSave = async (section: string) => {
    const allValues = form.getFieldsValue();
    setLoading(section, true);
    try {
      if (section === 'export') {
        await apiClient.put('/admin/llm/export-max', null, { params: { max_val: allValues.export_max } });
        message.success('导出上限已保存');
      } else {
        const sectionFields: Record<string, string[]> = {
          grading: ['max_concurrent_grading', 'grading_model'],
          mistake: ['practice_question_count'],
        };
        const fields = sectionFields[section] || [];
        const payload: any = { section };
        fields.forEach(f => { if (allValues[f] !== undefined) payload[f] = allValues[f]; });
        await apiClient.put('/admin/llm/section-config', payload);
        message.success('保存成功');
      }
    } catch { message.error('保存失败'); }
    finally { setLoading(section, false); }
  };

  // Load export_max
  useEffect(() => {
    apiClient.get('/admin/llm/export-max').then(({ data }) => {
      form.setFieldValue('export_max', data.export_max ?? 200);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Tab: 学科管理 ───
  const subjectTab = (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 500 }}>学科列表</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSubject}>添加学科</Button>
      </div>
      <Table rowKey="id" dataSource={subjects} pagination={false} size="small" columns={[
        { title: '学科名称', dataIndex: 'name' },
        { title: '分类', dataIndex: 'category', width: 80 },
        { title: '状态', dataIndex: 'is_active', width: 80,
          render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '停用'}</Tag> },
        { title: '操作', width: 140,
          render: (_: any, r: any) => (
            <Space>
              <Button size="small" onClick={() => handleEditSubject(r)}>编辑</Button>
              {r.is_active ? (
                <Popconfirm title="确定停用?" onConfirm={() => handleDeleteSubject(r.id)}>
                  <Button size="small" danger>停用</Button>
                </Popconfirm>
              ) : (
                <Popconfirm title="确定启用?" onConfirm={() => handleRestoreSubject(r.id)}>
                  <Button size="small" type="primary">启用</Button>
                </Popconfirm>
              )}
            </Space>
          )},
      ]} />
      <Modal title={editingSubject ? '编辑学科' : '添加学科'} open={subModalOpen}
        onOk={handleSubSubmit} onCancel={() => setSubModalOpen(false)}>
        <Form form={subForm} layout="vertical">
          <Form.Item name="name" label="学科名称" rules={[{ required: true }]}>
            <Input placeholder="如: 数学" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select allowClear options={[
              { value: '理科', label: '理科' }, { value: '文科', label: '文科' }, { value: '其他', label: '其他' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  // ─── Tab: 应用参数 ───
  const appParamsTab = (
    <div>
      {/* 判卷设置 */}
      <Card title="判卷设置" size="small" style={{ marginBottom: 16 }} extra={
        <Button icon={<SaveOutlined />} onClick={() => handleSave('grading')} loading={gradingLoading}>保存</Button>
      }>
        <Space size="large" wrap>
          <Form.Item name="max_concurrent_grading" label="最大并发判卷数">
            <InputNumber min={1} max={50} />
          </Form.Item>
          <Form.Item name="grading_model" label="判卷模型">
            <Select style={{ width: 150 }} options={[
              { value: 'rule', label: '规则匹配' },
              { value: 'llm', label: 'LLM 语义评分' },
              { value: 'hybrid', label: '混合模式' },
            ]} />
          </Form.Item>
        </Space>
      </Card>

      {/* 错题本设置 */}
      <Card title="错题本设置" size="small" style={{ marginBottom: 16 }} extra={
        <Button icon={<SaveOutlined />} onClick={() => handleSave('mistake')} loading={mistakeLoading}>保存</Button>
      }>
        <Form.Item name="practice_question_count" label="每道错题配加强练习题数量" style={{ marginBottom: 0 }}>
          <InputNumber min={1} max={20} />
        </Form.Item>
      </Card>

      {/* 试题导出上限 */}
      <Card title="试题导出上限" size="small" extra={
        <Button icon={<SaveOutlined />} onClick={() => handleSave('export')} loading={exportLoading}>保存</Button>
      }>
        <Form.Item name="export_max" label="最大导出数量" style={{ marginBottom: 0 }}
          tooltip="设为0时禁用导出功能">
          <InputNumber min={0} max={1000} style={{ width: 120 }} addonAfter="条" />
        </Form.Item>
      </Card>
    </div>
  );

  // ─── Tab: 年级管理 ───
  const gradeTab = (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 500 }}>年级列表</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddGrade}>添加年级</Button>
      </div>
      <Table rowKey="id" dataSource={grades} pagination={false} size="small" columns={[
        { title: '编码', dataIndex: 'code', width: 80 },
        { title: '名称', dataIndex: 'name' },
        { title: '排序', dataIndex: 'sort_order', width: 60, align: 'center' },
        { title: '状态', dataIndex: 'is_active', width: 70,
          render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '停用'}</Tag> },
        { title: '操作', width: 140,
          render: (_: any, r: any) => (
            <Space>
              <Button size="small" onClick={() => handleEditGrade(r)}>编辑</Button>
              {r.is_active ? (
                <Popconfirm title="确定停用?" onConfirm={() => handleDeleteGrade(r.id)}>
                  <Button size="small" danger>停用</Button>
                </Popconfirm>
              ) : (
                <Popconfirm title="确定启用?" onConfirm={() => handleRestoreGrade(r.id)}>
                  <Button size="small" type="primary">启用</Button>
                </Popconfirm>
              )}
            </Space>
          )},
      ]} />
      <Modal title={editingGrade ? '编辑年级' : '添加年级'} open={gradeModalOpen}
        onOk={handleGradeSubmit} onCancel={() => setGradeModalOpen(false)}>
        <Form form={gradeForm} layout="vertical">
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input placeholder="如: G5" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如: 五年级" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} style={{ width: 100 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  return (
    <div>
      <Title level={4}>应用参数</Title>
      <Form form={form} layout="vertical" initialValues={{
        max_concurrent_grading: 10,
        practice_question_count: 5,
        export_max: 200,
        grading_model: 'rule',
      }}>
        <Tabs
          defaultActiveKey="subjects"
          items={[
            { key: 'subjects', label: '学科管理', children: subjectTab },
            { key: 'grades', label: '年级管理', children: gradeTab },
            { key: 'app-params', label: '应用参数', children: appParamsTab },
          ]}
        />
      </Form>
    </div>
  );
}
