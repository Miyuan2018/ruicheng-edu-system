import { useState, useEffect } from 'react';
import {
  Table, Button, Input, Select, Typography, Space, Tag, message, Popconfirm, Modal, Radio, Card, Progress, Descriptions, Tooltip,
} from 'antd';
import {
  SearchOutlined, FileTextOutlined, EyeOutlined, DeleteOutlined, CameraOutlined, EditOutlined, PrinterOutlined, BookOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues } from '../../hooks/useReferenceValues';
import PaperPreviewDrawer from './PaperPreviewDrawer';
import PaperImportModal from './PaperImportModal';
import PhotoScanTab from '../exam-mistakes/PhotoScanTab';

const { Title, Text } = Typography;

interface PaperItem {
  id: string;
  title: string;
  subject?: string;
  grade_level?: string | { grades?: string[] };
  submission_status?: string;
}

interface QuestionItem {
  id: string;
  title: string;
  correct_answer?: string;
}

export default function MyPapersPage() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTitle, setSearchTitle] = useState('');
  const [filterGrade, setFilterGrade] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewId, setPreviewId] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanPaperId, setScanPaperId] = useState('');

  // Answering flow
  const [answeringPaper, setAnsweringPaper] = useState<PaperItem | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const refs = useReferenceValues();
  const paperStatuses = refs['paper-statuses'];
  const grades = refs['grade-levels'];
  const gradeOptions = (grades || []).map((g: { code: string; name: string }) => ({ value: g.code, label: g.name }));
  const statusOptions = (paperStatuses || []).map((s: { code: string; name: string }) => ({ value: s.code, label: s.name }));

  function loadPapers() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (searchTitle) params.title = searchTitle;
    if (filterGrade) params.grade = filterGrade;
    if (filterStatus) params.status = filterStatus;
    apiClient.get('/exam-papers/my', { params }).then((resp) => {
      setPapers(Array.isArray(resp.data) ? resp.data : []);
    }).catch(() => { setPapers([]); })
    .finally(() => { setLoading(false); });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPapers(); }, []);

  const handlePreview = (id: string) => { setPreviewId(id); setPreviewOpen(true); };

  const handleDelete = (id: string) => {
    apiClient.delete('/exam-papers/' + id).then(() => {
      message.success('已删除'); loadPapers();
    }).catch(() => { message.error('删除失败'); });
  };

  const handlePrint = (paperId: string) => {
    const w = window.open('/print-preview?paperId=' + paperId, '_blank', 'width=900,height=700');
    if (!w) { message.info('请允许弹出窗口以预览打印'); }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) { message.warning('请先选中试卷'); return; }
    Promise.all(selectedRowKeys.map((id) => apiClient.delete('/exam-papers/' + id)))
      .then(() => {
        message.success('已删除 ' + selectedRowKeys.length + ' 份试卷');
        setSelectedRowKeys([]); loadPapers();
      }).catch(() => { message.error('批量删除失败'); });
  };

  const generateMistakeBook = (paperId: string) => {
    apiClient.post('/error-notebooks/generate', { exam_paper_id: paperId }).then(() => {
      message.success('错题本已生成');
      loadPapers();
    }).catch((e: any) => { message.error(e.response?.data?.detail || '生成失败'); });
  };

  const handleStatusChange = (record: PaperItem) => {
    Modal.confirm({
      title: '修改试卷状态',
      content: '确定将试卷状态从"已生成"改为"重新判"？修改后可以重新生成错题本。',
      okText: '确认修改',
      cancelText: '取消',
      onOk: () => apiClient.put('/exam-papers/' + record.id + '/submission-status', { status_in: 'RE_GRADED' })
        .then(() => { message.success('状态已修改为"重新判"'); loadPapers(); })
        .catch((e: any) => { message.error(e.response?.data?.detail || '状态修改失败'); }),
    });
  };

  // ── Online Answering ──
  const startAnswering = (paper: PaperItem) => {
    setAnsweringPaper(paper);
    setAnswers({});
    setAnswerResult(null);
    apiClient.get('/exam-papers/' + paper.id + '/questions').then((resp) => {
      setQuestions(Array.isArray(resp.data) ? resp.data : []);
    }).catch(() => { message.error('加载试题失败'); });
  };

  const handleAnswerChange = (qid: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const submitAnswers = () => {
    if (!answeringPaper) return;
    setSubmitting(true);
    const body = {
      exam_paper_id: answeringPaper.id,
      submission_type: 'ONLINE',
      answers: questions.map((q) => ({ question_id: q.id, student_answer: answers[q.id] || '' })),
    };
    apiClient.post('/answers', body).then((resp) => {
      setAnswerResult(resp.data || resp);
      message.success('提交成功');
    }).catch((err: any) => {
      let detail = '提交失败';
      if (err?.response?.data) detail = err.response.data.detail || JSON.stringify(err.response.data);
      message.error(detail);
    }).finally(() => { setSubmitting(false); });
  };

  // Answering view
  if (answeringPaper) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Button size="small" onClick={() => setAnsweringPaper(null)}>← 返回试卷列表</Button>
          <Text strong style={{ marginLeft: 16, fontSize: 16 }}>{answeringPaper.title}</Text>
        </div>
        {answerResult ? (
          <Card title="答题结果" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="总分">{answerResult.total_score + '/' + (answerResult.max_score || '?')}</Descriptions.Item>
              <Descriptions.Item label="正确率">
                <Progress percent={answerResult.percentage || 0} size="small" strokeColor={(answerResult.percentage || 0) >= 60 ? '#52c41a' : '#ff4d4f'} />
              </Descriptions.Item>
            </Descriptions>
            <Button size="small" type="primary" style={{ marginTop: 12 }} onClick={() => { setAnsweringPaper(null); loadPapers(); }}>完成</Button>
          </Card>
        ) : (
          <Card
            title="在线答题"
            size="small"
            extra={<Button size="small" type="primary" loading={submitting} onClick={submitAnswers} disabled={questions.length === 0}>提交答案</Button>}
          >
            {questions.length === 0 ? (
              <Text type="secondary">加载试题中...</Text>
            ) : (
              questions.map((q, idx) => {
                let options: { label: string; text?: string }[] = [];
                try { const ca = JSON.parse(q.correct_answer || '{}'); options = ca.options || []; } catch {}
                return (
                  <Card key={q.id} size="small" style={{ marginBottom: 8 }}>
                    <Text strong>{idx + 1}. {q.title}</Text>
                    {options.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        <Radio.Group onChange={(e) => handleAnswerChange(q.id, e.target.value)} value={answers[q.id]}>
                          <Space direction="vertical">
                            {options.map((o) => (
                              <Radio key={o.label} value={o.label}>{o.label}. {o.text || o.label}</Radio>
                            ))}
                          </Space>
                        </Radio.Group>
                      </div>
                    ) : (
                      <div style={{ marginTop: 8 }}>
                        <Input placeholder="请输入答案" size="small" style={{ width: 300 }} onChange={(e) => handleAnswerChange(q.id, e.target.value)} />
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </Card>
        )}
      </div>
    );
  }

  // Paper list view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          我的试卷
        </Title>
        <Space>
          <Button size="small" icon={<CameraOutlined />} onClick={() => setImportOpen(true)}>拍照/扫描导入</Button>
          {selectedRowKeys.length > 0 && (
            <Popconfirm title={'确定删除选中的 ' + selectedRowKeys.length + ' 份试卷？'} onConfirm={handleBatchDelete}>
              <Button size="small" danger icon={<DeleteOutlined />}>批量删除({selectedRowKeys.length})</Button>
            </Popconfirm>
          )}
        </Space>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索试卷名称"
          value={searchTitle}
          onChange={(e) => setSearchTitle(e.target.value)}
          style={{ width: 180 }}
          prefix={<SearchOutlined />}
          allowClear
          size="small"
          onPressEnter={loadPapers}
        />
        <Select
          placeholder="年级"
          value={filterGrade}
          onChange={setFilterGrade}
          allowClear
          style={{ width: 100 }}
          size="small"
          options={gradeOptions}
        />
        <Select
          placeholder="状态"
          value={filterStatus}
          onChange={setFilterStatus}
          allowClear
          style={{ width: 100 }}
          size="small"
          options={statusOptions}
        />
        <Button size="small" icon={<SearchOutlined />} onClick={loadPapers}>查询</Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={papers}
        size="middle"
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) }}
        columns={[
          {
            title: '试卷名称',
            dataIndex: 'title',
            ellipsis: true,
            render: (text: string, record: PaperItem) => (
              <a onClick={() => handlePreview(record.id)}>{text}</a>
            ),
          },
          { title: '学科', dataIndex: 'subject', width: 70 },
          {
            title: '年级',
            dataIndex: 'grade_level',
            width: 120,
            render: (v: string | { grades?: string[] }) => {
              if (!v) return '-';
              try {
                const gl = typeof v === 'string' ? JSON.parse(v) : v;
                const gs = gl.grades || [];
                return gs.map((g: string) => {
                  const found = grades.find((r: { code: string; name: string }) => r.code === g);
                  return found ? found.name : g;
                }).join('、');
              } catch {
                return String(v);
              }
            },
          },
          {
            title: '判分状态',
            dataIndex: 'submission_status',
            width: 100,
            render: (s: string) => {
              if (!s) return <Tag>未提交</Tag>;
              const map: Record<string, { color: string; label: string }> = {
                GRADED: { color: 'green', label: '已判分' },
                GENERATED: { color: 'blue', label: '已生成' },
                RE_GRADED: { color: 'orange', label: '重新判' },
                已判分: { color: 'green', label: '已判分' },
                已生成: { color: 'blue', label: '已生成' },
                重新判: { color: 'orange', label: '重新判' },
              };
              const m = map[s] || { color: 'default', label: s };
              return <Tag color={m.color}>{m.label}</Tag>;
            },
          },
          {
            title: '操作',
            width: 220,
            render: (_: unknown, record: PaperItem) => {
              const isGenerated = record.submission_status === 'GENERATED' || record.submission_status === '已生成';
              return (
                <Space size={2}>
                  <Tooltip title="预览"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record.id)} /></Tooltip>
                  <Tooltip title={isGenerated ? '修改试卷状态：重新判' : '仅已生成状态可修改'}>
                    <Button type="link" size="small" icon={<EditOutlined />} disabled={!isGenerated} onClick={() => handleStatusChange(record)} />
                  </Tooltip>
                  <Tooltip title="打印"><Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record.id)} /></Tooltip>
                  <Tooltip title="在线答题"><Button type="link" size="small" icon={<PlayCircleOutlined />} style={{ color: '#1890ff' }} onClick={() => startAnswering(record)} /></Tooltip>
                  <Tooltip title="拍照/扫描录入"><Button type="link" size="small" icon={<CameraOutlined />} onClick={() => { setScanPaperId(record.id); setScanOpen(true); }} /></Tooltip>
                  <Tooltip title={isGenerated ? '已生成错题本，如需重新生成请先修改试卷状态' : '生成错题'}>
                    <Button type="link" size="small" icon={<BookOutlined />} style={{ color: isGenerated ? '#ccc' : '#52c41a' }} disabled={isGenerated} onClick={() => generateMistakeBook(record.id)} />
                  </Tooltip>
                  <Popconfirm title="确定删除该试卷？" onConfirm={() => handleDelete(record.id)}>
                    <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
                  </Popconfirm>
                </Space>
              );
            },
          },
        ]}
      />
      <PaperPreviewDrawer open={previewOpen} paperId={previewId} onClose={() => setPreviewOpen(false)} />
      <PaperImportModal open={importOpen} onClose={() => setImportOpen(false)} onSuccess={() => { setImportOpen(false); loadPapers(); }} />
      <Modal title="拍照/扫描录入答案" open={scanOpen} width={750} footer={null} onCancel={() => setScanOpen(false)}>
        <PhotoScanTab examPaperId={scanPaperId} onSubmitSuccess={() => { setScanOpen(false); loadPapers(); }} />
      </Modal>
    </div>
  );
}
