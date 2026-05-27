import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Input, Select, message,
  Typography, Popconfirm, Switch, Tooltip, Modal, Checkbox,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  ExportOutlined, ImportOutlined, CheckOutlined, CloseOutlined,
  PlayCircleOutlined, StarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toSelectOptions } from '../../hooks/useReferenceValues';
import { getUserType } from '../../store/auth';
import QuestionEditModal from './QuestionEditModal';
import BatchImportModal from './BatchImportModal';
import ExplanationDrawer from '../../components/topic-board/ExplanationDrawer';

const { Title } = Typography;

interface QuestionItem {
  id: string;
  title: string;
  question_type: string;
  difficulty: string;
  subject: string;
  grade_level: string;
  score: number;
  created_at: string;
  is_active: boolean;
}

export default function QuestionListPage() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [diffFilter, setDiffFilter] = useState<string | undefined>();
  const [subjectFilter, setSubjectFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string | undefined>();
  const [kpFilter, setKpFilter] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string | undefined>('APPROVED');
  const [sourceFilter, setSourceFilter] = useState<string | undefined>();
  const [isTypicalFilter, setIsTypicalFilter] = useState<boolean | undefined>();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<{value:string,label:string}[]>([]);
  const [exportMax, setExportMax] = useState(200);
  const [explanationMap, setExplanationMap] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerQuestionId, setDrawerQuestionId] = useState<string | null>(null);
  // Recommend modal state
  const [recommendModalOpen, setRecommendModalOpen] = useState(false);
  const [recommendQuestion, setRecommendQuestion] = useState<QuestionItem | null>(null);
  const [recommendClasses, setRecommendClasses] = useState<{id:string,name:string}[]>([]);
  const [recommendSelectedClass, setRecommendSelectedClass] = useState<string | undefined>();
  const [recommendStudents, setRecommendStudents] = useState<{id:string,full_name:string}[]>([]);
  const [recommendStudentIds, setRecommendStudentIds] = useState<string[]>([]);
  const [recommendExisting, setRecommendExisting] = useState<{student_id:string,student_name:string}[]>([]);
  const [recommendSaving, setRecommendSaving] = useState(false);
  const userType = getUserType();
  const canReview = userType === 'QUESTION_ADMIN' || userType === 'SYS_ADMIN' || userType === 'TEACHER';
  const { 'question-types': qtypes, 'difficulty-levels': diffs, 'grade-levels': grades } = useReferenceValues();
  const typeMap = useMemo(() => toLabelMap(qtypes), [qtypes]);
  const typeColors = useMemo(() => { const m: Record<string,string> = {}; qtypes.forEach(qt => { if(qt.color) m[qt.code] = qt.color; }); return m; }, [qtypes]);
  const diffMap = useMemo(() => toLabelMap(diffs), [diffs]);
  const diffColors = useMemo(() => { const m: Record<string,string> = {}; diffs.forEach(d => { if(d.color) m[d.code] = d.color; }); return m; }, [diffs]);

  useEffect(() => {
    apiClient.get('/subjects/my').then(({data}) => setSubjectOptions(data.map((s:string)=>({value:s,label:s})))).catch(()=>{});
    apiClient.get('/admin/llm/export-max').then(({data}) => setExportMax(data.export_max ?? 200)).catch(()=>{});
  }, []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { limit: pageSize, skip: (page - 1) * pageSize };
      if (search) params.keyword = search;
      if (typeFilter) params.question_type = typeFilter;
      if (diffFilter) params.difficulty = diffFilter;
      if (subjectFilter) params.subject = subjectFilter;
      if (gradeFilter) params.grade_level = gradeFilter;
      if (kpFilter) params.knowledge_point = kpFilter;
      if (reviewStatusFilter) params.review_status = reviewStatusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (isTypicalFilter !== undefined) params.is_typical = isTypicalFilter;
      const { data } = await apiClient.get('/questions', { params });
      const items = Array.isArray(data) ? data : data.items || [];
      setQuestions(items);
      setTotal(data.total || data.length || 0);
      // Batch check explanation status
      if (items.length > 0) {
        const ids = items.map((q: QuestionItem) => q.id).join(',');
        apiClient.get('/questions/has-explanations', { params: { ids } })
          .then((resp: any) => setExplanationMap(resp.data || {}))
          .catch(() => {});
      }
    } catch {
      message.error('加载试题失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, typeFilter, diffFilter, subjectFilter, gradeFilter, kpFilter, reviewStatusFilter, sourceFilter, isTypicalFilter]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/questions/${id}`);
      message.success('已删除');
      fetchQuestions();
    } catch { message.error('删除失败'); }
  };

  const handleCreate = () => {
    setEditingQuestion(null);
    setEditModalOpen(true);
  };

  const handleEdit = (record: QuestionItem) => {
    setEditingQuestion(record);
    setEditModalOpen(true);
  };

  const handleBatchApprove = async () => {
    if (!selectedRowKeys.length) return;
    try {
      await apiClient.post('/question-admin/batch-approve', selectedRowKeys);
      message.success(`已批量审核通过 ${selectedRowKeys.length} 道试题`);
      setSelectedRowKeys([]);
      fetchQuestions();
    } catch { message.error('批量审核失败'); }
  };

  const handleBatchReject = async () => {
    if (!selectedRowKeys.length) return;
    try {
      await apiClient.post('/question-admin/batch-reject', selectedRowKeys);
      message.success(`已批量驳回 ${selectedRowKeys.length} 道试题`);
      setSelectedRowKeys([]);
      fetchQuestions();
    } catch { message.error('批量驳回失败'); }
  };

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) return;
    try {
      await apiClient.post('/questions/batch-delete', selectedRowKeys);
      message.success(`已批量删除 ${selectedRowKeys.length} 道试题`);
      setSelectedRowKeys([]);
      fetchQuestions();
    } catch { message.error('批量删除失败'); }
  };

  const handleExport = async (ids?: string[]) => {
    try {
      let data: any;
      if (ids && ids.length > 0) {
        // Export selected
        const { data: d } = await apiClient.post('/questions/export', ids);
        data = d;
      } else {
        // Export filtered
        const params: Record<string, string> = {};
        if (subjectFilter) params.subject = subjectFilter;
        if (gradeFilter) params.grade_level = gradeFilter;
        if (typeFilter) params.question_type = typeFilter;
        if (diffFilter) params.difficulty = diffFilter;
        if (search) params.keyword = search;
        if (kpFilter) params.knowledge_point = kpFilter;
        const { data: d } = await apiClient.get('/questions/export', { params });
        data = d;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `questions_export_${new Date().toISOString().slice(0,10)}.json`; a.click();
      message.success(`导出 ${Array.isArray(data) ? data.length : 0} 道试题`);
    } catch { message.error('导出失败'); }
  };

  // ── Recommend handlers ──
  const openRecommendModal = async (record: QuestionItem) => {
    setRecommendQuestion(record);
    setRecommendStudentIds([]);
    setRecommendSelectedClass(undefined);
    setRecommendStudents([]);
    setRecommendExisting([]);
    setRecommendModalOpen(true);
    try {
      const clsResp = await apiClient.get('/classes');
      setRecommendClasses(Array.isArray(clsResp.data) ? clsResp.data : []);
    } catch { /* ignore */ }
    try {
      const existResp = await apiClient.get('/recommendations/by-question/' + record.id);
      setRecommendExisting(Array.isArray(existResp.data) ? existResp.data : []);
    } catch { /* ignore */ }
  };

  const handleClassSelect = async (classId: string) => {
    setRecommendSelectedClass(classId);
    setRecommendStudentIds([]);
    try {
      const resp = await apiClient.get('/classes/' + classId + '/students');
      setRecommendStudents(Array.isArray(resp.data) ? resp.data : []);
    } catch { setRecommendStudents([]); }
  };

  const handleRecommendSave = async () => {
    if (!recommendQuestion || recommendStudentIds.length === 0) {
      message.warning('请选择至少一名学生');
      return;
    }
    setRecommendSaving(true);
    try {
      await apiClient.post('/recommendations', {
        question_id: recommendQuestion.id,
        student_ids: recommendStudentIds,
      });
      message.success('推荐成功');
      setRecommendModalOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '推荐失败');
    }
    setRecommendSaving(false);
  };

  const columns: ColumnsType<QuestionItem> = [
    { title: '题目', dataIndex: 'title', width: 300, ellipsis: true,
      render: (t: string, r: QuestionItem) => (
        <a onClick={() => { setEditingQuestion(r); setEditModalOpen(true); }}>{t}</a>
      ),
    },
    { title: '题型', dataIndex: 'question_type', width: 90,
      render: (t: string) => <Tag color={typeColors[t]}>{typeMap[t] || t}</Tag>,
    },
    { title: '难度', dataIndex: 'difficulty', width: 80,
      render: (t: string) => <Tag color={diffColors[t]}>{diffMap[t] || t}</Tag>,
    },
    { title: '学科', dataIndex: 'subject', width: 80 },
    { title: '年级', dataIndex: 'grade_level', width: 100,
      render: (v: any) => {
        const grades = v?.grades || [];
        return grades.length ? grades.map((g: string) => <Tag key={g} style={{marginBottom:2}}>{g}</Tag>) : '-';
      }},
    { title: '分值', dataIndex: 'score', width: 60 },
    { title: '来源', dataIndex: 'source', width: 80,
      render: (s: string) => {
        const map: Record<string, { color: string; label: string }> = {
          MANUAL: { color: 'blue', label: '人工录入' },
          LLM_GENERATED: { color: 'purple', label: 'LLM生成' },
          SCRAPED: { color: 'orange', label: '网络抓取' },
          OCR_UPLOAD: { color: 'cyan', label: '学生上传' },
        };
        return <Tag color={map[s]?.color}>{map[s]?.label || s}</Tag>;
      },
    },
    { title: '审核', dataIndex: 'review_status', width: 70,
      render: (s: string) => {
        const map: Record<string, { color: string; label: string }> = {
          APPROVED: { color: 'green', label: '已发布' },
          PENDING: { color: 'orange', label: '待审核' },
          REJECTED: { color: 'red', label: '已驳回' },
          NEEDS_REVIEW: { color: 'gold', label: '待复核' },
        };
        return <Tag color={map[s]?.color}>{map[s]?.label || s}</Tag>;
      },
    },
    { title: '启用', dataIndex: 'is_active', width: 60,
      render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>,
    },
    {
      title: '讲解', key: 'explanation', width: 60, align: 'center' as const,
      render: (_: unknown, record: QuestionItem) => explanationMap[record.id] ? (
        <Tooltip title="查看讲解">
          <Button
            type="link" size="small"
            icon={<PlayCircleOutlined style={{ color: '#667eea', fontSize: 16 }} />}
            onClick={() => { setDrawerQuestionId(record.id); setDrawerOpen(true); }}
          />
        </Tooltip>
      ) : <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: '操作', key: 'actions', width: canReview ? 150 : 120, fixed: 'right',
      render: (_: unknown, record: QuestionItem) => (
        <Space>
          {canReview && (
            <Tooltip title="推荐给学生">
              <Button type="link" size="small" icon={<StarOutlined />} onClick={() => openRecommendModal(record)} />
            </Tooltip>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>试题管理</Title>
        <Space>
          <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)}>导入</Button>
          {selectedRowKeys.length > 0 && (
            <Button icon={<ExportOutlined />} onClick={() => handleExport(selectedRowKeys)}
              disabled={exportMax === 0}>
              导出选中({selectedRowKeys.length})
            </Button>
          )}
          <Button icon={<ExportOutlined />} onClick={() => handleExport()}
            disabled={exportMax === 0}>
            导出全部{exportMax === 0 ? '(已禁用)' : ''}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建</Button>
        </Space>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索题目内容" prefix={<SearchOutlined />}
          value={search} onChange={(e) => setSearch(e.target.value)}
          onPressEnter={() => fetchQuestions()} allowClear
          style={{ width: 180 }} size="small"
        />
        <Select
          placeholder="题型" allowClear style={{ width: 100 }} size="small"
          value={typeFilter} onChange={setTypeFilter}
          options={Object.entries(typeMap).map(([k, v]) => ({ value: k, label: v }))}
        />
        <Select
          placeholder="难度" allowClear style={{ width: 90 }} size="small"
          value={diffFilter} onChange={setDiffFilter}
          options={Object.entries(diffMap).map(([k, v]) => ({ value: k, label: v }))}
        />
        <Select placeholder="学科" allowClear style={{ width: 90 }} size="small"
          value={subjectFilter || undefined} onChange={(v) => setSubjectFilter(v || '')}
          options={subjectOptions} />
        <Select placeholder="年级" allowClear style={{ width: 90 }} size="small"
          value={gradeFilter} onChange={setGradeFilter}
          options={toSelectOptions(grades)} />
        <Input placeholder="知识点" allowClear size="small"
          style={{ width: 120 }}
          value={kpFilter} onChange={(e) => setKpFilter(e.target.value)} />
        <Select
          placeholder="审核状态" allowClear style={{ width: 100 }} size="small"
          value={reviewStatusFilter} onChange={(v) => setReviewStatusFilter(v)}
          options={[
            { value: 'APPROVED', label: '已发布' },
            { value: 'PENDING', label: '待审核' },
            { value: 'REJECTED', label: '已驳回' },
            { value: 'NEEDS_REVIEW', label: '待复核' },
          ]}
        />
        <Select
          placeholder="来源" allowClear style={{ width: 100 }} size="small"
          value={sourceFilter} onChange={(v) => setSourceFilter(v)}
          options={[
            { value: 'MANUAL', label: '人工录入' },
            { value: 'LLM_GENERATED', label: 'LLM生成' },
            { value: 'SCRAPED', label: '网络抓取' },
            { value: 'OCR_UPLOAD', label: '学生上传' },
          ]}
        />
        <Space size="small" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#666' }}>典型题</span>
          <Switch
            size="small"
            checked={isTypicalFilter}
            onChange={(v) => setIsTypicalFilter(v || undefined)}
            checkedChildren="是"
            unCheckedChildren="否"
          />
        </Space>
      </div>
      {selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13 }}>已选择 {selectedRowKeys.length} 项</span>
          {canReview && (
            <>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={handleBatchApprove}>批量通过</Button>
              <Button danger size="small" icon={<CloseOutlined />} onClick={handleBatchReject}>批量驳回</Button>
            </>
          )}
          <Popconfirm title="确定批量删除选中试题？" onConfirm={handleBatchDelete}>
            <Button danger size="small" icon={<DeleteOutlined />}>批量删除</Button>
          </Popconfirm>
        </div>
      )}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={questions}
        loading={loading}
        size="middle"
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) }}
        pagination={{
          current: page, pageSize, total,
          showSizeChanger: true, showTotal: (t) => `共 ${t} 题`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 900 }}
      />
      <QuestionEditModal
        open={editModalOpen}
        question={editingQuestion}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => { setEditModalOpen(false); fetchQuestions(); }}
      />
      <BatchImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => { setImportModalOpen(false); fetchQuestions(); }}
      />
      <ExplanationDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDrawerQuestionId(null); }}
        questionId={drawerQuestionId}
      />
      {/* ── Recommend Modal ── */}
      <Modal
        title={'推荐试题 — ' + (recommendQuestion ? recommendQuestion.title.slice(0, 30) : '')}
        open={recommendModalOpen}
        onOk={handleRecommendSave}
        onCancel={() => setRecommendModalOpen(false)}
        confirmLoading={recommendSaving}
        okText="推荐"
        width={600}
      >
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 500, marginRight: 8 }}>选择班级:</span>
          <Select
            placeholder="请选择班级"
            value={recommendSelectedClass}
            onChange={handleClassSelect}
            style={{ width: 250 }}
            size="small"
            options={recommendClasses.map(c => ({ value: c.id, label: c.name }))}
          />
        </div>
        {recommendExisting.length > 0 && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f6ffed', borderRadius: 4 }}>
            <span style={{ fontSize: 12, color: '#52c41a', marginRight: 8 }}>已推荐:</span>
            {recommendExisting.map(e => (
              <Tag key={e.student_id} color="green" style={{ marginBottom: 4 }}>{e.student_name}</Tag>
            ))}
          </div>
        )}
        {recommendSelectedClass && recommendStudents.length > 0 && (
          <div>
            <div style={{ marginBottom: 8 }}>
              <Checkbox
                indeterminate={recommendStudentIds.length > 0 && recommendStudentIds.length < recommendStudents.length}
                checked={recommendStudentIds.length === recommendStudents.length && recommendStudents.length > 0}
                onChange={(e) => {
                  setRecommendStudentIds(e.target.checked ? recommendStudents.map(s => s.id) : []);
                }}
              >
                全选 ({recommendStudents.length}人)
              </Checkbox>
            </div>
            <Checkbox.Group
              value={recommendStudentIds}
              onChange={(vals) => setRecommendStudentIds(vals as string[])}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
            >
              {recommendStudents.map(s => {
                const isExisting = recommendExisting.some(e => e.student_id === s.id);
                return (
                  <Checkbox key={s.id} value={s.id} disabled={isExisting} style={{ marginLeft: 0 }}>
                    {s.full_name}{isExisting ? ' (已推荐)' : ''}
                  </Checkbox>
                );
              })}
            </Checkbox.Group>
          </div>
        )}
        {recommendSelectedClass && recommendStudents.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>该班级暂无学生</div>
        )}
        {!recommendSelectedClass && (
          <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>请先选择班级</div>
        )}
      </Modal>
    </div>
  );
}
