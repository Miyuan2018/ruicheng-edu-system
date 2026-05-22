import { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Input, Select, Modal, message,
  Typography, Card, Row, Col, Tooltip, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  ExportOutlined, ImportOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import QuestionEditModal from './QuestionEditModal';
import BatchImportModal from './BatchImportModal';

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

const typeMap: Record<string, string> = {
  SINGLE_CHOICE: '单选题',
  MULTIPLE_CHOICE: '多选题',
  FILL_BLANK: '填空题',
  SUBJECTIVE: '解答题',
};
const typeColors: Record<string, string> = {
  SINGLE_CHOICE: 'blue',
  MULTIPLE_CHOICE: 'purple',
  FILL_BLANK: 'green',
  SUBJECTIVE: 'orange',
};
const diffMap: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
const diffColors: Record<string, string> = { EASY: 'success', MEDIUM: 'warning', HARD: 'error' };

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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<{value:string,label:string}[]>([]);
  const [exportMax, setExportMax] = useState(200);
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.get('/subjects/my').then(({data}) => setSubjectOptions(data.map((s:string)=>({value:s,label:s})))).catch(()=>{});
    apiClient.get('/admin/llm/export-max').then(({data}) => setExportMax(data.export_max ?? 200)).catch(()=>{});
  }, []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: pageSize, offset: (page - 1) * pageSize };
      if (search) params.keyword = search;
      if (typeFilter) params.question_type = typeFilter;
      if (diffFilter) params.difficulty = diffFilter;
      if (subjectFilter) params.subject = subjectFilter;
      if (gradeFilter) params.grade_level = gradeFilter;
      if (kpFilter) params.knowledge_point = kpFilter;
      const { data } = await apiClient.get('/questions', { params });
      setQuestions(Array.isArray(data) ? data : data.items || []);
      setTotal(data.total || data.length || 0);
    } catch {
      message.error('加载试题失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, typeFilter, diffFilter, subjectFilter, gradeFilter, kpFilter]);

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
    { title: '年级', dataIndex: 'grade_level', width: 80 },
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
      title: '操作', key: 'actions', width: 120, fixed: 'right',
      render: (_: unknown, record: QuestionItem) => (
        <Space>
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>试题管理</Title>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Input
              placeholder="搜索题目内容"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => fetchQuestions()}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select
              placeholder="题型" allowClear style={{ width: '100%' }}
              value={typeFilter} onChange={setTypeFilter}
              options={Object.entries(typeMap).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Select
              placeholder="难度" allowClear style={{ width: '100%' }}
              value={diffFilter} onChange={setDiffFilter}
              options={Object.entries(diffMap).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Col>
          <Col xs={12} sm={6} md={2}>
            <Select placeholder="学科" allowClear style={{ width: '100%' }}
              value={subjectFilter || undefined} onChange={(v) => setSubjectFilter(v || '')}
              options={subjectOptions} />
          </Col>
          <Col xs={12} sm={6} md={2}>
            <Select placeholder="年级" allowClear style={{ width: '100%' }}
              value={gradeFilter} onChange={setGradeFilter}
              options={['七年级','八年级','九年级'].map(v=>({value:v,label:v}))} />
          </Col>
          <Col xs={12} sm={6} md={2}>
            <Input placeholder="知识点" allowClear
              value={kpFilter} onChange={(e) => setKpFilter(e.target.value)} />
          </Col>
          <Col xs={24} sm={6} md={2} style={{ textAlign: 'right' }}>
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
          </Col>
        </Row>
      </Card>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={questions}
        loading={loading}
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
    </div>
  );
}
