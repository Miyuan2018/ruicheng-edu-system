import { useState, useEffect } from 'react';
import { Card, Form, InputNumber, Select, Switch, Button, message, Typography, Space, Input, Table, Tag, Popconfirm, Modal } from 'antd';
import { SaveOutlined, ApiOutlined, ThunderboltOutlined, PlusOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

const { Title } = Typography;

export default function AdminConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [llmLoading, setLlmLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    apiClient.get('/admin/llm/config').then(({ data }) => {
      if (data.endpoint) form.setFieldValue('llm_endpoint', data.endpoint);
      if (data.model) form.setFieldValue('llm_model', data.model);
      if (data.available_models?.length) setModels(data.available_models);
    }).catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    const endpoint = form.getFieldValue('llm_endpoint');
    if (!endpoint) { message.warning('请先输入Ollama访问地址'); return; }
    setLlmLoading(true); setTestResult('');
    try {
      const { data } = await apiClient.post('/admin/llm/config/test', { endpoint });
      if (data.ok) {
        setModels(data.models || []);
        setTestResult(`连接成功，发现 ${data.models?.length || 0} 个模型`);
        message.success(data.message || '连接成功');
      } else {
        setTestResult(data.error || '连接失败');
        message.error(data.error || '连接失败');
      }
    } catch (err: any) { message.error('连接测试失败'); }
    finally { setLlmLoading(false); }
  };

  const handleSaveLlm = async () => {
    const endpoint = form.getFieldValue('llm_endpoint');
    const model = form.getFieldValue('llm_model');
    if (!endpoint) { message.warning('请输入访问地址'); return; }
    if (!model) { message.warning('请选择模型'); return; }
    setLlmLoading(true);
    try {
      await apiClient.put('/admin/llm/config', { provider: 'ollama', endpoint, model });
      message.success('大模型配置已保存');
    } catch { message.error('保存失败'); }
    finally { setLlmLoading(false); }
  };

  const handleSave = async (section: string) => {
    const values = form.getFieldsValue();
    setLoading(true);
    try {
      await apiClient.put('/admin/config', { section, ...values });
      message.success(`${section} 配置已保存`);
    } catch { message.error('保存失败'); }
    finally { setLoading(false); }
  };

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
    } catch { message.error('操作失败'); }
  };
  const handleDeleteSubject = async (id: string) => {
    try { await apiClient.delete(`/subjects/${id}`); message.success('已停用'); loadSubjects(); }
    catch { message.error('操作失败'); }
  };

  const handleSaveExportMax = async () => {
    const max = form.getFieldValue('export_max');
    try {
      await apiClient.put('/admin/llm/export-max', null, { params: { max_val: max } });
      message.success('导出上限已保存');
    } catch { message.error('保存失败'); }
  };

  // Load export_max
  useEffect(() => {
    apiClient.get('/admin/llm/export-max').then(({ data }) => {
      form.setFieldValue('export_max', data.export_max ?? 200);
    }).catch(() => {});
  }, []);

  return (
    <div>
      <Title level={4}>系统配置</Title>

      <Form form={form} layout="vertical" initialValues={{
        llm_endpoint: undefined,
        llm_model: undefined,
        max_concurrent_grading: 10,
        max_concurrent_ocr: 5,
        ocr_confidence_threshold: 0.8,
        practice_question_count: 5,
        log_level: 'INFO',
        backup_enabled: true,
        export_max: 200,
        ocr_engine: 'paddleocr',
        grading_model: 'rule',
      }}>

        {/* ─── LLM Configuration ─── */}
        <Card title={<span><ThunderboltOutlined /> 大模型配置 (Ollama)</span>} size="small"
          style={{ marginBottom: 16, border: '1px solid #1890ff' }}
          extra={<Button icon={<SaveOutlined />} onClick={handleSaveLlm} loading={llmLoading}>保存</Button>}>
          <Form.Item label="Ollama 访问地址">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="llm_endpoint" noStyle>
                <Input placeholder="http://127.0.0.1:11434/v1" style={{ flex: 1 }} />
              </Form.Item>
              <Button icon={<ApiOutlined />} onClick={handleTestConnection} loading={llmLoading}>测试连接</Button>
            </Space.Compact>
          </Form.Item>
          {testResult && (
            <div style={{ marginBottom: 12, padding: '4px 8px', background: testResult.includes('成功') ? '#f6ffed' : '#fff2f0', borderRadius: 4, fontSize: 13 }}>
              {testResult}
            </div>
          )}
          <Form.Item label="模型选择">
            <Form.Item name="llm_model" noStyle>
              <Select placeholder="请先测试连接获取模型列表" options={models.map(m => ({ value: m, label: m }))} />
            </Form.Item>
          </Form.Item>
        </Card>

        {/* ─── Subject Management ─── */}
        <Card title="学科管理" size="small" style={{ marginBottom: 16 }}
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAddSubject}>添加学科</Button>}>
          <Table rowKey="id" dataSource={subjects} pagination={false} size="small" columns={[
            { title: '学科名称', dataIndex: 'name' },
            { title: '分类', dataIndex: 'category', width: 80 },
            { title: '状态', dataIndex: 'is_active', width: 80,
              render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '停用'}</Tag> },
            { title: '操作', width: 120,
              render: (_: any, r: any) => (
                <Space>
                  <Button size="small" onClick={() => handleEditSubject(r)}>编辑</Button>
                  <Popconfirm title="确定停用?" onConfirm={() => handleDeleteSubject(r.id)}>
                    <Button size="small" danger>停用</Button>
                  </Popconfirm>
                </Space>
              )},
          ]} />
        </Card>

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

        {/* ─── Grading ─── */}
        <Card title="判卷设置" size="small" style={{ marginBottom: 16 }} extra={
          <Button icon={<SaveOutlined />} onClick={() => handleSave('grading')} loading={loading}>保存</Button>
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

        {/* ─── OCR ─── */}
        <Card title="OCR 设置" size="small" style={{ marginBottom: 16 }} extra={
          <Button icon={<SaveOutlined />} onClick={() => handleSave('ocr')} loading={loading}>保存</Button>
        }>
          <Space size="large" wrap>
            <Form.Item name="ocr_engine" label="OCR 引擎">
              <Select style={{ width: 150 }} options={[
                { value: 'paddleocr', label: 'PaddleOCR' },
                { value: 'tesseract', label: 'Tesseract' },
              ]} />
            </Form.Item>
            <Form.Item name="max_concurrent_ocr" label="最大并发 OCR">
              <InputNumber min={1} max={20} />
            </Form.Item>
            <Form.Item name="ocr_confidence_threshold" label="OCR 置信度阈值">
              <InputNumber min={0} max={1} step={0.05} />
            </Form.Item>
          </Space>
        </Card>

        {/* ─── Mistake Book ─── */}
        <Card title="错题本设置" size="small" style={{ marginBottom: 16 }} extra={
          <Button icon={<SaveOutlined />} onClick={() => handleSave('mistake')} loading={loading}>保存</Button>
        }>
          <Form.Item name="practice_question_count" label="每道错题配加强练习题数量" style={{ marginBottom: 0 }}>
            <InputNumber min={1} max={20} />
          </Form.Item>
        </Card>

        {/* ─── System ─── */}
        <Card title="系统设置" size="small" style={{ marginBottom: 16 }} extra={
          <Button icon={<SaveOutlined />} onClick={() => { handleSave('system'); handleSaveExportMax(); }} loading={loading}>保存全部</Button>
        }>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Form.Item name="export_max" label="试题导出上限" style={{ marginBottom: 0 }}
              tooltip="设为0时禁用导出功能">
              <InputNumber min={0} max={1000} style={{ width: 120 }} addonAfter="条" />
            </Form.Item>
            <Form.Item name="log_level" label="日志级别" style={{ marginBottom: 0 }}>
              <Select style={{ width: 120 }} options={[
                { value: 'DEBUG', label: 'DEBUG' }, { value: 'INFO', label: 'INFO' },
                { value: 'WARNING', label: 'WARNING' }, { value: 'ERROR', label: 'ERROR' },
              ]} />
            </Form.Item>
            <Form.Item name="backup_enabled" label="自动备份" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
