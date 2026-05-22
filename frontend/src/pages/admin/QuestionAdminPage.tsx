import { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, InputNumber, Row, Col, Popconfirm,
  Tabs, Tag, Space, message, Typography, Tree, Progress, Badge, Alert
} from 'antd';
import {
  PlusOutlined, RobotOutlined, GlobalOutlined,
  CheckOutlined, CloseOutlined, ScanOutlined, ReloadOutlined,
  BookOutlined, ApiOutlined, SearchOutlined, DeleteOutlined,
} from '@ant-design/icons';
import apiClient from '../../api/client';

const { Title, Text } = Typography;

export default function QuestionAdminPage() {
  const [activeTab, setActiveTab] = useState('generate');
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<string[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<any[]>([]);
  const [testPassed, setTestPassed] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<{value:string,label:string}[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [knowledgeTree, setKnowledgeTree] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [taskProgress, setTaskProgress] = useState<any>(null);

  useEffect(() => {
    loadSyllabi();
    loadLlmConfigs();
    loadPendingQuestions();
  }, []);

  const loadSyllabi = async () => {
    try { const { data } = await apiClient.get('/question-admin/syllabi'); setSyllabi(data); } catch {}
  };
  const loadLlmConfigs = async () => {
    try {
      const { data } = await apiClient.get('/admin/llm/config');
      const models = data.available_models || [];
      setLlmConfigs(models);
      if (data.model && !selectedModel) setSelectedModel(data.model);
    } catch {}
  };

  const handleTestConnection = async () => {
    if (!selectedModel) { message.warning('请先选择模型'); return; }
    setTestLoading(true);
    try {
      const { data } = await apiClient.post('/admin/llm/config/test', { model: selectedModel });
      if (data.ok) {
        setTestPassed(true);
        setLlmConfigs(data.models || []);
        message.success(data.message || '连接成功');
      } else {
        setTestPassed(false);
        message.error(data.error || '连接失败');
      }
    } catch { setTestPassed(false); message.error('测试连接失败'); }
    finally { setTestLoading(false); }
  };
  const loadPendingQuestions = async () => {
    try { const { data } = await apiClient.get('/question-admin/pending'); setPendingQuestions(data); } catch {}
  };

  // Syllabus
  const handleCreateSyllabus = async (values: any) => {
    try {
      await apiClient.post('/question-admin/syllabi', null, { params: values });
      message.success('考纲创建成功');
      loadSyllabi();
    } catch { message.error('创建失败'); }
  };

  const handleExtractKnowledge = async (syllabusId: string) => {
    setLoading(true);
    try {
      const { data } = await apiClient.post(`/question-admin/syllabi/${syllabusId}/extract-knowledge`,
        null, { params: { model_config_id: selectedModel } });
      setKnowledgeTree(data.knowledge_tree);
      message.success('知识点提取完成');
      loadSyllabi();
    } catch { message.error('提取失败'); }
    finally { setLoading(false); }
  };

  // Question Generation
  const handleGenerateQuestions = async (values: any) => {
    setLoading(true);
    setGenerating(true);
    setTaskProgress(null);
    try {
      const { data } = await apiClient.post('/question-admin/generate', null, {
        params: { ...values, model: selectedModel }
      });
      setTaskProgress(data);
      if (data.ok) {
        message.success('成功生成 ' + data.count + ' 道试题');
        loadPendingQuestions();
      } else {
        var errMsg = data.error || data.detail || JSON.stringify(data);
        message.error(errMsg);
        setTaskProgress({ ok: false, error: errMsg, count: 0 });
      }
    } catch(err) {
      var msg = '网络请求失败';
      if (err && err.response && err.response.data) {
        msg = err.response.data.detail || err.response.data.error || JSON.stringify(err.response.data);
      }
      message.error(msg);
      setTaskProgress({ ok: false, error: msg, count: 0 });
    } finally { setLoading(false); setGenerating(false); }
  };

  useEffect(() => {
    apiClient.get('/subjects/my').then(({data}) => setSubjectOptions(data.map((s:string)=>({value:s,label:s})))).catch(()=>{});
  }, []);

  // Scrape
  const handleScrape = async (values: any) => {
    setScraping(true); setTaskProgress(null);
    try {
      const { data } = await apiClient.post('/question-admin/scrape', null, { params: values });
      setTaskProgress(data);
      if (data.ok) { message.success('抓取完成: ' + data.scraped_count + '道试题'); loadPendingQuestions(); }
      else { message.error(data.error || '抓取失败'); }
    } catch { message.error('抓取失败'); }
    finally { setScraping(false); }
  };

  // Approval
  const handleApprove = async (id: string) => {
    try { await apiClient.post(`/question-admin/${id}/approve`); message.success('已通过'); loadPendingQuestions(); } catch {}
  };
  const handleReject = async (id: string) => {
    try { await apiClient.post(`/question-admin/${id}/reject`); message.success('已驳回'); loadPendingQuestions(); } catch {}
  };
  const handleBatchApprove = async () => {
    const ids = pendingQuestions.map((q: any) => q.id);
    try { await apiClient.post('/question-admin/batch-approve', ids); message.success('批量通过'); loadPendingQuestions(); } catch {}
  };

  // Dedup
  const handleDedup = async () => {
    try {
      const { data } = await apiClient.post('/question-admin/deduplicate');
      message.info(`发现 ${data.total_groups} 组重复试题`);
      Modal.info({
        title: '去重结果',
        content: (
          <div>
            {data.duplicate_groups.map((g: any) => (
              <Card key={g.group_key} size="small" style={{ marginBottom: 8 }}>
                <Text strong>相似组: {g.group_key} ({g.count}道)</Text>
                {g.questions.map((q: any) => (
                  <div key={q.id}>{q.title} [{q.difficulty}]</div>
                ))}
              </Card>
            ))}
          </div>
        ),
        width: 600,
      });
    } catch { message.error('去重失败'); }
  };

  const tabItems = [
    {
      key: 'generate',
      label: <span><RobotOutlined />LLM生成</span>,
      children: (<>
        <Card title="选择大模型并生成试题" size="small">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space.Compact style={{ width: '100%' }}>
              <Select placeholder="选择模型" style={{ flex: 1 }} value={selectedModel} onChange={setSelectedModel}
                options={llmConfigs.map((m: string) => ({ value: m, label: m }))} />
              <Button icon={<ApiOutlined />} onClick={handleTestConnection} loading={testLoading}>
                {testLoading ? '正在加载 ' + selectedModel + '，初次加载可能需要较长时间，请稍等...' : testPassed ? selectedModel + ' 加载成功' : '测试连接'}
              </Button>
            </Space.Compact>
            <Form onFinish={handleGenerateQuestions} layout="inline">
              <Form.Item name="subject" label="学科" initialValue="数学">
                <Select style={{ width: 100 }} options={subjectOptions} />
              </Form.Item>
              <Form.Item name="grade_level" label="年级" initialValue="八年级">
                <Select style={{ width: 100 }} options={['六年级','七年级','八年级','九年级'].map(v=>({value:v,label:v}))} />
              </Form.Item>
              <Form.Item name="knowledge_point" label="知识点" rules={[{ required: true }]}>
                <Input placeholder="如: 一元二次方程" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item name="difficulty" label="难度" initialValue="MEDIUM">
                <Select style={{ width: 90 }} options={[{ value: 'EASY', label: '简单' }, { value: 'MEDIUM', label: '中等' }, { value: 'HARD', label: '困难' }]} />
              </Form.Item>
              <Form.Item name="question_type" label="题型" initialValue="SINGLE_CHOICE">
                <Select style={{ width: 110 }} options={[{ value: 'SINGLE_CHOICE', label: '单选题' }, { value: 'MULTIPLE_CHOICE', label: '多选题' }, { value: 'FILL_BLANK', label: '填空题' }, { value: 'SUBJECTIVE', label: '解答题' }]} />
              </Form.Item>
              <Form.Item name="count" label="数量" initialValue={3}>
                <InputNumber min={1} max={20} style={{ width: 60 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<RobotOutlined />} loading={loading}
                  disabled={!testPassed}>
                  {testPassed ? '生成试题' : '请先测试连接'}
                </Button>
              </Form.Item>
            </Form>
            {generating && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px 24px', background: 'linear-gradient(135deg, #667eea22, #764ba222)',
                borderRadius: 8, border: '1px solid #667eea44',
                animation: 'breathe 1.8s ease-in-out infinite',
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', background: '#667eea',
                  marginRight: 12, boxShadow: '0 0 12px #667eea88',
                  animation: 'pulse 0.8s ease-in-out infinite',
                }} />
                <Text strong style={{ color: '#667eea', fontSize: 15 }}>
                  AI 正在生成试题，请稍候...
                </Text>
              </div>
            )}
            {taskProgress && <Alert type={taskProgress.ok === false ? 'error' : 'success'}
              message={taskProgress.ok === false ? taskProgress.error : '已生成 ' + taskProgress.count + ' 道试题，请到审核标签查看'} />}
          </Space>
        </Card>
        <style>{`
          @keyframes breathe {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.02); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.6); opacity: 1; }
          }
        `}</style>
        <QuestionListBySource sourceFilter="LLM_GENERATED" title="LLM 生成试题列表" key={taskProgress?.task_id} />
      </>),
    },
    {
      key: 'scrape',
      label: <span><GlobalOutlined />网络抓取</span>,
      children: (<>
        <Card title="按知识点网上抓取试题" size="small">
          <Form onFinish={handleScrape} layout="inline">
            <Form.Item name="knowledge_point" label="知识点" rules={[{ required: true }]}><Input placeholder="如: 勾股定理" /></Form.Item>
            <Form.Item name="count" label="数量" initialValue={10}><InputNumber min={1} max={50} /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" icon={<GlobalOutlined />} loading={scraping}>开始抓取</Button></Form.Item>
          </Form>
          {scraping && (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'16px 24px',background:'linear-gradient(135deg,#667eea22,#764ba222)',borderRadius:8,border:'1px solid #667eea44',animation:'breathe 1.8s ease-in-out infinite'}}>
              <div style={{ width:14,height:14,borderRadius:'50%',background:'#667eea',marginRight:12,boxShadow:'0 0 12px #667eea88',animation:'pulse 0.8s ease-in-out infinite'}} />
              <Text strong style={{ color:'#667eea',fontSize:15 }}>正在抓取网络试题，请稍候...</Text>
            </div>
          )}
          {taskProgress && !scraping && <Alert style={{ marginTop: 12 }} type={taskProgress.ok === false ? 'error' : 'info'} message={taskProgress.ok === false ? taskProgress.error : ('抓取完成: ' + taskProgress.scraped_count + '道试题')} />}
        </Card>
        <QuestionListBySource sourceFilter="SCRAPED" title="网络抓取试题列表" key={taskProgress?.task_id} />
      </>),
    },
    {
      key: 'review',
      label: <span><CheckOutlined />审核试题 <Badge count={pendingQuestions.length} /></span>,
      children: (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" onClick={handleBatchApprove} disabled={pendingQuestions.length === 0}>批量通过</Button>
            <Button onClick={handleDedup} icon={<ScanOutlined />}>去重检测</Button>
            <Button onClick={loadPendingQuestions} icon={<ReloadOutlined />}>刷新</Button>
          </Space>
          <Table rowKey="id" dataSource={pendingQuestions} pagination={{ pageSize: 20 }} columns={[
            { title: '题目', dataIndex: 'title', ellipsis: true },
            { title: '来源', dataIndex: 'source', width: 90, render: (s: string) => {
              const map: any = { MANUAL: '人工', LLM_GENERATED: 'LLM', SCRAPED: '抓取', OCR_UPLOAD: '学生上传' };
              return <Tag>{map[s] || s}</Tag>;
            }},
            { title: '类型', dataIndex: 'question_type', width: 80 },
            { title: '难度', dataIndex: 'difficulty', width: 70 },
            { title: '状态', dataIndex: 'review_status', width: 80, render: (s: string) => {
              const colors: any = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'red' };
              return <Tag color={colors[s]}>{s}</Tag>;
            }},
            {
              title: '操作', width: 140,
              render: (_: any, r: any) => (
                <Space>
                  <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(r.id)}>通过</Button>
                  <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(r.id)}>驳回</Button>
                </Space>
              ),
            },
          ]} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}><RobotOutlined style={{ marginRight: 8 }} />智能出题</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
}


// ─── LLM Question List (below generate card, shows only LLM-generated) ───

const typeMap: any = { SINGLE_CHOICE:'单选题', MULTIPLE_CHOICE:'多选题', FILL_BLANK:'填空题', SUBJECTIVE:'解答题' };
const diffMap: any = { EASY:'简单', MEDIUM:'中等', HARD:'困难' };
const sourceMap: any = {
  MANUAL:{color:'blue',label:'人工录入'}, LLM_GENERATED:{color:'purple',label:'LLM生成'},
  SCRAPED:{color:'orange',label:'网络抓取'}, OCR_UPLOAD:{color:'cyan',label:'学生上传'},
};
const statusMap: any = {
  APPROVED:{color:'green',label:'已发布'}, PENDING:{color:'orange',label:'待审核'},
  REJECTED:{color:'red',label:'已驳回'}, NEEDS_REVIEW:{color:'gold',label:'待复核'},
};

function QuestionListBySource({ sourceFilter, title }: { sourceFilter: string, title: string }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<any>(undefined);
  const [diffFilter, setDiffFilter] = useState<any>(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);

  useEffect(() => { fetchQuestions(); }, [page]);

  const fetchQuestions = () => {
    setLoading(true);
    const params: any = { limit: 20, offset: (page - 1) * 20 };
    if (search) params.keyword = search;
    if (typeFilter) params.question_type = typeFilter;
    if (diffFilter) params.difficulty = diffFilter;
    apiClient.get('/questions', { params }).then(({ data }: any) => {
      const all = Array.isArray(data) ? data : (data.items || []);
      setQuestions(all.filter((q: any) => q.source === sourceFilter));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请先选中试题'); return; }
    try {
      await apiClient.post('/questions/batch-delete', selectedRowKeys);
      message.success('已删除 ' + selectedRowKeys.length + ' 道');
      setSelectedRowKeys([]); fetchQuestions();
    } catch { message.error('批量删除失败'); }
  };

  const handleSingleDelete = async (id: string) => {
    try {
      await apiClient.delete('/questions/' + id);
      message.success('已删除');
      fetchQuestions();
    } catch { message.error('删除失败'); }
  };

  return (
    <Card title={title} size="small" style={{ marginTop: 16 }}>
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col flex="auto"><Input placeholder="搜索题目" prefix={<SearchOutlined />} value={search} onChange={e=>setSearch(e.target.value)} onPressEnter={fetchQuestions} allowClear /></Col>
        <Col><Select placeholder="题型" allowClear style={{width:90}} value={typeFilter} onChange={setTypeFilter} options={Object.entries(typeMap).map(([k,v]: any)=>({value:k,label:v}))} /></Col>
        <Col><Select placeholder="难度" allowClear style={{width:80}} value={diffFilter} onChange={setDiffFilter} options={Object.entries(diffMap).map(([k,v]: any)=>({value:k,label:v}))} /></Col>
        <Col><Button icon={<SearchOutlined />} onClick={fetchQuestions}>查询</Button></Col>
        <Col>
          <Popconfirm title={'确定删除 ' + selectedRowKeys.length + ' 道试题?'} onConfirm={handleBatchDelete} disabled={selectedRowKeys.length===0}>
            <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length===0}>
              批量删除{selectedRowKeys.length>0 ? '(' + selectedRowKeys.length + ')' : ''}
            </Button>
          </Popconfirm>
        </Col>
      </Row>
      <Table rowKey="id" loading={loading} dataSource={questions} size="small"
        pagination={{ current:page, onChange:setPage, pageSize:20, showTotal:(t: number)=>'共 ' + t + ' 道试题' }}
        rowSelection={{ selectedRowKeys, onChange: (keys: any[]) => setSelectedRowKeys(keys) }}
        columns={[
          { title: '题目', dataIndex: 'title', ellipsis: true },
          { title: '题型', dataIndex: 'question_type', width:70, render:(t:string)=><Tag>{typeMap[t]||t}</Tag> },
          { title: '难度', dataIndex: 'difficulty', width:60, render:(t:string)=><Tag color={t==='EASY'?'green':t==='MEDIUM'?'orange':'red'}>{diffMap[t]||t}</Tag> },
          { title: '来源', dataIndex: 'source', width:80, render:(s:string)=>{const m=sourceMap[s];return m ? <Tag color={m.color}>{m.label}</Tag> : <Tag>{s}</Tag>;} },
          { title: '状态', dataIndex: 'review_status', width:80, render:(s:string)=>{const m=statusMap[s];return m ? <Tag color={m.color}>{m.label}</Tag> : <Tag>{s}</Tag>;} },
          { title: '时间', dataIndex: 'created_at', width:100, render:(v:string)=>(v||'').slice(0,10) },
          { title: '操作', width:60, render:(_:any, r:any) => (
            <Popconfirm title="确定删除?" onConfirm={() => handleSingleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )},
        ]} />
    </Card>
  );
}
