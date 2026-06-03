import { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, Button, Form, Input, Select, InputNumber, Row, Col, Popconfirm,
  Tabs, Tag, Space, message, Typography, Badge, Alert, Divider, Pagination,
  Radio, Empty, TreeSelect, Progress, Spin
} from 'antd';
import {
  RobotOutlined, GlobalOutlined,
  CheckOutlined, CloseOutlined,
  ApiOutlined, SearchOutlined, DeleteOutlined, EditOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toColorMap, toSelectOptions } from '../../hooks/useReferenceValues';
import QuestionEditModal from '../questions/QuestionEditModal';

const { Title, Text } = Typography;

export default function QuestionAdminPage() {
  const [activeTab, setActiveTab] = useState('generate');
  const [, setSyllabi] = useState<any[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [testPassed, setTestPassed] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<{value:string,label:string}[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [llmProvider, setLlmProvider] = useState<string>('ollama');
  const [, setDsApiKey] = useState('');
  const [dsModel, setDsModel] = useState('deepseek-chat');
  const [dsModels, setDsModels] = useState<string[]>([]);
  const [genForm] = Form.useForm();
  const [promptText, setPromptText] = useState(
    '你是一位专业的教育题目生成专家。请根据以下要求生成试题，直接返回JSON数组。\n\n' +
    '要求：\n- 知识点：(未填)\n- 难度：MEDIUM\n- 题型：SINGLE_CHOICE\n' +
    '- 数量：3道\n- 年级：G8\n- 学科：数学\n\n' +
    '返回格式：严格的JSON数组，不要markdown代码块。'
  );
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [taskProgress, setTaskProgress] = useState<any>(null);

  // Dedup state
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupResult, setDedupResult] = useState<{ ok: boolean; total_scanned: number; duplicate_groups: number; groups: { id: string; title: string; question_type: string; subject: string }[][] } | null>(null);
  const [dedupSelections, setDedupSelections] = useState<Record<number, string>>({});
  const [dedupMerging, setDedupMerging] = useState<number | null>(null);

  useEffect(() => {
    loadSyllabi();
    loadLlmConfigs();
    loadPendingQuestions();
  }, []);

  const { 'grade-levels': grades, 'difficulty-levels': diffs, 'question-types': qtypes } = useReferenceValues();

  const loadSyllabi = async () => {
    try { const { data } = await apiClient.get('/question-admin/syllabi'); setSyllabi(data); } catch {}
  };
  const loadLlmConfigs = async () => {
    try {
      const { data } = await apiClient.get('/admin/llm/config');
      setLlmProvider(data.current || 'ollama');
      const ollama = data.ollama || {};
      const deepseek = data.deepseek || {};
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
      const payload: any = { provider: llmProvider };
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
        const errMsg = data.error || data.detail || JSON.stringify(data);
        message.error(errMsg);
        setTaskProgress({ ok: false, error: errMsg, count: 0 });
      }
    } catch(e: unknown) {
      const err = e as any;
      let msg = '网络请求失败';
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
  const [scrapeKnNodes, setScrapeKnNodes] = useState<any[]>([]);
  const [scrapeTaskCount, setScrapeTaskCount] = useState(1);
  const [scrapeDetailExpanded, setScrapeDetailExpanded] = useState(false);
  const [scrapeDetailText, setScrapeDetailText] = useState('');
  const [scrapeResults, setScrapeResults] = useState<any[]>([]);
  const [scrapeResultsLoading, setScrapeResultsLoading] = useState(false);
  const [scrapePage, setScrapePage] = useState(1);
  const [scrapeTotal, setScrapeTotal] = useState(0);
  const PAGE_SIZE = 20;

  const [scrapeEditQ, setScrapeEditQ] = useState<any>(null);
  const [scrapeEditOpen, setScrapeEditOpen] = useState(false);
  const handleScrapeDelete = async (id: string) => {
    try { await apiClient.delete('/questions/' + id); message.success('已删除'); loadScrapeResults(); }
    catch { message.error('删除失败'); }
  };

  const loadScrapeResults = (pg = 1) => {
    setScrapeResultsLoading(true);
    setScrapePage(pg);
    apiClient.get('/questions', { params: { source: 'SCRAPED', limit: PAGE_SIZE, skip: (pg-1)*PAGE_SIZE } })
      .then(({ data }: any) => {
        const resp = data || {};
        setScrapeResults(resp.items || (Array.isArray(resp) ? resp : []));
        setScrapeTotal(resp.total || 0);
      }).catch(() => {}).finally(() => setScrapeResultsLoading(false));
  };

  // 加载知识树用于知识点选择
  useEffect(() => {
    apiClient.get('/question-admin/syllabi').then((resp: any) => {
      const syllabi: any[] = resp.data || [];
      if (syllabi.length > 0) {
        apiClient.get(`/knowledge-tree/syllabi/${syllabi[0].id}/tree`).then((treeResp: any) => {
          const tree = treeResp.data?.tree || treeResp.data || [];
          setScrapeKnNodes(tree);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);
  useEffect(() => { loadScrapeResults(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateScrapeConditions = () => {
    const v = scrapeForm.getFieldsValue();
    const kps = Array.isArray(v.knowledge_points) ? v.knowledge_points : (v.knowledge_points ? [v.knowledge_points] : []);
    const gls = Array.isArray(v.grade_levels) ? v.grade_levels : (v.grade_levels ? [v.grade_levels] : ['G8']);
    const qts = Array.isArray(v.question_types) ? v.question_types : (v.question_types ? [v.question_types] : ['SINGLE_CHOICE']);
    const n = kps.length * gls.length * qts.length;
    setScrapeTaskCount(n || 1);
    const c = v.count || 5;
    const labels: Record<string,string> = {SINGLE_CHOICE:'单选题',MULTIPLE_CHOICE:'多选题',FILL_BLANK:'填空题',SUBJECTIVE:'解答题'};
    setScrapeDetailText(kps.flatMap((kp:string) => gls.flatMap((gl:string) => qts.map((qt:string) =>
      `知识点: ${kp} → 年级: ${gl} → ${labels[qt]||qt} ×${c}`
    ))).join('\n'));
    setScrapeDetailExpanded(false);
  };

  const handleScrape = async (values: any) => {
    // 从 TreeSelect UUID 提取 title 作为知识点名称
    const chosenIds: string[] = Array.isArray(values.knowledge_points) ? values.knowledge_points : (values.knowledge_points ? [values.knowledge_points] : []);
    const findTitle = (nodes: any[], id: string): string | null => {
      for (const n of nodes) {
        if (n.key === id) return n.title;
        if (n.children) { const f = findTitle(n.children, id); if (f) return f; }
      }
      return null;
    };
    const kpNames = chosenIds.map(id => findTitle(scrapeKnNodes, id)).filter(Boolean);

    const params: any = {
      knowledge_points: kpNames.join(',') || values.knowledge_points,
      grade_levels: (values.grade_levels || ['G8']).join(','),
      question_types: (values.question_types || ['SINGLE_CHOICE']).join(','),
      count: values.count || 5,
      subject: values.subject || '数学',
      difficulty: values.difficulty || 'MEDIUM',
    };

    setScraping(true); setTaskProgress(null);
    try {
      const { data } = await apiClient.post('/question-admin/scrape', null, { params });
      setTaskProgress(data);
      if (data.ok) {
        message.success(`抓取完成: ${data.count || 0} 道试题已入库（${data.tasks || 1} 个任务）`);
        loadPendingQuestions();
        loadScrapeResults();
      } else {
        message.error(data.error || '抓取失败');
      }
    } catch (e: any) {
      const body = e?.response?.data;
      const detail = body?.detail || body?.message || '';
      if (typeof detail === 'string' && detail.length > 0) {
        message.error(detail);
      } else if (e?.code === 'ERR_NETWORK') {
        message.error('网络连接失败');
      } else if (e?.code === 'ECONNABORTED') {
        message.error('抓取请求超时');
      } else {
        message.error('抓取失败，请检查网络');
      }
    }
    finally { setScraping(false); }
  };

  // Dedup handlers
  const handleDedupScan = async () => {
    setDedupLoading(true);
    setDedupResult(null);
    setDedupSelections({});
    try {
      const { data } = await apiClient.post('/question-admin/dedup');
      setDedupResult(data);
      // Default: select first question in each group as "keep"
      const sels: Record<number, string> = {};
      (data.groups || []).forEach((g: { id: string }[], i: number) => {
        if (g.length > 0) sels[i] = g[0].id;
      });
      setDedupSelections(sels);
      if (data.duplicate_groups === 0) {
        message.success('扫描完成，未发现重复试题');
      } else {
        message.success(`扫描完成，发现 ${data.duplicate_groups} 组重复`);
      }
    } catch {
      message.error('扫描失败');
    } finally {
      setDedupLoading(false);
    }
  };

  const handleDedupMerge = async (idx: number) => {
    const keepId = dedupSelections[idx];
    if (!keepId || !dedupResult) return;
    const group = dedupResult.groups[idx];
    const removeIds = group.filter(q => q.id !== keepId).map(q => q.id);
    setDedupMerging(idx);
    try {
      // FastAPI List[str] query param: manually join to avoid axios bracket encoding
      const params = new URLSearchParams();
      params.append('keep_id', keepId);
      removeIds.forEach(id => params.append('remove_ids', id));
      const { data } = await apiClient.post(`/question-admin/dedup/merge?${params.toString()}`);
      message.success(data.message || '合并成功');
      // Remove merged group from result
      setDedupResult((prev) => {
        if (!prev) return prev;
        const newGroups = prev.groups.filter((_, i) => i !== idx);
        return { ...prev, groups: newGroups, duplicate_groups: newGroups.length };
      });
      setDedupSelections((prev) => {
        const next: Record<number, string> = {};
        Object.entries(prev).forEach(([k, v]) => {
          const ki = Number(k);
          if (ki < idx) next[ki] = v;
          else if (ki > idx) next[ki - 1] = v;
        });
        return next;
      });
    } catch {
      message.error('合并失败');
    } finally {
      setDedupMerging(null);
    }
  };

  const typeMap = useMemo(() => toLabelMap(qtypes), [qtypes]);
  const pageDiffMap = useMemo(() => toLabelMap(diffs), [diffs]);
  const SCRAPE_SOURCE_MAP: Record<string, { color: string; label: string }> = {
    SCRAPED: { color: 'orange', label: '网络抓取' },
    LLM_GENERATED: { color: 'purple', label: 'LLM生成' },
    MANUAL: { color: 'blue', label: '手工创建' },
  };
  const REVIEW_STATUS_MAP: Record<string, { color: string; label: string }> = {
    PENDING: { color: 'orange', label: '待审核' },
    APPROVED: { color: 'green', label: '已通过' },
    REJECTED: { color: 'red', label: '已驳回' },
    NEEDS_REVIEW: { color: 'gold', label: '待复审' },
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
                  const p = `你是一位专业的教育题目生成专家。请根据以下要求生成试题，直接返回JSON数组。\n\n要求：\n- 知识点：${all.knowledge_point || '(未填)'}\n- 难度：${all.difficulty || 'MEDIUM'}\n- 题型：${all.question_type || 'SINGLE_CHOICE'}\n- 数量：${all.count || 3}道\n- 年级：${all.grade_level || 'G8'}\n- 学科：${all.subject || '数学'}\n\n返回格式：严格的JSON数组，不要markdown代码块。`;
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
        {/* 搜索条件栏 — 单行 */}
        <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
          <Form form={scrapeForm} onFinish={handleScrape} size="small"
            onValuesChange={updateScrapeConditions}
            initialValues={{ subject: '数学', grade_levels: ['G8'], difficulty: 'MEDIUM', question_types: ['SINGLE_CHOICE'], count: 5 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Form.Item name="subject" style={{ marginBottom: 0, minWidth: 80 }}>
                <Select options={subjectOptions} placeholder="学科" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="grade_levels" style={{ marginBottom: 0, minWidth: 120 }}>
                <Select mode="multiple" options={toSelectOptions(grades)} placeholder="年级" maxTagCount={2} allowClear style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="knowledge_points" rules={[{ required: true, message: '请选择知识点' }]} style={{ marginBottom: 0, minWidth: 200, flex: 1 }}>
                <TreeSelect
                  treeData={(function convertTree(nodes: any[]): any[] {
                    return (nodes || []).map((n: any) => ({
                      value: n.key, title: n.title,
                      children: n.children ? convertTree(n.children) : undefined,
                    }));
                  })(scrapeKnNodes)}
                  placeholder="选择知识点" treeCheckable showCheckedStrategy={TreeSelect.SHOW_CHILD}
                  allowClear maxTagCount={3} style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item name="difficulty" style={{ marginBottom: 0, minWidth: 80 }}>
                <Select options={toSelectOptions(diffs)} placeholder="难度" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="question_types" style={{ marginBottom: 0, minWidth: 110 }}>
                <Select mode="multiple" options={toSelectOptions(qtypes)} placeholder="题型" maxTagCount={2} allowClear style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="count" style={{ marginBottom: 0, width: 52 }}>
                <InputNumber min={1} max={20} placeholder="数量" style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<GlobalOutlined />} loading={scraping}>开始抓取</Button>
            </div>
          </Form>

          {/* 任务预览条 */}
          <div style={{ marginTop: 10, padding: '6px 10px', background: '#f6f8fa', borderRadius: 6, fontSize: 12, color: '#888' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>将拆分 <b style={{ color: '#1677ff' }}>{scrapeTaskCount}</b> 个任务</span>
              <span style={{ color: '#ddd' }}>|</span>
              <span>预计入库 ≤ <b>{(() => { const v = scrapeForm.getFieldsValue(); return (v.count || 5) * scrapeTaskCount * 3; })()}</b> 道</span>
              <span style={{ color: '#ddd' }}>|</span>
              <span>DDG → 百度 → LLM</span>
              {scrapeDetailText && (
                <span style={{ marginLeft: 'auto', color: '#1677ff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => setScrapeDetailExpanded(!scrapeDetailExpanded)}>
                  {scrapeDetailExpanded ? '收起 ▲' : '展开详情 ▸'}
                </span>
              )}
            </div>
            {scrapeDetailExpanded && (
              <div style={{ marginTop: 6, padding: '6px 8px', background: '#fff', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {scrapeDetailText}
              </div>
            )}
          </div>

          {/* 进度条 */}
          {scraping && (
            <div style={{ marginTop: 8, background: '#e6f4ff', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <div style={{ flex: 1, height: 4, background: '#d9d9d9', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: '60%', height: '100%', background: '#1677ff', borderRadius: 2, animation: 'scrape-progress 1.5s ease-in-out infinite' }} />
              </div>
              <span style={{ color: '#1677ff', whiteSpace: 'nowrap' }}>抓取中... {scrapeTaskCount} 个任务</span>
            </div>
          )}

          {/* 结果汇总 */}
          {taskProgress && (
            <div style={{ marginTop: 8 }}>
              {taskProgress.ok
                ? <div style={{ padding: '6px 10px', background: '#f6ffed', borderRadius: 6, fontSize: 12, color: '#52c41a' }}>
                    已入库 <b>{taskProgress.count}</b> 道试题（{taskProgress.tasks || scrapeTaskCount} 个任务完成）
                  </div>
                : <Alert style={{ padding: '2px 12px', fontSize: 12 }} type="error" message={taskProgress.error || '抓取失败'} />
              }
            </div>
          )}
        </Card>

        <Card size="small" title={<span>抓取结果 <span style={{fontWeight:400,color:'#999',fontSize:12}}>共 {scrapeResults.length} 道</span></span>}
          extra={<span style={{fontSize:11,color:'#999'}}>仅展示本次抓取 · 已在题库中</span>} style={{marginTop:16}}>
          <Spin spinning={scrapeResultsLoading}>
            {scrapeResults.length===0 && !scrapeResultsLoading && <Empty description="暂无抓取结果"/>}
            {scrapeResults.length > 0 && (
              <div style={{display:'flex',alignItems:'center',padding:'4px 12px',fontSize:10,color:'#bbb',borderBottom:'1px solid #f0f0f0'}}>
                <span style={{width:28}}>#</span>
                <span style={{flex:1}}>题目</span>
                <span style={{width:90,textAlign:'center'}}>时间</span>
                <span style={{width:50,textAlign:'center'}}>状态</span>
                <span style={{width:60,textAlign:'right'}}>操作</span>
              </div>
            )}
            {scrapeResults.map((q:any,i:number)=>(
              <div key={q.id} style={{display:'flex',alignItems:'flex-start',padding:'10px 12px',borderBottom:i<scrapeResults.length-1?'1px solid #f5f5f5':'none'}}>
                <span style={{width:28,color:'#999',fontSize:12,paddingTop:2,flexShrink:0}}>{i+1}</span>
                <div style={{flex:1,minWidth:0,paddingRight:12}}>
                  <div style={{fontSize:13,lineHeight:1.5,marginBottom:4}}>{q.title?.substring(0,120)}</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    <Tag color={(toColorMap(diffs)[q.difficulty] as any)?.color||'default'} style={{fontSize:10}}>{pageDiffMap[q.difficulty]||q.difficulty}</Tag>
                    <Tag color="blue" style={{fontSize:10}}>{typeMap[q.question_type]||q.question_type}</Tag>
                    {q.score!=null && <Tag color="orange" style={{fontSize:10}}>{q.score}分</Tag>}
                    {(q.grade_level?.knowledge_points||[]).slice(0,2).map((kp:string,j:number)=>(<Tag key={j} color="purple" style={{fontSize:10}}>{kp}</Tag>))}
                    <Tag color={SCRAPE_SOURCE_MAP[q.source]?.color||'default'} style={{fontSize:10}}>{SCRAPE_SOURCE_MAP[q.source]?.label||q.source}</Tag>
                  </div>
                </div>
                <span style={{width:90,fontSize:11,color:'#999',textAlign:'center',paddingTop:2,flexShrink:0}}>{(q.created_at||'').slice(5,16).replace('T',' ')}</span>
                <span style={{width:50,textAlign:'center',paddingTop:2,flexShrink:0}}>
                  <Tag color={REVIEW_STATUS_MAP[q.review_status]?.color||'default'} style={{fontSize:10,margin:0}}>{REVIEW_STATUS_MAP[q.review_status]?.label||q.review_status}</Tag>
                </span>
                <div style={{width:60,display:'flex',gap:4,justifyContent:'flex-end',flexShrink:0,paddingTop:1}}>
                  <Button size="small" type="link" icon={<EditOutlined/>} onClick={()=>{setScrapeEditQ(q);setScrapeEditOpen(true);}}/>
                  <Popconfirm title="确定删除?" onConfirm={()=>handleScrapeDelete(q.id)}>
                    <Button size="small" type="link" danger icon={<DeleteOutlined/>}/>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </Spin>
          {scrapeTotal > PAGE_SIZE && (
            <div style={{textAlign:'center',padding:'8px 0'}}>
              <Pagination size="small" current={scrapePage} pageSize={PAGE_SIZE} total={scrapeTotal}
                onChange={(pg) => loadScrapeResults(pg)} showTotal={(t) => `共 ${t} 道`} />
            </div>
          )}
        </Card>
        {scrapeEditOpen && scrapeEditQ && (
          <QuestionEditModal open={scrapeEditOpen} question={scrapeEditQ}
            onClose={()=>{setScrapeEditOpen(false);setScrapeEditQ(null);}}
            onSuccess={()=>{setScrapeEditOpen(false);setScrapeEditQ(null);loadScrapeResults();}}/>
        )}
      </>),
    },
    {
      key: 'review',
      label: <span><CheckOutlined />审核试题 <Badge count={pendingCount} /></span>,
      children: <ReviewQuestionList onRefresh={() => loadPendingQuestions()} />,
    },
    {
      key: 'dedup',
      label: <span><CopyOutlined />去重管理</span>,
      children: (<>
        <Card size="small" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button type="primary" size="small" icon={<CopyOutlined />} loading={dedupLoading} onClick={handleDedupScan}>
              扫描重复试题
            </Button>
            {dedupResult && (
              <span style={{ fontSize: 13, color: '#666' }}>
                共扫描 <strong>{dedupResult.total_scanned}</strong> 道活跃试题，
                发现 <strong>{dedupResult.duplicate_groups}</strong> 组重复
              </span>
            )}
          </div>
        </Card>

        {dedupResult && (
          dedupResult.groups.length === 0 ? (
            <Empty description="未发现重复试题，题库状态良好" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dedupResult.groups.map((group, idx) => (
                <Card size="small" key={idx} styles={{ body: { padding: '12px 16px' } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>重复组 #{idx + 1}（{group.length} 道相似题目）</Text>
                    <Tag color="blue">相似度 ≥85%</Tag>
                  </div>
                  <Radio.Group
                    value={dedupSelections[idx]}
                    onChange={(e) => setDedupSelections((prev) => ({ ...prev, [idx]: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.map((q) => (
                        <div
                          key={q.id}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 4,
                            border: dedupSelections[idx] === q.id ? '1px solid #52c41a' : '1px solid #f0f0f0',
                            background: dedupSelections[idx] === q.id ? '#f6ffed' : '#fafafa',
                          }}
                        >
                          <Radio value={q.id}>
                            <span style={{ fontSize: 13 }}>
                              {q.title.length > 80 ? q.title.slice(0, 80) + '...' : q.title}
                            </span>
                            <Space size={4} style={{ marginLeft: 8 }}>
                              <Tag style={{ fontSize: 11 }}>{typeMap[q.question_type] || q.question_type}</Tag>
                              {q.subject && <Tag style={{ fontSize: 11 }}>{q.subject}</Tag>}
                              {dedupSelections[idx] === q.id && <Tag color="green" style={{ fontSize: 11 }}>保留</Tag>}
                            </Space>
                          </Radio>
                        </div>
                      ))}
                    </div>
                  </Radio.Group>
                  <div style={{ marginTop: 10, textAlign: 'right' }}>
                    <Popconfirm
                      title={`确定保留所选题目并禁用其余 ${group.length - 1} 道重复题？`}
                      onConfirm={() => handleDedupMerge(idx)}
                      disabled={!dedupSelections[idx]}
                    >
                      <Button
                        type="primary"
                        size="small"
                        loading={dedupMerging === idx}
                        disabled={!dedupSelections[idx]}
                      >
                        合并
                      </Button>
                    </Popconfirm>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {dedupResult && dedupResult.duplicate_groups > 0 && dedupResult.groups.length === 0 && (
          <Alert type="success" message="所有重复组已处理完毕" showIcon style={{ marginTop: 12 }} />
        )}
      </>),
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
  const { 'question-types': qtypes, 'difficulty-levels': diffs, 'question-sources': sources, 'grade-levels': grades } = useReferenceValues();
  const typeMap = useMemo(() => toLabelMap(qtypes), [qtypes]);
  const diffMap = useMemo(() => toLabelMap(diffs), [diffs]);
  const sourceMap = useMemo(() => toColorMap(sources), [sources]);

  const loadPage = (pg: number) => {
    setLoading(true);
    const params: any = { limit: 10, skip: (pg - 1) * 10 };
    if (search) params.keyword = search;
    if (typeFilter) params.question_type = typeFilter;
    if (diffFilter) params.difficulty = diffFilter;
    if (gradeFilter) params.grade = gradeFilter;
    apiClient.get('/question-admin/pending', { params }).then(({ data }: any) => {
      const resp = data || {};
      setQuestions(resp.items || (Array.isArray(resp) ? resp : []));
      setTotal(resp.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadPage(page); }, [page, search, typeFilter, diffFilter, gradeFilter]); // eslint-disable-line

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
        <Col flex="auto"><Input size="small" placeholder="搜索题目/知识点" prefix={<SearchOutlined />} value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => loadPage(1)} allowClear /></Col>
        <Col><Select size="small" placeholder="题型" allowClear style={{ width: 90 }} value={typeFilter} onChange={v => { setTypeFilter(v); setPage(1); }} options={toSelectOptions(qtypes)} /></Col>
        <Col><Select size="small" placeholder="难度" allowClear style={{ width: 80 }} value={diffFilter} onChange={v => { setDiffFilter(v); setPage(1); }} options={toSelectOptions(diffs)} /></Col>
        <Col><Select size="small" placeholder="年级" allowClear style={{ width: 80 }} value={gradeFilter} onChange={v => { setGradeFilter(v); setPage(1); }} options={toSelectOptions(grades)} /></Col>
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
          { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => (v || '').slice(0, 16).replace('T', ' ') },
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPage(1); }, [sourceFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPage(page); }, [page]);

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请先选中试题'); return; }
    try {
      await apiClient.post('/questions/batch-delete', selectedRowKeys);
      message.success('已删除 ' + selectedRowKeys.length + ' 道');
      setSelectedRowKeys([]); loadPage(page);
    } catch { message.error('批量删除失败'); }
  };

  const handleSingleDelete = async (id: string) => {
    try {
      await apiClient.delete('/questions/' + id);
      message.success('已删除');
      loadPage(page);
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
          { title: '抓取时间', dataIndex: 'created_at', width:140, render:(v:string)=>(v||'').slice(0,16).replace('T',' ') },
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
