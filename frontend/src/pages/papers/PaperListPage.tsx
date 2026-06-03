import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Typography, Space, Input, Select, message, Popconfirm, Dropdown, Switch, Tooltip,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, DeleteOutlined, SearchOutlined,
  DownloadOutlined, PrinterOutlined, CameraOutlined, ReloadOutlined, SendOutlined, EditOutlined, CopyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import PaperImportModal from './PaperImportModal';
import PaperPreviewDrawer from './PaperPreviewDrawer';
import { useReferenceValues, toLabelMap, toColorMap, toSelectOptions } from '../../hooks/useReferenceValues';
import { getUserType } from '../../store/auth';

const { Title } = Typography;

interface PaperItem {
  id: string;
  title: string;
  subject?: string;
  grade_level?: { grades?: string[] };
  unit_count?: number;
  question_count?: number;
  total_score?: number;
  duration_minutes?: number;
  status?: string;
  has_draft?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export default function PaperListPage() {
  const navigate = useNavigate();
  const isStudent = getUserType() === 'STUDENT';
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchScope, setSearchScope] = useState('');
  const [searchGrade, setSearchGrade] = useState<string | string[]>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<{ value: string; label: string }[]>([]);
  const { 'paper-statuses': paperStatuses, 'grade-levels': grades } = useReferenceValues();
  const statusColors = toColorMap(paperStatuses);
  const statusLabels = toLabelMap(paperStatuses);

  useEffect(() => {
    apiClient.get('/subjects/my').then(({ data }) => setSubjectOptions(
      (Array.isArray(data) ? data : []).map((s: string) => ({ value: s, label: s }))
    )).catch(() => {});
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

  const handleNew = () => navigate('/papers/new');
  const handlePreview = (id: string) => { setPreviewId(id); setPreviewOpen(true); };
  const handleEdit = (id: string) => navigate('/papers/' + id + '/edit');

  const handleCancelEdit = async (paperId: string) => {
    try {
      const { draftApi } = await import('../../api/drafts');
      const resp = await draftApi.getByPaper(paperId);
      const drafts = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
      for (const d of drafts) {
        await draftApi.delete(d.id);
      }
      message.success('已取消修改');
      fetchPapers();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || String(err);
      message.error(typeof detail === 'string' ? detail : '操作失败');
    }
  };

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
      message.success('发布成功！已通知 ' + (data.notified_count || 0) + ' 名学生');
      fetchPapers();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '发布失败');
    }
  };

  const handleCopy = async (id: string) => {
    try {
      await apiClient.post('/exam-papers/' + id + '/copy');
      message.success('复制成功');
      fetchPapers();
    } catch {
      message.error('复制失败');
    }
  };

  const handleExport = async (paperId: string, format: string) => {
    try {
      const resp = await apiClient.get('/exam-papers/' + paperId + '/export/' + format, {
        responseType: 'blob',
      });
      const blob = resp.data;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      // 从 Content-Disposition 提取文件名，兜底 paper.docx/pdf
      const disp = resp.headers?.['content-disposition'];
      const fnMatch = disp?.match(/filename\*?=(?:utf-8''|"')?(.+?)(?:;|"|$)/);
      a.download = fnMatch ? decodeURIComponent(fnMatch[1]) : 'paper.' + (format === 'word' ? 'docx' : 'pdf');
      a.click();
      URL.revokeObjectURL(blobUrl);
      message.success('导出成功');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        message.error('试卷不存在或已被删除，无法导出');
      } else if (status === 403) {
        message.error('没有权限导出该试卷');
      } else if (err?.code === 'ERR_NETWORK') {
        message.error('网络连接失败，请检查后端服务');
      } else {
        message.error('导出失败，请稍后重试');
      }
    }
  };

  const handlePrint = (paperId: string) => {
    const w = window.open('/print-preview?paperId=' + paperId, '_blank', 'width=900,height=700');
    if (!w) { message.info('请允许弹出窗口以预览打印'); }
  };

  // Check if paper is a stale draft (30+ days without update)
  const isStaleDraft = (record: PaperItem): boolean => {
    if (!record.has_draft) return false;
    if (!record.updated_at) return false;
    const updated = new Date(record.updated_at);
    const now = new Date();
    const diffDays = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 30;
  };

  const columns = [
    {
      title: '试卷名称',
      dataIndex: 'title',
      ellipsis: true,
      render: (text: string, record: PaperItem) => {
        const stale = isStaleDraft(record);
        return (
          <span style={{ color: stale ? '#bbb' : undefined }}>
            <a onClick={() => handlePreview(record.id)} style={{ color: stale ? '#bbb' : undefined }}>{text}</a>
            {stale && <Tag style={{ marginLeft: 4, fontSize: 10 }}>⏳过期草稿</Tag>}
          </span>
        );
      },
    },
    { title: '学科', dataIndex: 'subject', width: 70 },
    {
      title: '年级',
      dataIndex: 'grade_level',
      width: 90,
      render: (v: unknown) => {
        const g = (v as { grades?: string[] })?.grades || [];
        return g.length ? g.join(', ') : '-';
      },
    },
    {
      title: '单元',
      dataIndex: 'unit_count',
      width: 55,
      align: 'center' as const,
      render: (v: number) => v != null ? v : '-',
    },
    { title: '题数', dataIndex: 'question_count', width: 55, align: 'center' as const },
    { title: '总分', dataIndex: 'total_score', width: 55, align: 'center' as const },
    { title: '时长', dataIndex: 'duration_minutes', width: 55, align: 'center' as const, render: (v: number) => v ? v + '分' : '-' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 75,
      render: (s: string, record: PaperItem) => {
        if (record.has_draft) return <Tag color="orange">修改中</Tag>;
        const stale = isStaleDraft(record);
        const color = stale ? '#bbb' : (statusColors[s] || {}).color || 'default';
        return <Tag color={color}>{statusLabels[s] || s}</Tag>;
      },
    },
    {
      title: '操作',
      width: 320,
      render: (_: unknown, record: PaperItem) => {
        const isEditing = record.has_draft === true;
        const isDraft = record.status === 'DRAFT';
        const isPublished = record.status === 'PUBLISHED';

        const exportItems = {
          items: [
            { key: 'word', label: '导出 Word (.docx)', icon: <DownloadOutlined />, onClick: () => handleExport(record.id, 'word') },
            { key: 'pdf', label: '导出 PDF', icon: <DownloadOutlined />, onClick: () => handleExport(record.id, 'pdf') },
          ],
        };

        return (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record.id)}>预览</Button>
            {isEditing && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.id)}>继续修改</Button>
            )}
            {!isEditing && !isDraft && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.id)}>编辑</Button>
            )}
            {isEditing && (
              <Popconfirm title="取消修改后草稿将被删除，确定？" onConfirm={() => handleCancelEdit(record.id)}>
                <Button type="link" size="small" danger>取消修改</Button>
              </Popconfirm>
            )}
            <Dropdown menu={exportItems}>
              <Button type="link" size="small" icon={<DownloadOutlined />}>导出</Button>
            </Dropdown>
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record.id)}>打印</Button>
            {isPublished && (
              <Tooltip title="复制试卷">
                <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record.id)}>复制</Button>
              </Tooltip>
            )}
            {!isPublished && record.status !== 'ARCHIVED' && (
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
      <PaperImportModal open={importOpen} onClose={() => setImportOpen(false)} onSuccess={() => { setImportOpen(false); fetchPapers(); }} />
      <PaperPreviewDrawer open={previewOpen} paperId={previewId || ''} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}
