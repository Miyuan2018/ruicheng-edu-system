import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Typography, Space, Input, Select, message, Popconfirm, Dropdown, Switch,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, DeleteOutlined, SearchOutlined,
  DownloadOutlined, PrinterOutlined, CameraOutlined, ReloadOutlined, SendOutlined,
} from '@ant-design/icons';
import apiClient from '../../api/client';
import PaperEditModal from './PaperEditModal';
import PaperImportModal from './PaperImportModal';
import PaperPreviewDrawer from './PaperPreviewDrawer';
import { useReferenceValues, toLabelMap, toColorMap, toSelectOptions } from '../../hooks/useReferenceValues';
import { getUserType, getAccessToken } from '../../store/auth';

const { Title } = Typography;

interface PaperItem {
  id: string;
  title: string;
  subject?: string;
  grade_level?: { grades?: string[] };
  question_count?: number;
  total_score?: number;
  duration_minutes?: number;
  status?: string;
}

export default function PaperListPage() {
  const isStudent = getUserType() === 'STUDENT';
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editPaper, setEditPaper] = useState<PaperItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchScope, setSearchScope] = useState('');
  const [searchGrade, setSearchGrade] = useState<string | string[]>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<{value:string,label:string}[]>([]);
  const { 'paper-statuses': paperStatuses, 'grade-levels': grades } = useReferenceValues();
  const statusColors = toColorMap(paperStatuses);
  const statusLabels = toLabelMap(paperStatuses);

  useEffect(() => {
    apiClient.get('/subjects/my').then(({data}) => setSubjectOptions(data.map((s:string)=>({value:s,label:s})))).catch(()=>{});
  }, []);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (searchTitle) params.title = searchTitle;
      if (searchStatus) params.status = searchStatus;
      if (searchScope) params.scope = searchScope;
      if (searchGrade) {
        if (Array.isArray(searchGrade)) {
          params.grades = searchGrade.join(',');
        } else {
          params.grade = searchGrade;
        }
      }
      if (searchKeyword) params.keyword = searchKeyword;
      if (searchSubject) params.subject = searchSubject;
      if (onlyMine) params.created_by = 'me';
      const resp = await apiClient.get('/exam-papers', { params });
      const data = resp.data;
      if (Array.isArray(data)) {
        setPapers(data);
      } else if (data && data.data && Array.isArray(data.data)) {
        setPapers(data.data);
      } else if (data && data.items) {
        setPapers(data.items);
      } else {
        setPapers([]);
      }
    } catch {
      message.error('加载试卷列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchTitle, searchStatus, searchScope, searchGrade, searchKeyword, searchSubject, onlyMine]);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  const handleNew = () => { setEditPaper(null); setModalOpen(true); };
  const handlePreview = (id: string) => { setPreviewId(id); setPreviewOpen(true); };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete('/exam-papers/' + id);
      message.success('删除成功');
      fetchPapers();
    } catch {
      message.error('删除失败');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const { data } = await apiClient.post('/exam-papers/' + id + '/publish', { class_ids: [] });
      message.success(`发布成功！已通知 ${data.notified_count || 0} 名学生`);
      fetchPapers();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '发布失败');
    }
  };

  const handleSuccess = () => { setModalOpen(false); fetchPapers(); };
  const handleImportSuccess = () => { setImportOpen(false); fetchPapers(); };

  const handleExport = (paperId: string, format: string) => {
    const url = '/api/v1/exam-papers/' + paperId + '/export/' + format;
    const token = getAccessToken();
    if (token) {
      fetch(url, { headers: { Authorization: 'Bearer ' + token } })
        .then((r) => {
          if (!r.ok) { message.error('导出失败'); return; }
          return r.blob();
        })
        .then((blob) => {
          if (!blob) return;
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'paper.' + format;
          a.click();
          URL.revokeObjectURL(blobUrl);
          message.success('导出成功');
        })
        .catch(() => { message.error('导出失败'); });
    }
  };

  const handlePrint = (paperId: string) => {
    const w = window.open('/print-preview?paperId=' + paperId, '_blank', 'width=900,height=700');
    if (!w) { message.info('请允许弹出窗口以预览打印'); }
  };

  const columns = [
    {
      title: '试卷名称',
      dataIndex: 'title',
      ellipsis: true,
      render: (text: string, record: PaperItem) => (
        <a onClick={() => handlePreview(record.id)}>{text}</a>
      ),
    },
    { title: '学科', dataIndex: 'subject', width: 80 },
    {
      title: '年级',
      dataIndex: 'grade_level',
      width: 100,
      render: (v: unknown) => {
        const g = (v as { grades?: string[] })?.grades || [];
        return g.length ? g.join(', ') : '-';
      },
    },
    { title: '题数', dataIndex: 'question_count', width: 60, align: 'center' as const },
    { title: '总分', dataIndex: 'total_score', width: 60, align: 'center' as const },
    { title: '时长(分)', dataIndex: 'duration_minutes', width: 70, align: 'center' as const },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (s: string) => (
        <Tag color={(statusColors[s] || {}).color || 'default'}>{statusLabels[s] || s}</Tag>
      ),
    },
    {
      title: '操作',
      width: 280,
      render: (_: unknown, record: PaperItem) => {
        const exportItems = {
          items: [
            { key: 'word', label: '导出 Word (.docx)', icon: <DownloadOutlined />, onClick: () => handleExport(record.id, 'word') },
            { key: 'pdf', label: '导出 PDF', icon: <DownloadOutlined />, onClick: () => handleExport(record.id, 'pdf') },
          ],
        };
        return (
          <Space>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record.id)}>预览</Button>
            <Dropdown menu={exportItems}>
              <Button type="link" size="small" icon={<DownloadOutlined />}>导出</Button>
            </Dropdown>
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record.id)}>打印</Button>
            {record.status !== 'PUBLISHED' && record.status !== 'ARCHIVED' && (
              <Popconfirm title="发布后将通知班级学生，确定发布？" onConfirm={() => handlePublish(record.id)}>
                <Button type="link" size="small" icon={<SendOutlined />} style={{ color: '#1890ff' }}>发布</Button>
              </Popconfirm>
            )}
            <Popconfirm title="确定删除该试卷？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{isStudent ? '试卷错题本' : '试卷管理'}</Title>
        {!isStudent && (
          <Space>
            <Button icon={<CameraOutlined />} onClick={() => setImportOpen(true)}>试卷录入</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleNew}>新建试卷</Button>
          </Space>
        )}
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          placeholder="搜索试卷名称"
          value={searchTitle}
          onChange={(e) => setSearchTitle(e.target.value)}
          style={{ width: 180 }}
          prefix={<SearchOutlined />}
          allowClear
          size="small"
        />
        <Select placeholder="学科" value={searchSubject || undefined} onChange={(v) => setSearchSubject(v || '')} style={{ width: 100 }} allowClear size="small" options={subjectOptions} />
        <Select
          placeholder="适用范围"
          value={searchScope || undefined}
          onChange={(v) => { setSearchScope(v || ''); setSearchKeyword(''); }}
          style={{ width: 120 }}
          allowClear
          size="small"
          options={[
            { value: 'comprehensive', label: '综合' },
            { value: 'grade_comprehensive', label: '年级综合' },
            { value: 'chapter', label: '章节' },
            { value: 'knowledge_point', label: '知识点' },
          ]}
        />
        <Select
          placeholder="年级"
          value={searchGrade || undefined}
          onChange={(v) => setSearchGrade(v || '')}
          style={{ width: 100 }}
          allowClear
          size="small"
          mode={searchScope === 'comprehensive' ? 'multiple' : undefined}
          options={toSelectOptions(grades)}
        />
        {(searchScope === 'chapter' || searchScope === 'knowledge_point') && (
          <Input
            placeholder="模糊查询章节/知识点"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: 180 }}
            prefix={<SearchOutlined />}
            allowClear
            size="small"
          />
        )}
        <Select
          placeholder="状态筛选"
          value={searchStatus || undefined}
          onChange={(v) => setSearchStatus(v || '')}
          style={{ width: 110 }}
          allowClear
          size="small"
          options={toSelectOptions(paperStatuses)}
        />
        <Space size="small" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#666' }}>只看我的</span>
          <Switch size="small" checked={onlyMine} onChange={(v) => setOnlyMine(v)} />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetchPapers} size="small">刷新</Button>
      </div>
      <Table rowKey="id" loading={loading} dataSource={papers} columns={columns} size="middle" />
      <PaperEditModal open={modalOpen} paper={editPaper} onClose={() => setModalOpen(false)} onSuccess={handleSuccess} />
      <PaperImportModal open={importOpen} onClose={() => setImportOpen(false)} onSuccess={handleImportSuccess} />
      <PaperPreviewDrawer open={previewOpen} paperId={previewId || ''} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}

