import { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, InputNumber, Row, Col, Popconfirm,
  Tabs, Tag, Space, message, Typography, Tree, Progress, Badge, Alert, Divider, Pagination
} from 'antd';
import {
  PlusOutlined, RobotOutlined, GlobalOutlined,
  CheckOutlined, CloseOutlined, ScanOutlined, ReloadOutlined,
  BookOutlined, ApiOutlined, SearchOutlined, DeleteOutlined, EditOutlined,
} from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toColorMap, toSelectOptions } from '../../hooks/useReferenceValues';
import QuestionEditModal from '../questions/QuestionEditModal';

const { Title, Text } = Typography;

export default function QuestionAdminPage() {
  const [activeTab, setActiveTab] = useState('generate');
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [testPassed, setTestPassed] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<{value:string,label:string}[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [llmProvider, setLlmProvider] = useState<string>('ollama');
  const [dsApiKey, setDsApiKey] = useState('');
  const [dsModel, setDsModel] = useState('deepseek-chat');
  const [dsModels, setDsModels] = useState<string[]>([]);
  const [genForm] = Form.useForm();
  const [promptText, setPromptText] = useState(
    '你是一位专业的教育题目生成专家。请根据以下要求生成试题，直接返回JSON数组。\n\n' +
    '要求：\n- 知识点：(未填)\n- 难度：MEDIUM\n- 题型：SINGLE_CHOICE\n' +
    '- 数量：3道\n- 年级：G8\n- 学科：数学\n\n' +
    '返回格式：严格的JSON数组，不要markdown代码块。'
  );
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

  const { 'question-sources': sources, 'grade-levels': grades, 'difficulty-levels': diffs, 'question-types': qtypes } = useReferenceValues();

  const loadSyllabi = async () => {
    try { const { data } = await apiClient.get('/question-admin/syllabi'); setSyllabi(data); } catch {}
  };
  const loadLlmConfigs = async () => {
    try {
      const { data } = await apiClient.get('/admin/llm/config');
      setLlmProvider(data.current || 'ollama');
      var ollama = data.ollama || {};
      var deepseek = data.deepseek || {};
      setLlmConfigs(ollama.available_models || []);
      setSelectedModel(ollama.model || '');
      setDsApiKey(deepseek.api_key || '');
      setDsModel(deepseek.model || 'deepseek-chat');
      setDsModels(deepseek.available_models || ['deepseek-chat', 'deepseek-reasoner']);
    } catch {}
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    try {
      var payload: any = { provider: llmProvider };
      if (llmProvider === 'ollama') {
        if (!selectedModel) { message.warning('请先选择模型'); setTestLoading(false); return; }
        payload.model = selectedModel;
      }
      const { data } = await apiClient.post('/admin/llm/config/test', payload);
      if (data.ok) {
        setTestPassed(true);
        if (data.models) setLlmConfigs(data.models);
        message.success(data.message || '连接成功');
      } else {
        setTestPassed(false);
        message.error(data.error || '连接失败');
      }
    } catch { setTestPassed(false); message.error('测试连接失败'); }
    finally { setTestLoading(false); }
  };
  const loadPendingQuestions = async () => {
    try { const { data } = await apiClient.get('/question-admin/pending', { params: { limit: 1 } }); setPendingCount((data as any).total || 0); } catch {}
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
        params: { ...values, model: llmProvider === 'deepseek' ? dsModel : selectedModel, provider: llmProvider }
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
  const [scrapeForm] = Form.useForm();
  const [scrapeConditions, setScrapeConditions] = useState(
    '知识点: \n学科: 数学\n年级: G8\n难度: MEDIUM\n题型: SINGLE_CHOICE\n数量: 3'
  );
  const handleScrape = async (values: any) => {
    setScraping(true); setTaskProgress(null);
    try {
      const { data } = await apiClient.post('/question-admin/scrape', null, { params: values });
      setTaskProgress(data);
      if (data.ok) {
        message.success('抓取完成: ' + (data.count || 0) + '道试题已入库');
        loadPendingQuestions();
      } else { message.error(data.error || '抓取失败'); }
    } catch { message.error('抓取失败'); }
    finally { setScraping(false); }
  };

  const updateScrapeConditions = () => {
    const v = scrapeForm.getFieldsValue();
    setScrapeConditions(`知识点: ${v.knowledge_point || ''}\n学科: ${v.subject || '数学'}\n年级: ${v.grade_level || 'G8'}\n难度: ${v.difficulty || 'MEDIUM'}\n题型: ${v.question_type || 'SINGLE_CHOICE'}\n数量: ${v.count || 3}`);
  };

  const tabItems = [
    {
      key: 'generate',
      label: <span><RobotOutlined />LLM生成</span>,
      children: (<>
        <Card title="选择大模型并生成试题" size="small" styles={{ body: { padding: '8px 12px' } }}>

          <Row gutter={12}>
            {/* ── Left 2/3 ── */}
            <Col span={16}>
              {/* Top: 模型配置 */}
              <div style={{ marginBottom: 12, padding: '6px 10px', background: '#fafafa', borderRadius: 4 }}>
                <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                  <Select size="small" value={llmProvider} onChange={v => { setLlmProvider(v); setTestPassed(false); }}
                    style={{ width: 140, flexShrink: 0 }}
                    options={[{ value: 'ollama', label: 'Ollama (本地)' }, { value: 'deepseek', label: 'DeepSeek (云端)' }]} />
                  {llmProvider === 'ollama' ?
                    <Select size="small" placeholder="选择模型" style={{ flex: 1 }} value={selectedModel} onChange={setSelectedModel}
                      options={llmConfigs.map((m: string) => ({ value: m, label: m }))} />
                  :
                    <Select size="small" placeholder="选择模型" style={{ flex: 1 }} value={dsModel} onChange={setDsModel}
                      options={dsModels.map((m: string) => ({ value: m, label: m }))} />
                  }
                  <Button size="small" icon={<ApiOutlined />} onClick={handleTestConnection} loading={testLoading}
                    style={{ marginLeft: 8, flexShrink: 0, width: 90 }}>
                    {testPassed ? '✓' : '测试连接'}
                  </Button>
                </div>
              </div>
              <Divider style={{ margin: '6px 0' }} />

              {/* Bottom: 生成条件 — label & input on same line */}
              <Form form={genForm} onFinish={handleGenerateQuestions} layout="horizontal" size="small"
                labelCol={{ style: { width: 50, fontSize: 12 } }}
                onValuesChange={(_, all) => {
                  var p = `你是一位专业的教育题目生成专家。请根据以下要求生成试题，直接返回JSON数组。\n\n要求：\n- 知识点：${all.knowledge_point || '(未填)'}\n- 难度：${all.difficulty || 'MEDIUM'}\n- 题型：${all.question_type || 'SINGLE_CHOICE'}\n- 数量：${all.count || 3}道\n- 年级：${all.grade_level || 'G8'}\n- 学科：${all.subject || '数学'}\n\n返回格式：严格的JSON数组，不要markdown代码块。`;
                  setPromptText(p);
                }}
                initialValues={{ subject: '数学', grade_level: 'G8', difficulty: 'MEDIUM', question_type: 'SINGLE_CHOICE', count: 3 }}>
                {/* Row 1 */}
                <Row gutter={8} style={{ marginBottom: 2 }}>
                  <Col span={12}>
                    <Form.Item name="subject" label="学科" style={{ marginBottom: 0 }}>
                      <Select size="small" options={subjectOptions} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="grade_level" label="年级" style={{ marginBottom: 0 }}>
                      <Select size="small" options={toSelectOptions(grades)} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                {/* Row 2 */}
                <Row gutter={8} style={{ marginBottom: 2 }}>
                  <Col span={24}>
                    <Form.Item name="knowledge_point" label="知识点" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <Input size="small" placeholder="多知识点综合用逗号分割，如：三角函数, 正弦" />
                    </Form.Item>
                  </Col>
                </Row>
                {/* Row 3 */}
                <Row gutter={8} style={{ marginBottom: 2 }}>
                  <Col span={12}>
                    <Form.Item name="difficulty" label="难度" style={{ marginBottom: 0 }}>
                      <Select size="small" options={toSelectOptions(diffs)} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="question_type" label="题型" style={{ marginBottom: 0 }}>
                      <Select size="small" options={toSelectOptions(qtypes)} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                {/* Row 4 */}
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="count" label="数量" style={{ marginBottom: 0 }}>
                      <InputNumber size="small" min={1} max={20} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" icon={<RobotOutlined />} loading={loading}
                        disabled={!testPassed} size="small" block>
                        生成试题{!testPassed ? '(请先测试连接)' : loading ? '(生成中...)' : ''}
                      </Button>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Col>

            {/* ── Right 1/3: 提示词 ── */}
            <Col span={8}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>发送给模型的提示</div>
              <Input.TextArea rows={9} size="small" style={{ fontFamily: 'monospace', fontSize: 10 }}
                value={promptText} onChange={e => setPromptText(e.target.value)} />
            </Col>
          </Row>

          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            {generating && (
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '2px 12px', background: 'linear-gradient(135deg, #667eea22, #764ba222)',
                borderRadius: 4, border: '1px solid #667eea44', height: 24,
                animation: 'breathe 1.8s ease-in-out infinite',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#667eea',
                  marginRight: 8, boxShadow: '0 0 8px #667eea88',
                  animation: 'pulse 0.8s ease-in-out infinite',
                }} />
                <Text style={{ color: '#667eea', fontSize: 12 }}>
                  AI 正在生成试题，请稍候...
                </Text>
              </div>
            )}
            {taskProgress && <Alert type={taskProgress.ok === false ? 'error' : 'success'} style={{ padding: '2px 12px', fontSize: 12 }}
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
        <QuestionListBySource sourceFilter="LLM_GENERATED" title="LLM 生成试题列表" key={"llm-"+(taskProgress?.task_id||"")} />
      </>),
    },
    {
      key: 'scrape',
      label: <span><GlobalOutlined />网络抓取</span>,
      children: (<>
        <Card title="按知识点网上抓取试题" size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Row gutter={16}>
            <Col span={16}>
              <Form form={scrapeForm} onFinish={handleScrape} layout="horizontal" size="small"
                onValuesChange={updateScrapeConditions}
                labelCol={{ style: { width: 50, fontSize: 12 } }}
                initialValues={{ subject: '数学', grade_level: 'G8', difficulty: 'MEDIUM', question_type: 'SINGLE_CHOICE', count: 3, knowledge_point: '' }}>
                <Row gutter={8} style={{ marginBottom: 2 }}>
                  <Col span={12}>
                    <Form.Item name="subject" label="学科" style={{ marginBottom: 0 }}>
                      <Select size="small" options={subjectOptions} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="grade_level" label="年级" style={{ marginBottom: 0 }}>
                      <Select size="small" options={toSelectOptions(grades)} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={8} style={{ marginBottom: 2 }}>
                  <Col span={24}>
                    <Form.Item name="knowledge_point" label="知识点" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <Input size="small" placeholder="多知识点综合用逗号分割，如：勾股定理, 逆定理" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={8} style={{ marginBottom: 2 }}>
                  <Col span={12}>
                    <Form.Item name="difficulty" label="难度" style={{ marginBottom: 0 }}>
                      <Select size="small" options={toSelectOptions(diffs)} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="question_type" label="题型" style={{ marginBottom: 0 }}>
                      <Select size="small" options={toSelectOptions(qtypes)} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="count" label="数量" style={{ marginBottom: 0 }}>
                      <InputNumber size="small" min={1} max={50} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" icon={<GlobalOutlined />} loading={scraping} size="small" block>
                        开始抓取{scraping ? '(抓取中...)' : ''}
                      </Button>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
              {scraping && (
                <div style={{ display:'flex',alignItems:'center',padding:'2px 12px',background:'linear-gradient(135deg,#667eea22,#764ba222)',borderRadius:4,border:'1px solid #667eea44',height:24,marginTop:8,animation:'breathe 1.8s ease-in-out infinite'}}>
                  <div style={{ width:8,height:8,borderRadius:'50%',background:'#667eea',marginRight:8,boxShadow:'0 0 8px #667eea88',animation:'pulse 0.8s ease-in-out infinite'}} />
                  <Text style={{ color:'#667eea',fontSize:12 }}>正在抓取网络试题，请稍候...</Text>
                </div>
              )}
              {taskProgress && !taskProgress.ok && <Alert style={{ marginTop:8,padding:'2px 12px',fontSize:12 }} type="error" message={taskProgress.error} />}
            </Col>
            <Col span={8}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>搜索条件预览</div>
              <Input.TextArea rows={9} size="small" style={{ fontFamily: 'monospace', fontSize: 10 }}
                value={scrapeConditions} readOnly />
              {taskProgress && (
                <div style={{ marginTop: 4 }}>
                  {taskProgress.ok ? <Tag color="green">成功入库 {taskProgress.count} 道</Tag> : <Tag color="red">抓取失败</Tag>}
                </div>
              )}
            </Col>
          </Row>
        </Card>
        <QuestionListBySource sourceFilter="SCRAPED" title="网络抓取试题列表" key={"scrape-"+(taskProgress?.task_id||"")} />
      </>),
    },
    {
      key: 'review',
      label: <span><CheckOutlined />审核试题 <Badge count={pendingCount} /></span>,
      children: <ReviewQuestionList onRefresh={() => loadPendingQuestions()} />,
    },
  ];

  return (
    <div>
      <Title level={4}><RobotOutlined style={{ marginRight: 8 }} />智能出题</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
}


function ReviewQuestionList({ onRefresh }: { onRefresh: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<any>(undefined);
  const [diffFilter, setDiffFilter] = useState<any>(undefined);
  const [gradeFilter, setGradeFilter] = useState<any>(undefined);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
  const { 'question-types': qtypes, 'difficulty-levels': diffs, 'question-sources': sources, 'grade-levels': grades } = useReferenceValues();
  const typeMap = useMemo(() => toLabelMap(qtypes), [qtypes]);
  const diffMap = useMemo(() => toLabelMap(diffs), [diffs]);
  const sourceMap = useMemo(() => toColorMap(sources), [sources]);

  const loadPage = (pg: number, filters?: { search?: string; typeFilter?: any; diffFilter?: any; gradeFilter?: any; keywordFilter?: string }) => {
    setLoading(true);
    const s = filters?.search ?? search;
    const tf = filters?.typeFilter !== undefined ? filters.typeFilter : typeFilter;
    const df = filters?.diffFilter !== undefined ? filters.diffFilter : diffFilter;
    const gf = filters?.gradeFilter !== undefined ? filters.gradeFilter : gradeFilter;
    const kf = filters?.keywordFilter !== undefined ? filters.keywordFilter : keywordFilter;
    const params: any = { limit: 10, skip: (pg - 1) * 10 };
    if (s) params.keyword = s;
    if (tf) params.question_type = tf;
    if (df) params.difficulty = df;
    if (gf) params.grade = gf;
    if (kf) params.keyword = kf;
    apiClient.get('/question-admin/pending', { params }).then(({ data }: any) => {
      const resp = data || {};
      setQuestions(resp.items || (Array.isArray(resp) ? resp : []));
      setTotal(resp.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadPage(page); }, [page]);

  const parseOptions = (v: any) => {
    if (!v) return null;
    try {
      const parsed = typeof v === 'string' ? JSON.parse(v) : v;
      if (parsed.options && Array.isArray(parsed.options)) {
        return parsed.options.map((opt: any) => {
          const label = opt.label || '';
          return `${label}. ${opt.text || opt}`;
        }).join('  ');
      }
      return null;
    } catch { return null; }
  };

  const parseCorrect = (v: any) => {
    if (!v) return null;
    try {
      const parsed = typeof v === 'string' ? JSON.parse(v) : v;
      // Wrapped format: {"options": ..., "correct_answer": ...}
      if (parsed.correct_answer !== undefined) {
        const ans = parsed.correct_answer;
        if (Array.isArray(ans)) return ans.join(', ');
        if (typeof ans === 'object' && ans !== null) return ans.keywords ? ans.keywords.join(', ') : JSON.stringify(ans);
        return String(ans);
      }
      // Raw format: direct value (e.g. ["x=3","x=-2"] or {"keywords":["xx"],"max_score":10})
      if (Array.isArray(parsed)) return parsed.join(', ');
      if (typeof parsed === 'object' && parsed !== null) return parsed.keywords ? parsed.keywords.join(', ') : JSON.stringify(parsed);
      return String(parsed);
    } catch { return String(v); }
  };

  const handleApprove = async (id: string) => {
    try { await apiClient.post(`/question-admin/${id}/approve`); message.success('已通过'); loadPage(page); onRefresh(); } catch {}
  };
  const handleReject = async (id: string) => {
    try { await apiClient.post(`/question-admin/${id}/reject`); message.success('已驳回'); loadPage(page); onRefresh(); } catch {}
  };
  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请先选中试题'); return; }
    try { await apiClient.post('/question-admin/batch-approve', selectedRowKeys); message.success('批量通过 ' + selectedRowKeys.length + ' 道'); setSelectedRowKeys([]); loadPage(page); onRefresh(); } catch {}
  };
  const handleBatchReject = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请先选中试题'); return; }
    try { await apiClient.post('/question-admin/batch-reject', selectedRowKeys); message.success('批量驳回 ' + selectedRowKeys.length + ' 道'); setSelectedRowKeys([]); loadPage(page); onRefresh(); } catch { message.error('批量驳回失败'); }
  };

  const [editQuestion, setEditQuestion] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

  const reviewStatusMap: any = { PENDING: { color: 'orange', label: '待审核' }, APPROVED: { color: 'green', label: '已通过' }, REJECTED: { color: 'red', label: '已驳回' }, NEEDS_REVIEW: { color: 'gold', label: '待复审' } };

  return (
    <Card size="small">
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col flex="auto"><Input size="small" placeholder="搜索题目" prefix={<SearchOutlined />} value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => loadPage(1, { search })} allowClear /></Col>
        <Col><Select size="small" placeholder="题型" allowClear style={{ width: 90 }} value={typeFilter} onChange={setTypeFilter} options={toSelectOptions(qtypes)} /></Col>
        <Col><Select size="small" placeholder="难度" allowClear style={{ width: 80 }} value={diffFilter} onChange={setDiffFilter} options={toSelectOptions(diffs)} /></Col>
        <Col><Select size="small" placeholder="年级" allowClear style={{ width: 80 }} value={gradeFilter} onChange={setGradeFilter} options={toSelectOptions(grades)} /></Col>
        <Col><Input size="small" placeholder="模糊查询知识点" value={keywordFilter} onChange={e => setKeywordFilter(e.target.value)} style={{ width: 160 }} onPressEnter={() => loadPage(1, { keywordFilter })} allowClear /></Col>
        <Col><Button size="small" icon={<SearchOutlined />} onClick={() => loadPage(1, { search, typeFilter, diffFilter, gradeFilter, keywordFilter })}>查询</Button></Col>
        <Col><Popconfirm title={'确定通过 ' + selectedRowKeys.length + ' 道试题?'} onConfirm={handleBatchApprove} disabled={selectedRowKeys.length === 0}>
          <Button type="primary" size="small" disabled={selectedRowKeys.length === 0}>批量通过{selectedRowKeys.length > 0 ? '(' + selectedRowKeys.length + ')' : ''}</Button>
        </Popconfirm></Col>
        <Col><Popconfirm title={'确定驳回 ' + selectedRowKeys.length + ' 道试题?'} onConfirm={handleBatchReject} disabled={selectedRowKeys.length === 0}>
          <Button danger size="small" disabled={selectedRowKeys.length === 0}>批量驳回{selectedRowKeys.length > 0 ? '(' + selectedRowKeys.length + ')' : ''}</Button>
        </Popconfirm></Col>
      </Row>
      <Table rowKey="id" loading={loading} dataSource={questions} size="small"
        pagination={false}
        rowSelection={{ selectedRowKeys, onChange: (keys: any[]) => setSelectedRowKeys(keys) }}
        columns={[
          { title: '题目', dataIndex: 'title', ellipsis: true, width: 180 },
          { title: '选项', dataIndex: 'correct_answer', width: 140, render: (v: any) => <span style={{ fontSize: 12 }}>{parseOptions(v) || '-'}</span> },
          { title: '正确答案', dataIndex: 'correct_answer', width: 80, render: (v: any) => { const a = parseCorrect(v); return a ? <Tag color="green">{a}</Tag> : <span>-</span>; } },
          { title: '解题思路', dataIndex: 'explanation', width: 130, ellipsis: true, render: (v: string) => v || '-' },
          { title: '题型', dataIndex: 'question_type', width: 70, render: (t: string) => <Tag>{typeMap[t] || t}</Tag> },
          { title: '难度', dataIndex: 'difficulty', width: 60, render: (t: string) => <Tag color={toColorMap(diffs)[t]?.color}>{diffMap[t] || t}</Tag> },
          { title: '来源', dataIndex: 'source', width: 70, render: (s: string) => { const m = sourceMap[s]; return m ? <Tag color={m.color}>{m.label}</Tag> : <Tag>{s}</Tag>; } },
          { title: '状态', dataIndex: 'review_status', width: 80, render: (s: string) => { const m = reviewStatusMap[s]; return m ? <Tag color={m.color}>{m.label}</Tag> : <Tag>{s}</Tag>; } },
          { title: '时间', dataIndex: 'created_at', width: 100, render: (v: string) => (v || '').slice(0, 10) },
          {
            title: '操作', width: 120,
            render: (_: any, r: any) => (
              <Space size={2}>
                <Button size="small" type="link" icon={<EditOutlined />} onClick={() => { setEditQuestion(r); setEditOpen(true); }} />
                <Popconfirm title="确认通过?" onConfirm={() => handleApprove(r.id)}>
                  <Button size="small" type="link" style={{ color: '#52c41a' }} icon={<CheckOutlined />} />
                </Popconfirm>
                <Popconfirm title="确认驳回?" onConfirm={() => handleReject(r.id)}>
                  <Button size="small" type="link" danger icon={<CloseOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]} />
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        <span>共 {total} 道试题</span>
        <Pagination size="small" current={page} onChange={(p: number) => setPage(p)} pageSize={10} total={total} showSizeChanger={false} />
      </div>
      <QuestionEditModal
        question={editQuestion}
        open={editOpen}
        onSuccess={() => { setEditOpen(false); loadPage(page); }}
        onClose={() => setEditOpen(false)}
      />
    </Card>
  );
}


// ─── LLM Question List (below generate card, shows only LLM-generated) ───

const statusMap: any = {
  APPROVED:{color:'green',label:'已发布'}, PENDING:{color:'orange',label:'待审核'},
  REJECTED:{color:'red',label:'已驳回'}, NEEDS_REVIEW:{color:'gold',label:'待复审'},
};

function QuestionListBySource({ sourceFilter, title }: { sourceFilter: string, title: string }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<any>(undefined);
  const [diffFilter, setDiffFilter] = useState<any>(undefined);
  const [gradeFilter, setGradeFilter] = useState<any>(undefined);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<any>(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
  const [editQuestion, setEditQuestion] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { 'question-types': qtypes, 'difficulty-levels': diffs, 'question-sources': sources, 'grade-levels': grades } = useReferenceValues();
  const typeMap = useMemo(() => toLabelMap(qtypes), [qtypes]);
  const diffMap = useMemo(() => toLabelMap(diffs), [diffs]);
  const sourceMap = useMemo(() => toColorMap(sources), [sources]);

  const loadPage = (pg: number, filters?: { search?: string; typeFilter?: any; diffFilter?: any; gradeFilter?: any; keywordFilter?: string; statusFilter?: any }) => {
    setLoading(true);
    const s = filters?.search ?? search;
    const tf = filters?.typeFilter !== undefined ? filters.typeFilter : typeFilter;
    const df = filters?.diffFilter !== undefined ? filters.diffFilter : diffFilter;
    const gf = filters?.gradeFilter !== undefined ? filters.gradeFilter : gradeFilter;
    const kf = filters?.keywordFilter !== undefined ? filters.keywordFilter : keywordFilter;
    const sf = filters?.statusFilter !== undefined ? filters.statusFilter : statusFilter;
    const params: any = { limit: 10, skip: (pg - 1) * 10, source: sourceFilter };
    if (s) params.keyword = s;
    if (tf) params.question_type = tf;
    if (df) params.difficulty = df;
    if (gf) params.grade = gf;
    if (kf) params.keyword = kf;
    if (sf) params.review_status = sf;
    apiClient.get('/questions', { params }).then(({ data }: any) => {
      const resp = data || {};
      setQuestions(resp.items || (Array.isArray(resp) ? resp : []));
      setTotal(resp.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadPage(1); }, [sourceFilter]);
  useEffect(() => { loadPage(page); }, [page]);

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
        <Col flex="auto"><Input size="small" placeholder="搜索题目" prefix={<SearchOutlined />} value={search} onChange={e=>setSearch(e.target.value)} onPressEnter={() => loadPage(1, { search })} allowClear /></Col>
        <Col><Select size="small" placeholder="题型" allowClear style={{width:90}} value={typeFilter} onChange={setTypeFilter} options={toSelectOptions(qtypes)} /></Col>
        <Col><Select size="small" placeholder="难度" allowClear style={{width:80}} value={diffFilter} onChange={setDiffFilter} options={toSelectOptions(diffs)} /></Col>
        <Col><Select size="small" placeholder="年级" allowClear style={{width:80}} value={gradeFilter} onChange={setGradeFilter}
          options={toSelectOptions(grades)} /></Col>
        <Col><Select size="small" placeholder="状态" allowClear style={{width:80}} value={statusFilter} onChange={setStatusFilter}
          options={[{value:'PENDING',label:'待审核'},{value:'APPROVED',label:'已发布'},{value:'REJECTED',label:'已驳回'},{value:'NEEDS_REVIEW',label:'待复审'}]} /></Col>
        <Col><Input size="small" placeholder="模糊查询知识点" value={keywordFilter} onChange={e => setKeywordFilter(e.target.value)}
          style={{ width: 160 }} onPressEnter={() => loadPage(1, { keywordFilter })} allowClear /></Col>
        <Col><Button size="small" icon={<SearchOutlined />} onClick={() => loadPage(1, { search, typeFilter, diffFilter, gradeFilter, keywordFilter, statusFilter })}>查询</Button></Col>
        <Col>
          <Popconfirm title={'确定删除 ' + selectedRowKeys.length + ' 道试题?'} onConfirm={handleBatchDelete} disabled={selectedRowKeys.length===0}>
            <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length===0}>
              批量删除{selectedRowKeys.length>0 ? '(' + selectedRowKeys.length + ')' : ''}
            </Button>
          </Popconfirm>
        </Col>
      </Row>
      <Table rowKey="id" loading={loading} dataSource={questions} size="small"
        pagination={false}
        rowSelection={{ selectedRowKeys, onChange: (keys: any[]) => setSelectedRowKeys(keys) }}
        columns={[
          { title: '题目', dataIndex: 'title', ellipsis: true },
          { title: '题型', dataIndex: 'question_type', width:70, render:(t:string)=><Tag>{typeMap[t]||t}</Tag> },
          { title: '难度', dataIndex: 'difficulty', width:60, render:(t:string)=><Tag color={toColorMap(diffs)[t]?.color}>{diffMap[t]||t}</Tag> },
          { title: '来源', dataIndex: 'source', width:80, render:(s:string)=>{const m=sourceMap[s];return m ? <Tag color={m.color}>{m.label}</Tag> : <Tag>{s}</Tag>;} },
          { title: '状态', dataIndex: 'review_status', width:80, render:(s:string)=>{const m=statusMap[s];return m ? <Tag color={m.color}>{m.label}</Tag> : <Tag>{s}</Tag>;} },
          { title: '时间', dataIndex: 'created_at', width:100, render:(v:string)=>(v||'').slice(0,10) },
          { title: '操作', width:100, render:(_:any, r:any) => (
            <Space size={2}>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => { setEditQuestion(r); setEditOpen(true); }} />
              <Popconfirm title="确定删除?" onConfirm={() => handleSingleDelete(r.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          )},
        ]} />
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          <span>共 {total} 道试题</span>
          <Pagination size="small" current={page} onChange={(p: number) => setPage(p)} pageSize={10} total={total} showSizeChanger={false} />
        </div>
        <QuestionEditModal
          question={editQuestion}
          open={editOpen}
          onSuccess={() => { setEditOpen(false); loadPage(page); }}
          onClose={() => setEditOpen(false)}
        />
    </Card>
  );
}
