import { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, Button, Form, Input, Select, InputNumber, Row, Col, Popconfirm,
  Tabs, Tag, Space, message, Typography, Badge, Alert, Divider, Pagination,
  Radio, Empty, TreeSelect, Progress, Spin, Checkbox
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
      const kpVal = values.knowledge_point;
      const kpStr = Array.isArray(kpVal) ? kpVal.map((id:string)=>{const m:Record<string,string>={};(function w(ns:any[]){for(const n of ns||[]){m[n.key]=n.title;if(n.children)w(n.children);}})(scrapeKnNodes);return m[id]||id;}).join(',') : (kpVal||'');
      const { data } = await apiClient.post('/question-admin/generate', null, {
        params: { ...values, knowledge_point: kpStr, model: llmProvider === 'deepseek' ? dsModel : selectedModel, provider: llmProvider }
      });
      setTaskProgress(data);
      if (data.ok) {
        message.success('成功生成 ' + data.count + ' 道试题');
        loadPendingQuestions();
        loadLlmResults();
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
  const [scrapeHelpOpen, setScrapeHelpOpen] = useState(false);
  const [llmResults, setLlmResults] = useState<any[]>([]);
  const [llmResultsLoading, setLlmResultsLoading] = useState(false);
  const [llmPage, setLlmPage] = useState(1);
  const [llmTotal, setLlmTotal] = useState(0);
  const [llmPageSize, setLlmPageSize] = useState(10);
  const [llmSelectedIds, setLlmSelectedIds] = useState<string[]>([]);
  const [llmEditQ, setLlmEditQ] = useState<any>(null);
  const [llmEditOpen, setLlmEditOpen] = useState(false);
  const [llmPromptExpanded, setLlmPromptExpanded] = useState(false);
  const [llmSearch, setLlmSearch] = useState('');
  const [llmTypeFilter, setLlmTypeFilter] = useState<string|undefined>();
  const [llmDiffFilter, setLlmDiffFilter] = useState<string|undefined>();
  const [llmStatusFilter, setLlmStatusFilter] = useState<string|undefined>();
  const [llmHelpOpen, setLlmHelpOpen] = useState(false);
  const [scrapeResults, setScrapeResults] = useState<any[]>([]);
  const [scrapeResultsLoading, setScrapeResultsLoading] = useState(false);
  const [scrapePage, setScrapePage] = useState(1);
  const [scrapeTotal, setScrapeTotal] = useState(0);
  const [scrapePageSize, setScrapePageSize] = useState(10);
  const [scrapeTypeFilter, setScrapeTypeFilter] = useState<string|undefined>();
  const [scrapeDiffFilter, setScrapeDiffFilter] = useState<string|undefined>();
  const [scrapeStatusFilter, setScrapeStatusFilter] = useState<string|undefined>();
  const [scrapeSearchInput, setScrapeSearchInput] = useState('');
  const [scrapeSelectedIds, setScrapeSelectedIds] = useState<string[]>([]);

  const [scrapeEditQ, setScrapeEditQ] = useState<any>(null);
  const [scrapeEditOpen, setScrapeEditOpen] = useState(false);
  const handleScrapeDelete = async (id: string) => {
    try { await apiClient.delete('/questions/' + id); message.success('已删除'); loadScrapeResults(); }
    catch { message.error('删除失败'); }
  };
  const handleScrapeBatchDelete = async () => {
    if (scrapeSelectedIds.length===0) { message.warning('请先选中试题'); return; }
    try { await apiClient.post('/questions/batch-delete', scrapeSelectedIds);
      message.success('已删除 '+scrapeSelectedIds.length+' 道'); setScrapeSelectedIds([]); loadScrapeResults(); }
    catch { message.error('批量删除失败'); }
  };

  const loadScrapeResultsWithFilters = (pg = 1, ps = scrapePageSize, tf = scrapeTypeFilter, df = scrapeDiffFilter, sf = scrapeStatusFilter, kw = scrapeSearchInput) => {
    setScrapeResultsLoading(true);
    setScrapePage(pg); setScrapePageSize(ps);
    setScrapeTypeFilter(tf); setScrapeDiffFilter(df); setScrapeStatusFilter(sf); setScrapeSearchInput(kw);
    const params: any = { source: 'SCRAPED', limit: ps, skip: (pg-1)*ps };
    if (tf) params.question_type = tf;
    if (df) params.difficulty = df;
    if (sf) params.review_status = sf;
    if (kw) params.keyword = kw;
    apiClient.get('/questions', { params })
      .then(({ data }: any) => {
        const resp = data || {};
        setScrapeResults(resp.items || (Array.isArray(resp) ? resp : []));
        setScrapeTotal(resp.total || 0);
      }).catch(() => {}).finally(() => setScrapeResultsLoading(false));
  };

  const loadScrapeResults = (pg = 1, ps = scrapePageSize) => {
    setScrapeResultsLoading(true);
    setScrapePage(pg);
    setScrapePageSize(ps);
    apiClient.get('/questions', { params: { source: 'SCRAPED', limit: ps, skip: (pg-1)*ps } })
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
  useEffect(() => { loadScrapeResults(); loadLlmResults(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLlmResults = (pg=1,ps=llmPageSize,tf=llmTypeFilter,df=llmDiffFilter,sf=llmStatusFilter,kw=llmSearch) => {
    setLlmResultsLoading(true); setLlmPage(pg); setLlmPageSize(ps);
    setLlmTypeFilter(tf); setLlmDiffFilter(df); setLlmStatusFilter(sf); setLlmSearch(kw);
    const p:any={source:'LLM_GENERATED',limit:ps,skip:(pg-1)*ps};
    if(tf)p.question_type=tf; if(df)p.difficulty=df; if(sf)p.review_status=sf; if(kw)p.keyword=kw;
    apiClient.get('/questions',{params:p}).then(({data}:any)=>{const r=data||{};setLlmResults(r.items||[]);setLlmTotal(r.total||0);}).catch(()=>{}).finally(()=>setLlmResultsLoading(false));
  };
  const handleLlmDelete = async (id:string) => { try{await apiClient.delete('/questions/'+id);message.success('已删除');loadLlmResults();} catch{message.error('删除失败');} };
  const handleLlmBatchDelete = async () => { if(llmSelectedIds.length===0){message.warning('请先选中');return;} try{await apiClient.post('/questions/batch-delete',llmSelectedIds);message.success('已删除 '+llmSelectedIds.length+' 道');setLlmSelectedIds([]);loadLlmResults();} catch{message.error('批量删除失败');} };

  const updateScrapeConditions = () => {
    const v = scrapeForm.getFieldsValue();
    const kps = Array.isArray(v.knowledge_points) ? v.knowledge_points : (v.knowledge_points ? [v.knowledge_points] : []);
    const gls = Array.isArray(v.grade_levels) ? v.grade_levels : (v.grade_levels ? [v.grade_levels] : ['G8']);
    const qts = Array.isArray(v.question_types) ? v.question_types : (v.question_types ? [v.question_types] : ['SINGLE_CHOICE']);
    const n = kps.length * gls.length * qts.length;
    setScrapeTaskCount(n || 1);
    const c = v.count || 5;
    const labels: Record<string,string> = {SINGLE_CHOICE:'单选题',MULTIPLE_CHOICE:'多选题',FILL_BLANK:'填空题',SUBJECTIVE:'解答题'};
    const nameMap:Record<string,string>={};
    (function walk(ns:any[]){for(const n of ns||[]){nameMap[n.key]=n.title;if(n.children)walk(n.children);}})(scrapeKnNodes);
    setScrapeDetailText(kps.flatMap((kp:string)=>gls.flatMap((gl:string)=>qts.map((qt:string)=>
      `知识点: ${nameMap[kp]||kp} → 年级: ${gl} → ${labels[qt]||qt} ×${c}`
    ))).join('\n'));
    setScrapeDetailExpanded(false);
  };

  const handleScrape = async (values: any) => {
    // 从 TreeSelect UUID 提取 title 作为知识点名称
    const chosenIds: string[] = Array.isArray(values.knowledge_points) ? values.knowledge_points : (values.knowledge_points ? [values.knowledge_points] : []);
    const kpNames = chosenIds.map((id:string)=>{const m:Record<string,string>={};(function w(ns:any[]){for(const n of ns||[]){m[n.key]=n.title;if(n.children)w(n.children);}})(scrapeKnNodes);return m[id];}).filter(Boolean);

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
        {/* 模型配置栏 */}
        <Card size="small" styles={{body:{padding:'10px 16px'}}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <Select size="small" value={llmProvider} onChange={v=>{setLlmProvider(v);setTestPassed(false);}}
              style={{width:150}} options={[{value:'ollama',label:'Ollama (本地)'},{value:'deepseek',label:'DeepSeek (云端)'}]} />
            {llmProvider==='ollama'
              ? <Select size="small" placeholder="选择模型" style={{flex:1}} value={selectedModel} onChange={setSelectedModel} options={llmConfigs.map((m:string)=>({value:m,label:m}))} />
              : <Select size="small" placeholder="选择模型" style={{flex:1}} value={dsModel} onChange={setDsModel} options={dsModels.map((m:string)=>({value:m,label:m}))} />
            }
            <Button size="small" icon={<ApiOutlined/>} onClick={handleTestConnection} loading={testLoading}>{testPassed?'已连接':'测试连接'}</Button>
          </div>
        </Card>

        {/* 生成条件栏 */}
        <Card size="small" style={{marginTop:8}} styles={{body:{padding:'12px 16px'}}}>
          <Form form={genForm} onFinish={handleGenerateQuestions} size="small"
            onValuesChange={(_,all)=>{const m:Record<string,string>={};(function w(ns:any[]){for(const n of ns||[]){m[n.key]=n.title;if(n.children)w(n.children);}})(scrapeKnNodes);const kp=Array.isArray(all.knowledge_point)?all.knowledge_point.map((id:string)=>m[id]||id).join(','):(all.knowledge_point||'(未填)');const dl:Record<string,string>={EASY:'简单',MEDIUM:'中等',HARD:'困难'};const tl:Record<string,string>={SINGLE_CHOICE:'单选题',MULTIPLE_CHOICE:'多选题',FILL_BLANK:'填空题',SUBJECTIVE:'解答题'};const gl:Record<string,string>={G5:'五年级',G6:'六年级',G7:'七年级',G8:'八年级',G9:'九年级',G10:'高一',G11:'高二',G12:'高三'};setPromptText(`你是一位专业的教育题目生成专家。请根据以下要求生成试题，直接返回JSON数组。\n\n要求：\n- 知识点：${kp}\n- 难度：${dl[all.difficulty]||all.difficulty||'中等'}\n- 题型：${tl[all.question_type]||all.question_type||'单选题'}\n- 数量：${all.count||3}道\n- 年级：${gl[all.grade_level]||all.grade_level||'八年级'}\n- 学科：${all.subject||'数学'}\n\n返回格式：严格的JSON数组，不要markdown代码块。`);}}
            initialValues={{subject:'数学',grade_level:'G8',difficulty:'MEDIUM',question_type:'SINGLE_CHOICE',count:3}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <Form.Item name="subject" style={{marginBottom:0,minWidth:80}}><Select size="small" options={subjectOptions} placeholder="学科"/></Form.Item>
              <Form.Item name="grade_level" style={{marginBottom:0,minWidth:100}}><Select size="small" options={toSelectOptions(grades)} placeholder="年级"/></Form.Item>
              <Form.Item name="knowledge_point" rules={[{required:true,message:'请输入知识点'}]} style={{marginBottom:0,minWidth:180,flex:1}}>
                <TreeSelect treeData={(function cnv(n:any[]):any[]{return(n||[]).map((n:any)=>({value:n.key,title:n.title,children:n.children?cnv(n.children):undefined}));})(scrapeKnNodes)}
                  placeholder="选择知识点" treeCheckable showCheckedStrategy={TreeSelect.SHOW_CHILD} allowClear maxTagCount={2} size="small"/></Form.Item>
              <Form.Item name="difficulty" style={{marginBottom:0,minWidth:80}}><Select size="small" options={toSelectOptions(diffs)} placeholder="难度"/></Form.Item>
              <Form.Item name="question_type" style={{marginBottom:0,minWidth:100}}><Select size="small" options={toSelectOptions(qtypes)} placeholder="题型"/></Form.Item>
              <Form.Item name="count" style={{marginBottom:0,width:52}}><InputNumber size="small" min={1} max={20} placeholder="数量"/></Form.Item>
              <Button type="primary" htmlType="submit" icon={<RobotOutlined/>} loading={generating} disabled={!testPassed}>生成试题</Button>
            </div>
          </Form>
          <div style={{marginTop:8,padding:'6px 10px',background:'#fafbfc',borderRadius:6,fontSize:12,color:'#999',display:'flex',alignItems:'center',gap:8}}>
            <span>📝 提示词</span>
            <span style={{flex:1,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',color:'#bbb'}}>{promptText.split('\n').filter((l:string)=>l.startsWith('- ')).join(' | ')}</span>
            <span style={{color:'#1677ff',cursor:'pointer',fontSize:11}} onClick={()=>setLlmPromptExpanded(!llmPromptExpanded)}>{llmPromptExpanded?'收起':'展开'}</span>
          </div>
          {llmPromptExpanded && <Input.TextArea rows={6} size="small" style={{fontFamily:'monospace',fontSize:11,marginTop:8}} value={promptText} onChange={e=>setPromptText(e.target.value)}/>}
        </Card>

        {/* 进度条 */}
        {generating && (
          <div style={{background:'#f0f5ff',borderRadius:6,padding:'8px 12px',marginTop:8,display:'flex',alignItems:'center',gap:8,fontSize:12}}>
            <div style={{flex:1,height:3,background:'#e8e8e8',borderRadius:2,overflow:'hidden'}}><div style={{width:'70%',height:'100%',background:'#1677ff',borderRadius:2}}/></div>
            <span style={{color:'#1677ff',whiteSpace:'nowrap'}}>生成中...</span>
          </div>
        )}
        {taskProgress && (
          <div style={{marginTop:8}}>
            {taskProgress.ok===false?<Alert style={{padding:'2px 12px',fontSize:12}} type="error" message={taskProgress.error}/>
              :<div style={{padding:'6px 10px',background:'#f6ffed',borderRadius:6,fontSize:12,color:'#52c41a'}}>✅ 已生成 <b>{taskProgress.count}</b> 道试题</div>}
          </div>
        )}

        {/* 结果列表 */}
        <Card size="small" title={<span>生成结果 <span style={{fontWeight:400,color:'#999',fontSize:12}}>共 {llmTotal} 道</span></span>}
          extra={<span style={{fontSize:11,color:'#999'}}>👁 仅展示本次生成</span>} style={{marginTop:16}}>
          <div style={{marginBottom:8,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <Input size="small" placeholder="搜索题目" style={{width:160}} value={llmSearch}
              onChange={e=>setLlmSearch(e.target.value)} onPressEnter={()=>loadLlmResults(1,llmPageSize,llmTypeFilter,llmDiffFilter,llmStatusFilter,llmSearch)} allowClear/>
            <Select size="small" placeholder="题型" allowClear style={{width:80}} value={llmTypeFilter}
              onChange={v=>{setLlmTypeFilter(v);loadLlmResults(1,llmPageSize,v,llmDiffFilter,llmStatusFilter,llmSearch);}} options={toSelectOptions(qtypes)}/>
            <Select size="small" placeholder="难度" allowClear style={{width:70}} value={llmDiffFilter}
              onChange={v=>{setLlmDiffFilter(v);loadLlmResults(1,llmPageSize,llmTypeFilter,v,llmStatusFilter,llmSearch);}} options={toSelectOptions(diffs)}/>
            <Select size="small" placeholder="状态" allowClear style={{width:70}} value={llmStatusFilter}
              onChange={v=>{setLlmStatusFilter(v);loadLlmResults(1,llmPageSize,llmTypeFilter,llmDiffFilter,v,llmSearch);}}
              options={[{value:'PENDING',label:'待审核'},{value:'APPROVED',label:'已通过'},{value:'REJECTED',label:'已驳回'}]}/>
            <Button size="small" icon={<SearchOutlined/>} onClick={()=>loadLlmResults(1,llmPageSize,llmTypeFilter,llmDiffFilter,llmStatusFilter,llmSearch)}>查询</Button>
            <Popconfirm title={'确定删除 '+llmSelectedIds.length+' 道?'} onConfirm={handleLlmBatchDelete} disabled={llmSelectedIds.length===0}>
              <Button size="small" danger icon={<DeleteOutlined/>} disabled={llmSelectedIds.length===0}>批量删除{llmSelectedIds.length>0?`(${llmSelectedIds.length})`:''}</Button>
            </Popconfirm>
          </div>
          <Spin spinning={llmResultsLoading}>
            {llmResults.length===0 && !llmResultsLoading && <Empty description="暂无生成结果"/>}
            {llmResults.length>0 && (
              <div style={{display:'flex',alignItems:'center',padding:'4px 12px',fontSize:10,color:'#bbb',borderBottom:'1px solid #f0f0f0'}}>
                <Checkbox checked={llmResults.length>0&&llmSelectedIds.length===llmResults.length}
                  indeterminate={llmSelectedIds.length>0&&llmSelectedIds.length<llmResults.length}
                  onChange={()=>setLlmSelectedIds(llmSelectedIds.length===llmResults.length?[]:llmResults.map((q:any)=>q.id))}
                  style={{marginRight:8}}/>
                <span style={{width:28}}>#</span>
                <span style={{flex:1}}>题目</span>
                <span style={{width:90,textAlign:'center'}}>时间</span>
                <span style={{width:50,textAlign:'center'}}>状态</span>
                <span style={{width:60,textAlign:'right'}}>操作</span>
              </div>
            )}
            {llmResults.map((q:any,i:number)=>(
              <div key={q.id} style={{display:'flex',alignItems:'flex-start',padding:'10px 12px',borderBottom:i<llmResults.length-1?'1px solid #f5f5f5':'none',background:llmSelectedIds.includes(q.id)?'#f0f5ff':undefined}}>
                <Checkbox checked={llmSelectedIds.includes(q.id)} style={{marginRight:8,marginTop:4,flexShrink:0}}
                  onChange={()=>setLlmSelectedIds(llmSelectedIds.includes(q.id)?llmSelectedIds.filter(id=>id!==q.id):[...llmSelectedIds,q.id])}/>
                <span style={{width:28,color:'#999',fontSize:12,paddingTop:2,flexShrink:0}}>{i+1}</span>
                <div style={{flex:1,minWidth:0,paddingRight:12}}>
                  <div style={{fontSize:13,lineHeight:1.5,marginBottom:4}}>{q.title?.substring(0,120)}</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    <Tag color={(toColorMap(diffs)[q.difficulty] as any)?.color||'default'} style={{fontSize:10}}>{pageDiffMap[q.difficulty]||q.difficulty}</Tag>
                    <Tag color="blue" style={{fontSize:10}}>{typeMap[q.question_type]||q.question_type}</Tag>
                    {q.score!=null && <Tag color="orange" style={{fontSize:10}}>{q.score}分</Tag>}
                    {(q.grade_level?.knowledge_points||[]).slice(0,2).map((kp:string,j:number)=>(<Tag key={j} color="purple" style={{fontSize:10}}>{kp}</Tag>))}
                    <Tag color={REVIEW_STATUS_MAP[q.review_status]?.color||'default'} style={{fontSize:10}}>{REVIEW_STATUS_MAP[q.review_status]?.label||q.review_status}</Tag>
                  </div>
                </div>
                <span style={{width:90,fontSize:11,color:'#999',textAlign:'center',paddingTop:2,flexShrink:0}}>{(q.created_at||'').slice(5,16).replace('T',' ')}</span>
                <span style={{width:50,textAlign:'center',paddingTop:2,flexShrink:0}}>
                  <Tag color={REVIEW_STATUS_MAP[q.review_status]?.color||'default'} style={{fontSize:10,margin:0}}>{REVIEW_STATUS_MAP[q.review_status]?.label||q.review_status}</Tag>
                </span>
                <div style={{width:60,display:'flex',gap:4,justifyContent:'flex-end',flexShrink:0,paddingTop:1}}>
                  <Button size="small" type="link" icon={<EditOutlined/>} onClick={()=>{setLlmEditQ(q);setLlmEditOpen(true);}}/>
                  <Popconfirm title="确定删除?" onConfirm={()=>handleLlmDelete(q.id)}>
                    <Button size="small" type="link" danger icon={<DeleteOutlined/>}/>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </Spin>
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
            <Pagination size="small" current={llmPage} onChange={(p:number)=>loadLlmResults(p)} onShowSizeChange={(_:number,sz:number)=>loadLlmResults(1,sz)}
              pageSize={llmPageSize} total={llmTotal} showSizeChanger showQuickJumper={false} pageSizeOptions={['10','20','50']} showTotal={(t)=>`共 ${t} 条`}/>
          </div>
        </Card>
        {llmEditOpen && llmEditQ && (
          <QuestionEditModal open={llmEditOpen} question={llmEditQ} onClose={()=>{setLlmEditOpen(false);setLlmEditQ(null);}}
            onSuccess={()=>{setLlmEditOpen(false);setLlmEditQ(null);loadLlmResults();}}/>
        )}

        <Card size="small" title="页面结构说明" style={{marginTop:12}}
          extra={<Button size="small" type="link" onClick={()=>setLlmHelpOpen(!llmHelpOpen)}>{llmHelpOpen?'收起':'展开'}</Button>}>
          {llmHelpOpen && (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><tbody>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600,width:80}}>模型栏</td><td style={{padding:'6px 8px'}}>Provider选择 + 模型选择 + 测试连接</td></tr>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600}}>条件栏</td><td style={{padding:'6px 8px'}}>单行：学科、年级、知识点TreeSelect、难度、题型、数量、生成按钮</td></tr>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600}}>提示词</td><td style={{padding:'6px 8px'}}>预览条 + 展开编辑完整提示词</td></tr>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600}}>结果列表</td><td style={{padding:'6px 8px'}}>全选 · # · 标题+标签 · 时间 · 状态 · 编辑/删除图标</td></tr>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600}}>分页</td><td style={{padding:'6px 8px'}}>右下角：共N条 + 页码 + 每页行数下拉</td></tr>
              <tr><td style={{padding:'6px 8px',fontWeight:600}}>按钮配色</td><td style={{padding:'6px 8px'}}>主操作蓝底白字；次要白底灰框；危险白底红框</td></tr>
            </tbody></table>
          )}
        </Card>
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
              <span>📋 将拆分 <b style={{ color: '#1677ff' }}>{scrapeTaskCount}</b> 个任务</span>
              <span style={{ color: '#ddd' }}>|</span>
              <span>预计入库 ≤ <b>{(() => { const v = scrapeForm.getFieldsValue(); return (v.count || 5) * scrapeTaskCount * 3; })()}</b> 道</span>
              <span style={{ color: '#ddd' }}>|</span>
              <span>DDG → 百度 → LLM</span>
              <span style={{ marginLeft: 'auto', color: '#1677ff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                onClick={() => setScrapeDetailExpanded(!scrapeDetailExpanded)}>
                {scrapeDetailExpanded ? '收起 ▲' : '展开详情 ▸'}
              </span>
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
          extra={<span style={{fontSize:11,color:'#999'}}>👁 仅展示本次抓取 · 已在题库中</span>} style={{marginTop:16}}>
          <div style={{marginBottom:8,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <Input size="small" placeholder="搜索题目" style={{width:160}} value={scrapeSearchInput}
              onChange={e=>setScrapeSearchInput(e.target.value)} onPressEnter={()=>loadScrapeResultsWithFilters(1,scrapePageSize,scrapeTypeFilter,scrapeDiffFilter,scrapeStatusFilter,scrapeSearchInput)} allowClear />
            <Select size="small" placeholder="题型" allowClear style={{width:90}} value={scrapeTypeFilter}
              onChange={v=>{setScrapeTypeFilter(v);loadScrapeResultsWithFilters(1,scrapePageSize,v,scrapeDiffFilter,scrapeStatusFilter,scrapeSearchInput);}} options={toSelectOptions(qtypes)} />
            <Select size="small" placeholder="难度" allowClear style={{width:80}} value={scrapeDiffFilter}
              onChange={v=>{setScrapeDiffFilter(v);loadScrapeResultsWithFilters(1,scrapePageSize,scrapeTypeFilter,v,scrapeStatusFilter,scrapeSearchInput);}} options={toSelectOptions(diffs)} />
            <Select size="small" placeholder="状态" allowClear style={{width:80}} value={scrapeStatusFilter}
              onChange={v=>{setScrapeStatusFilter(v);loadScrapeResultsWithFilters(1,scrapePageSize,scrapeTypeFilter,scrapeDiffFilter,v,scrapeSearchInput);}}
              options={[{value:'PENDING',label:'待审核'},{value:'APPROVED',label:'已通过'},{value:'REJECTED',label:'已驳回'}]} />
            <Button size="small" icon={<SearchOutlined/>} onClick={()=>loadScrapeResultsWithFilters(1,scrapePageSize,scrapeTypeFilter,scrapeDiffFilter,scrapeStatusFilter,scrapeSearchInput)}>查询</Button>
            <Popconfirm title={'确定删除 '+scrapeSelectedIds.length+' 道?'} onConfirm={handleScrapeBatchDelete} disabled={scrapeSelectedIds.length===0}>
              <Button size="small" danger icon={<DeleteOutlined/>} disabled={scrapeSelectedIds.length===0}>批量删除{scrapeSelectedIds.length>0?`(${scrapeSelectedIds.length})`:''}</Button>
            </Popconfirm>
          </div>
          <Spin spinning={scrapeResultsLoading}>
            {scrapeResults.length===0 && !scrapeResultsLoading && <Empty description="暂无抓取结果"/>}
            {scrapeResults.length > 0 && (
              <div style={{display:'flex',alignItems:'center',padding:'4px 12px',fontSize:10,color:'#bbb',borderBottom:'1px solid #f0f0f0'}}>
                <Checkbox checked={scrapeResults.length>0 && scrapeSelectedIds.length===scrapeResults.length}
                  indeterminate={scrapeSelectedIds.length>0 && scrapeSelectedIds.length<scrapeResults.length}
                  onChange={()=>setScrapeSelectedIds(scrapeSelectedIds.length===scrapeResults.length?[]:scrapeResults.map((q:any)=>q.id))}
                  style={{marginRight:8}} />
                <span style={{width:28}}>#</span>
                <span style={{flex:1}}>题目</span>
                <span style={{width:90,textAlign:'center'}}>时间</span>
                <span style={{width:50,textAlign:'center'}}>状态</span>
                <span style={{width:60,textAlign:'right'}}>操作</span>
              </div>
            )}
            {scrapeResults.map((q:any,i:number)=>(
              <div key={q.id} style={{display:'flex',alignItems:'flex-start',padding:'10px 12px',borderBottom:i<scrapeResults.length-1?'1px solid #f5f5f5':'none',background:scrapeSelectedIds.includes(q.id)?'#f0f5ff':undefined}}>
                <Checkbox checked={scrapeSelectedIds.includes(q.id)} style={{marginRight:8,marginTop:4,flexShrink:0}}
                  onChange={()=>setScrapeSelectedIds(scrapeSelectedIds.includes(q.id)?scrapeSelectedIds.filter(id=>id!==q.id):[...scrapeSelectedIds,q.id])} />
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
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
            <Pagination size="small" current={scrapePage}
              onChange={(p: number) => loadScrapeResults(p)}
              onShowSizeChange={(_: number, sz: number) => loadScrapeResults(1, sz)}
              pageSize={scrapePageSize} total={scrapeTotal}
              showSizeChanger showQuickJumper={false}
              pageSizeOptions={['10','20','50']}
              showTotal={(t) => `共 ${t} 条`} />
          </div>
        </Card>
        {scrapeEditOpen && scrapeEditQ && (
          <QuestionEditModal open={scrapeEditOpen} question={scrapeEditQ}
            onClose={()=>{setScrapeEditOpen(false);setScrapeEditQ(null);}}
            onSuccess={()=>{setScrapeEditOpen(false);setScrapeEditQ(null);loadScrapeResults();}}/>
        )}

        <Card size="small" title="页面结构说明" style={{marginTop:12}}
          extra={<Button size="small" type="link" onClick={()=>setScrapeHelpOpen(!scrapeHelpOpen)}>{scrapeHelpOpen?'收起':'展开'}</Button>}>
          {scrapeHelpOpen && (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><tbody>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600,width:80}}>搜索栏</td><td style={{padding:'6px 8px'}}>单行：学科、年级多选、知识点TreeSelect、难度、题型多选、数量 → 开始抓取</td></tr>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600}}>预览条</td><td style={{padding:'6px 8px'}}>拆分任务数 + 预计入库 + DDG→百度→LLM + 展开详情</td></tr>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600}}>进度条</td><td style={{padding:'6px 8px'}}>抓取中动画 + 任务数，完成后显示入库结果</td></tr>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600}}>结果列表</td><td style={{padding:'6px 8px'}}># · 标题+标签 · 时间 · 状态 · 编辑/删除(右)</td></tr>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600}}>分页</td><td style={{padding:'6px 8px'}}>右下角：共N条 + 页码 + 每页行数下拉</td></tr>
              <tr style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'6px 8px',fontWeight:600}}>格式化</td><td style={{padding:'6px 8px'}}>LaTeX预处理 → 强化Prompt → JSON解析 → 重试 → JSON修复 → 字段校验</td></tr>
              <tr><td style={{padding:'6px 8px',fontWeight:600}}>搜索源</td><td style={{padding:'6px 8px'}}>DDG(蓝) · 百度(橙) · LLM(红)</td></tr>
            </tbody></table>
          )}
        </Card>
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
