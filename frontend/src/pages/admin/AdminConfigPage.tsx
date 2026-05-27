import { useState, useEffect } from 'react';
import { Tabs, Card, Form, InputNumber, Select, Switch, Button, message, Typography, Space, Input, Tag } from 'antd';
import { SaveOutlined, ApiOutlined, ThunderboltOutlined, DatabaseOutlined, ReloadOutlined, CloudServerOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

const { Title } = Typography;

export default function AdminConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [llmLoading, setLlmLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState('');
  const [ocrTestLoading, setOcrTestLoading] = useState(false);
  const [redisTestLoading, setRedisTestLoading] = useState(false);

  // ─── LLM ───
  const [llmProvider, setLlmProvider] = useState<string>('ollama');
  useEffect(() => {
    apiClient.get('/admin/llm/config').then(({ data }) => {
      setLlmProvider(data.current || 'ollama');
      const ollama = data.ollama || {};
      const deepseek = data.deepseek || {};
      form.setFieldsValue({
        ollama_endpoint: ollama.endpoint || '',
        ollama_model: ollama.model || '',
        deepseek_api_key: deepseek.api_key || '',
        deepseek_model: deepseek.model || 'deepseek-chat',
      });
      if (ollama.available_models?.length) setModels(ollama.available_models);
    }).catch(() => {});

    // Load full config for OCR + Celery sections
    apiClient.get('/admin/llm/all-config').then(({ data }) => {
      const ocr = data.ocr || {};
      const celery = data.celery || {};
      form.setFieldsValue({
        ocr_engine: ocr.ocr_engine || 'tesseract',
        paddleocr_endpoint: ocr.paddleocr_endpoint || '',
        max_concurrent_ocr: ocr.max_concurrent_ocr || 5,
        ocr_confidence_threshold: ocr.ocr_confidence_threshold || 0.8,
        celery_enabled: celery.enabled || false,
        celery_redis_url: celery.redis_url || 'redis://localhost:6379/0',
        celery_worker_concurrency: celery.worker_concurrency || 2,
        celery_async_threshold: celery.async_threshold || 3,
      });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTestConnection = async () => {
    const provider = llmProvider;
    if (provider === 'deepseek') {
      setLlmLoading(true); setTestResult('');
      try {
        const { data } = await apiClient.post('/admin/llm/config/test', { provider: 'deepseek' });
        if (data.ok) {
          setModels(data.models || []);
          setTestResult('DeepSeek 连接成功');
          message.success(data.message || '连接成功');
        } else {
          setTestResult(data.error || '连接失败');
          message.error(data.error || '连接失败');
        }
      } catch { message.error('连接测试失败'); }
      finally { setLlmLoading(false); }
      return;
    }
    // Ollama
    const endpoint = form.getFieldValue('ollama_endpoint');
    if (!endpoint) { message.warning('请先输入Ollama访问地址'); return; }
    setLlmLoading(true); setTestResult('');
    try {
      const { data } = await apiClient.post('/admin/llm/config/test', { provider: 'ollama', endpoint });
      if (data.ok) {
        setModels(data.models || []);
        setTestResult(`连接成功，发现 ${data.models?.length || 0} 个模型`);
        message.success(data.message || '连接成功');
      } else {
        setTestResult(data.error || '连接失败');
        message.error(data.error || '连接失败');
      }
    } catch { message.error('连接测试失败'); }
    finally { setLlmLoading(false); }
  };

  const handleSaveLlm = async () => {
    const provider = llmProvider;
    if (provider === 'deepseek') {
      const apiKey = form.getFieldValue('deepseek_api_key');
      const model = form.getFieldValue('deepseek_model') || 'deepseek-chat';
      if (!apiKey) { message.warning('请输入 DeepSeek API Key'); return; }
      setLlmLoading(true);
      try {
        await apiClient.put('/admin/llm/config', { provider: 'deepseek', model, api_key: apiKey });
        message.success('DeepSeek 配置已保存');
      } catch { message.error('保存失败'); }
      finally { setLlmLoading(false); }
      return;
    }
    // Ollama
    const endpoint = form.getFieldValue('ollama_endpoint');
    const model = form.getFieldValue('ollama_model');
    if (!endpoint) { message.warning('请输入访问地址'); return; }
    if (!model) { message.warning('请选择模型'); return; }
    setLlmLoading(true);
    try {
      await apiClient.put('/admin/llm/config', { provider: 'ollama', endpoint, model });
      message.success('Ollama 配置已保存');
    } catch { message.error('保存失败'); }
    finally { setLlmLoading(false); }
  };

  // ─── OCR / System / Celery save ───
  const handleSave = async (section: string) => {
    const allValues = form.getFieldsValue();
    setLoading(true);
    try {
      const sectionFields: Record<string, string[]> = {
        ocr: ['ocr_engine', 'paddleocr_endpoint', 'max_concurrent_ocr', 'ocr_confidence_threshold'],
        system: ['log_level', 'backup_enabled'],
        celery: ['celery_enabled', 'celery_redis_url', 'celery_worker_concurrency', 'celery_async_threshold'],
      };
      const fields = sectionFields[section] || [];
      const payload: any = { section };
      fields.forEach(f => {
        if (allValues[f] !== undefined) {
          // Strip 'celery_' prefix for backend config keys
          const key = section === 'celery' && f.startsWith('celery_') ? f.slice(7) : f;
          payload[key] = allValues[f];
        }
      });
      await apiClient.put('/admin/llm/section-config', payload);
      message.success('保存成功');
    } catch { message.error('保存失败'); }
    finally { setLoading(false); }
  };

  // ─── Test PaddleOCR ───
  const handleTestPaddleOCR = async () => {
    const endpoint = form.getFieldValue('paddleocr_endpoint');
    if (!endpoint) { message.warning('请先输入 PaddleOCR 服务地址'); return; }
    setOcrTestLoading(true);
    try {
      const { data } = await apiClient.post('/ocr/test-paddleocr', { endpoint });
      if (data.ok) message.success(data.message); else message.error(data.message);
    } catch { message.error('PaddleOCR 测试失败'); }
    finally { setOcrTestLoading(false); }
  };

  // ─── Test Redis ───
  const handleTestRedis = async () => {
    const redisUrl = form.getFieldValue('celery_redis_url');
    if (!redisUrl) { message.warning('请先输入 Redis 连接地址'); return; }
    setRedisTestLoading(true);
    try {
      const { data } = await apiClient.post('/admin/llm/test-redis', { redis_url: redisUrl });
      if (data.ok) message.success(data.message); else message.error(data.message);
    } catch { message.error('Redis 测试失败'); }
    finally { setRedisTestLoading(false); }
  };

  // ─── Database status ───
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const loadDbStatus = async () => {
    setDbLoading(true);
    try {
      const { data } = await apiClient.get('/admin/database/status');
      setDbStatus(data);
    } catch { setDbStatus(null); }
    finally { setDbLoading(false); }
  };
  useEffect(() => { loadDbStatus(); }, []);

  // ─── DB config edit ───
  const [dbConfig, setDbConfig] = useState({ server: '', port: '', database: '', user: '', password: '' });
  const [dbPasswordDirty, setDbPasswordDirty] = useState(false);
  const [dbConfigLoading, setDbConfigLoading] = useState(false);

  useEffect(() => {
    if (dbStatus?.connection) {
      setDbConfig(prev => ({
        server: dbStatus.connection.server || '',
        port: dbStatus.connection.port || '',
        database: dbStatus.connection.database || '',
        user: dbStatus.connection.user || '',
        password: dbPasswordDirty ? prev.password : '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbStatus]);

  const handleSaveDbConfig = async () => {
    setDbConfigLoading(true);
    try {
      await apiClient.post('/admin/database/config', dbConfig);
      setDbPasswordDirty(false);
      setDbConfig(prev => ({ ...prev, password: '' }));
      message.success('数据库配置已保存，重启后端服务后生效');
    } catch { message.error('保存失败'); }
    finally { setDbConfigLoading(false); }
  };

  // ─── Tab 1: 大模型配置 ───
  const llmTab = (
    <div>
      <Card title={<span><ThunderboltOutlined /> 大模型配置</span>} size="small"
        style={{ border: '1px solid #1890ff' }}
        extra={<Button icon={<SaveOutlined />} onClick={handleSaveLlm} loading={llmLoading}>保存</Button>}>
        <Form.Item label="服务提供商">
          <Select
            value={llmProvider}
            style={{ width: 220 }}
            onChange={v => { setLlmProvider(v); setTestResult(''); setModels([]); }}
            options={[
              { value: 'ollama', label: 'Ollama (本地部署)' },
              { value: 'deepseek', label: 'DeepSeek (云端 API)' },
            ]}
          />
        </Form.Item>

        {llmProvider === 'ollama' ? (
          <>
            <Form.Item label="Ollama 访问地址">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="ollama_endpoint" noStyle>
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
              <Form.Item name="ollama_model" noStyle>
                <Select placeholder="请先测试连接获取模型列表" options={models.map(m => ({ value: m, label: m }))} />
              </Form.Item>
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item name="deepseek_api_key" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item name="deepseek_model" label="模型">
              <Select
                options={[
                  { value: 'deepseek-chat', label: 'DeepSeek-V3 (deepseek-chat)' },
                  { value: 'deepseek-reasoner', label: 'DeepSeek-R1 (deepseek-reasoner)' },
                  { value: 'deepseek-v4-pro[1m]', label: 'DeepSeek-V4 Pro' },
                ]}
              />
            </Form.Item>
            <Space.Compact style={{ width: '100%' }}>
              <Button icon={<ApiOutlined />} onClick={handleTestConnection} loading={llmLoading}>测试连接</Button>
              {testResult && (
                <span style={{ marginLeft: 12, fontSize: 13, color: testResult.includes('成功') ? '#52c41a' : '#f5222d' }}>
                  {testResult}
                </span>
              )}
            </Space.Compact>
          </>
        )}
      </Card>
    </div>
  );

  // ─── Tab 2: OCR 设置 ───
  const ocrEngine = Form.useWatch('ocr_engine', form);
  const ocrTab = (
    <div>
      <Card title="OCR 设置" size="small" extra={
        <Button icon={<SaveOutlined />} onClick={() => handleSave('ocr')} loading={loading}>保存</Button>
      }>
        <Space size="large" wrap>
          <Form.Item name="ocr_engine" label="OCR 引擎">
            <Select style={{ width: 150 }} options={[
              { value: 'tesseract', label: 'Tesseract' },
              { value: 'paddleocr', label: 'PaddleOCR (GPU)' },
            ]} />
          </Form.Item>
          <Form.Item name="max_concurrent_ocr" label="最大并发 OCR">
            <InputNumber min={1} max={20} />
          </Form.Item>
          <Form.Item name="ocr_confidence_threshold" label="OCR 置信度阈值">
            <InputNumber min={0} max={1} step={0.05} />
          </Form.Item>
        </Space>
        {ocrEngine === 'paddleocr' && (
          <Form.Item label="PaddleOCR 服务地址" style={{ marginTop: 8 }}>
            <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
              <Form.Item name="paddleocr_endpoint" noStyle>
                <Input placeholder="http://paddleocr:8080/predict" />
              </Form.Item>
              <Button icon={<ApiOutlined />} onClick={handleTestPaddleOCR} loading={ocrTestLoading}>测试连接</Button>
            </Space.Compact>
          </Form.Item>
        )}
      </Card>
    </div>
  );

  // ─── Tab 3: 数据库设置 ───
  const dbTab = (
    <div>
      <Card
        title={<span><DatabaseOutlined /> 数据库状态</span>}
        size="small"
        style={{ marginBottom: 16, border: '1px solid #52c41a' }}
        extra={<Button icon={<ReloadOutlined />} onClick={loadDbStatus} loading={dbLoading}>刷新</Button>}
      >
        {dbStatus ? (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <span style={{ color: '#888', fontSize: 12 }}>数据库类型</span>
                <div><Tag color="blue">PostgreSQL</Tag></div>
              </div>
              <div>
                <span style={{ color: '#888', fontSize: 12 }}>连接地址</span>
                <div><strong>{dbStatus.connection?.server}:{dbStatus.connection?.port}</strong></div>
              </div>
              <div>
                <span style={{ color: '#888', fontSize: 12 }}>数据库名</span>
                <div><strong>{dbStatus.connection?.database}</strong></div>
              </div>
              <div>
                <span style={{ color: '#888', fontSize: 12 }}>用户</span>
                <div>{dbStatus.connection?.user}</div>
              </div>
              <div>
                <span style={{ color: '#888', fontSize: 12 }}>大小</span>
                <div>{dbStatus.size_mb} MB</div>
              </div>
              <div>
                <span style={{ color: '#888', fontSize: 12 }}>数据表</span>
                <div>{dbStatus.table_count} 张</div>
              </div>
              <div>
                <span style={{ color: '#888', fontSize: 12 }}>总记录数</span>
                <div>{dbStatus.total_rows} 条</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
              {dbStatus.version?.split(',')[0]}
            </div>
          </Space>
        ) : (
          <span style={{ color: '#999' }}>加载中...</span>
        )}
      </Card>

      <Card
        title="数据库连接参数配置"
        size="small"
        extra={<Button icon={<SaveOutlined />} type="primary" onClick={handleSaveDbConfig} loading={dbConfigLoading}>确认</Button>}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: '#888', fontSize: 12 }}>服务器</span>
              <Input
                value={dbConfig.server}
                onChange={e => setDbConfig({ ...dbConfig, server: e.target.value })}
                style={{ width: 160 }} size="small"
              />
            </div>
            <div>
              <span style={{ color: '#888', fontSize: 12 }}>端口</span>
              <Input
                value={dbConfig.port}
                onChange={e => setDbConfig({ ...dbConfig, port: e.target.value })}
                style={{ width: 80 }} size="small"
              />
            </div>
            <div>
              <span style={{ color: '#888', fontSize: 12 }}>数据库名</span>
              <Input
                value={dbConfig.database}
                onChange={e => setDbConfig({ ...dbConfig, database: e.target.value })}
                style={{ width: 160 }} size="small"
              />
            </div>
            <div>
              <span style={{ color: '#888', fontSize: 12 }}>用户</span>
              <Input
                value={dbConfig.user}
                onChange={e => setDbConfig({ ...dbConfig, user: e.target.value })}
                style={{ width: 140 }} size="small"
              />
            </div>
            <div>
              <span style={{ color: '#888', fontSize: 12 }}>密码</span>
              <Input.Password
                value={dbConfig.password}
                onChange={e => { setDbConfig({ ...dbConfig, password: e.target.value }); setDbPasswordDirty(true); }}
                style={{ width: 160 }} size="small"
                placeholder="留空则不更新密码"
              />
            </div>
          </div>
          <span style={{ fontSize: 11, color: '#faad14' }}>修改后需重启后端服务方可生效 · 留空则不更新密码</span>
        </Space>
      </Card>
    </div>
  );

  // ─── Tab 4: 其他设置 ───
  const otherTab = (
    <div>
      <Card title="其他设置" size="small" extra={
        <Button icon={<SaveOutlined />} onClick={() => handleSave('system')} loading={loading}>保存</Button>
      }>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Form.Item name="log_level" label="日志级别" style={{ marginBottom: 0 }}>
            <Select style={{ width: 120 }} options={[
              { value: 'DEBUG', label: 'DEBUG' }, { value: 'INFO', label: 'INFO' },
              { value: 'WARNING', label: 'WARNING' }, { value: 'ERROR', label: 'ERROR' },
            ]} />
          </Form.Item>
          <Form.Item name="backup_enabled" label="自动备份" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Space>
              <Switch checkedChildren="开" unCheckedChildren="关" disabled />
              <Tag color="orange">二期实现</Tag>
            </Space>
          </Form.Item>
        </Space>
      </Card>
    </div>
  );

  // ─── Tab 5: 异步任务 ───
  const celeryEnabled = Form.useWatch('celery_enabled', form);
  const asyncTab = (
    <div>
      <Card
        title={<span><CloudServerOutlined /> Celery 异步任务配置</span>}
        size="small"
        style={{ marginBottom: 16, border: '1px solid #722ed1' }}
        extra={<Button icon={<SaveOutlined />} onClick={() => handleSave('celery')} loading={loading}>保存</Button>}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Form.Item name="celery_enabled" label="启用异步任务队列" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item label="Redis 连接地址" style={{ marginBottom: 0 }}>
            <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
              <Form.Item name="celery_redis_url" noStyle>
                <Input placeholder="redis://redis:6379/0" />
              </Form.Item>
              <Button icon={<ApiOutlined />} onClick={handleTestRedis} loading={redisTestLoading}>测试连接</Button>
            </Space.Compact>
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="celery_worker_concurrency" label="Worker 并发数" style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={8} />
            </Form.Item>
            <Form.Item name="celery_async_threshold" label="异步触发阈值 (题数)" style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={20} />
            </Form.Item>
          </Space>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            当生成/抓取题数 &ge; 阈值时自动使用异步任务；低于阈值则同步执行。修改配置后需重启 Worker。
          </div>
        </Space>
      </Card>
      <Card title="Worker 状态" size="small">
        <Space>
          <span>异步队列：</span>
          {celeryEnabled
            ? <Tag color="green">已启用</Tag>
            : <Tag color="default">未启用</Tag>
          }
        </Space>
        <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 8 }}>
          启动 Worker: <code>docker compose --profile async up -d celery-worker</code> 或 <code>./celery_worker.sh</code>
        </div>
      </Card>
    </div>
  );

  return (
    <div>
      <Title level={4}>系统配置</Title>
      <Form form={form} layout="vertical" initialValues={{
        ollama_endpoint: undefined,
        ollama_model: undefined,
        deepseek_api_key: '',
        deepseek_model: 'deepseek-chat',
        max_concurrent_ocr: 5,
        ocr_confidence_threshold: 0.8,
        ocr_engine: 'tesseract',
        paddleocr_endpoint: 'http://paddleocr:8080/predict',
        log_level: 'INFO',
        backup_enabled: true,
        celery_enabled: false,
        celery_redis_url: 'redis://localhost:6379/0',
        celery_worker_concurrency: 2,
        celery_async_threshold: 3,
      }}>
        <Tabs
          defaultActiveKey="llm"
          items={[
            { key: 'llm', label: '大模型配置', children: llmTab },
            { key: 'ocr', label: 'OCR 设置', children: ocrTab },
            { key: 'database', label: '数据库设置', children: dbTab },
            { key: 'other', label: '其他设置', children: otherTab },
            { key: 'async', label: '异步任务', children: asyncTab },
          ]}
        />
      </Form>
    </div>
  );
}
