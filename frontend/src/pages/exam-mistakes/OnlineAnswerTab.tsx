import { useState, useEffect } from 'react';
import { Table, Button, Card, Input, Select, Space, Tag, Typography, Radio, message, Progress, Empty, Row, Col, Tooltip, Popconfirm } from 'antd';
import { SearchOutlined, PlayCircleOutlined, EyeOutlined, DeleteOutlined, CheckCircleOutlined, ArrowUpOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import apiClient from '../../api/client';
import PaperPreviewDrawer from '../papers/PaperPreviewDrawer';
import { useReferenceValues, toLabelMap } from '../../hooks/useReferenceValues';
import { getUserId, getUserType } from '../../store/auth';

const { Title, Text } = Typography;

const SUBJECT_OPTIONS = [
  { value: '数学', label: '数学' }, { value: '语文', label: '语文' }, { value: '英语', label: '英语' },
  { value: '物理', label: '物理' }, { value: '化学', label: '化学' },
];

interface Paper {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  total_score: number;
  duration_minutes: number;
  status: string;
}

interface Question {
  id: string;
  title: string;
  question_type: string;
  correct_answer: string;
  score: number;
}

interface AnswerDetailItem {
  question_id: string;
  student_answer: string;
  is_correct: boolean;
  feedback: string;
}

interface SubmissionResult {
  id: string;
  total_score: number;
  percentage: number;
  answers: AnswerDetailItem[];
}

interface AnswerOption {
  label: string;
  text: string;
}

interface ParsedAnswer {
  options?: AnswerOption[];
  correct_answer?: string | string[];
}

export default function OnlineAnswerTab() {
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [pendingPapers, setPendingPapers] = useState<Paper[]>([]);
  const [pendingFilter, setPendingFilter] = useState('');
  const [pendingSubj, setPendingSubj] = useState('');
  const [allFilter, setAllFilter] = useState('');
  const [allSubjFilter, setAllSubjFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Answering flow
  const [answeringPaper, setAnsweringPaper] = useState<Paper | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const userId = getUserId();
  const userType = getUserType();
  const { 'question-types': qtypes } = useReferenceValues();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  function loadData() {
    setLoading(true);
    Promise.all([
      apiClient.get('/exam-papers', { params: { status: 'PUBLISHED', limit: 100 } }).catch(() => ({ data: [] })),
      apiClient.get('/answers/student/' + userId).catch(() => ({ data: [] })),
    ]).then((results) => {
      const papers: Paper[] = results[0].data || [];
      setAllPapers(Array.isArray(papers) ? papers : []);
      const submissions = results[1].data || [];
      const submittedIds: Record<string, boolean> = {};
      (Array.isArray(submissions) ? submissions : []).forEach((s: { exam_paper_id: string }) => { submittedIds[s.exam_paper_id] = true; });
      setPendingPapers(papers.filter((p) => !submittedIds[p.id]));
    }).finally(() => { setLoading(false); });
  }

  function startAnswering(paper: Paper) {
    setAnsweringPaper(paper);
    setAnswers({});
    setResult(null);
    apiClient.get('/exam-papers/' + paper.id + '/questions').then((resp) => {
      setQuestions(Array.isArray(resp.data) ? resp.data : []);
    }).catch(() => { message.error('加载试题失败'); });
  }

  async function handleSubmit() {
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) { message.warning('还有 ' + unanswered.length + ' 题未作答'); return; }
    setSubmitting(true);
    try {
      const answerList = questions.map((q) => ({ question_id: q.id, student_answer: answers[q.id] || '' }));
      const resp = await apiClient.post('/answers', {
        exam_paper_id: answeringPaper!.id, submission_type: 'ONLINE', answers: answerList,
      });
      const subId = resp.data.id;
      const resultResp = await apiClient.get('/answers/' + subId);
      setResult(resultResp.data);
      message.success('提交成功！得分: ' + (resultResp.data.total_score || 0));
    } catch (e: unknown) {
      let detail = '提交失败';
      const err = e as { response?: { data?: { detail?: string } } };
      if (err?.response?.data) detail = err.response.data.detail || JSON.stringify(err.response.data);
      message.error(detail);
    }
    setSubmitting(false);
  }

  function moveToPending(paperIds: React.Key | React.Key[]) {
    const ids = Array.isArray(paperIds) ? paperIds : [paperIds];
    const toAdd = allPapers.filter((p) => ids.indexOf(p.id) >= 0 && !pendingPapers.find((pp) => pp.id === p.id));
    if (toAdd.length > 0) {
      setPendingPapers(pendingPapers.concat(toAdd));
      message.success('已加入 ' + toAdd.length + ' 份试卷到待作答区');
    }
    setSelectedRowKeys([]);
  }

  function removeFromPending(paperId: string) {
    setPendingPapers(pendingPapers.filter((p) => p.id !== paperId));
  }

  function handlePreview(paperId: string) { setPreviewId(paperId); setPreviewOpen(true); }

  async function handleDeletePaper(paperId: string) {
    try {
      await apiClient.delete('/exam-papers/' + paperId);
      message.success('试卷已删除');
      setAllPapers(allPapers.filter((p) => p.id !== paperId));
      setPendingPapers(pendingPapers.filter((p) => p.id !== paperId));
    } catch {
      message.error('删除失败');
    }
  }

  function goBack() { setAnsweringPaper(null); setResult(null); setQuestions([]); loadData(); }

  function filterPapers(list: Paper[], title: string, subject: string) {
    return list.filter((p) => {
      if (title && (p.title || '').indexOf(title) < 0) return false;
      if (subject && p.subject !== subject) return false;
      return true;
    });
  }

  const paperColumns: ColumnsType<Paper> = [
    { title: '试卷名称', dataIndex: 'title', ellipsis: true },
    { title: '学科', dataIndex: 'subject', width: 60 },
    { title: '年级', dataIndex: 'grade_level', width: 70 },
    { title: '总分', dataIndex: 'total_score', width: 60, align: 'center' as const },
    { title: '时长', dataIndex: 'duration_minutes', width: 70, align: 'center' as const, render: (v: number) => v ? v + '分钟' : '-' },
  ];

  const pendingColumns: ColumnsType<Paper> = [
    ...paperColumns,
    { title: '操作', width: 120, render: (_, r) => (
      <Space size={4}>
        <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => startAnswering(r)}>开始答题</Button>
        <Button type="text" size="small" danger onClick={() => removeFromPending(r.id)}>移除</Button>
      </Space>
    )},
  ];

  const allColumns: ColumnsType<Paper> = [
    ...paperColumns,
    { title: '状态', dataIndex: 'status', width: 70, render: () => <Tag color="green">可作答</Tag> },
    { title: '操作', width: userType !== 'STUDENT' ? 130 : 70, render: (_, r) => (
      <Space size={2}>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(r.id)}>预览</Button>
        {userType !== 'STUDENT' ? (
          <Popconfirm title="确定删除该试卷？" onConfirm={() => handleDeletePaper(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        ) : null}
      </Space>
    )},
  ];

  const pendingFiltered = filterPapers(pendingPapers, pendingFilter, pendingSubj);
  const allFiltered = filterPapers(allPapers, allFilter, allSubjFilter);

  // Answering UI
  if (answeringPaper) {
    if (result) {
      const wrongDetails = (result.answers || []).filter((d) => !d.is_correct);
      return (
        <div>
          <Button onClick={goBack} style={{ marginBottom: 12 }}>← 返回试卷列表</Button>
          <Card style={{ marginBottom: 16, textAlign: 'center' }}>
            <Title level={5}>{answeringPaper.title} — 答题结果</Title>
            <Progress type="circle" size={100} percent={result.percentage || 0} format={() => (result.total_score || 0) + '分'} />
            <div style={{ marginTop: 12 }}>
              <Space size={24}>
                <Text>总分: <Text strong>{answeringPaper.total_score || 0}</Text></Text>
                <Text>得分: <Text strong type={(result.total_score || 0) >= (answeringPaper.total_score || 60) * 0.6 ? 'success' : 'danger'}>{result.total_score || 0}</Text></Text>
                <Text>正确: <Text strong type="success">{(result.answers || []).filter((d) => d.is_correct).length}</Text></Text>
                <Text>错误: <Text strong type="danger">{wrongDetails.length}</Text></Text>
              </Space>
            </div>
          </Card>
          {wrongDetails.length > 0 ? (
            <Card title={'错题信息（共' + wrongDetails.length + '题）'} size="small">
              {wrongDetails.map((d, i) => {
                const q = questions.find((q) => q.id === d.question_id);
                return (
                  <div key={i} style={{ marginBottom: 8, padding: 10, background: '#fff7f5', borderRadius: 6, border: '1px solid #ffd8d2' }}>
                    <Text strong>{(i + 1) + '. ' + ((q && q.title) || d.question_id)}</Text>
                    <div><Text type="danger">你的答案: {d.student_answer || '未作答'}</Text></div>
                    {d.feedback ? <div><Text type="secondary">{d.feedback}</Text></div> : null}
                  </div>
                );
              })}
            </Card>
          ) : (
            <Card style={{ textAlign: 'center', padding: 20 }}>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
              <Title level={5} style={{ marginTop: 12 }}>全部正确！</Title>
            </Card>
          )}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button type="primary" size="large" onClick={goBack}>返回试卷列表</Button>
          </div>
        </div>
      );
    }

    const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;
    return (
      <div>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={goBack}>← 返回试卷列表</Button>
          <Space>
            <Text type="secondary">已答 {answeredCount}/{questions.length} 题</Text>
            <Button type="primary" size="large" onClick={handleSubmit} loading={submitting}
              disabled={answeredCount < questions.length} icon={<CheckCircleOutlined />}>提交试卷</Button>
          </Space>
        </div>
        <Card title={answeringPaper.title + '（共' + questions.length + '题，满分' + (answeringPaper.total_score || 0) + '分）'}>
          {questions.map((q, i) => {
            let answerData: ParsedAnswer = {};
            try { answerData = JSON.parse(q.correct_answer || '{}'); } catch { /* ignore */ }
            const options = answerData.options;
            const qType = q.question_type;
            return (
              <Card key={q.id} size="small" style={{ marginBottom: 8 }}
                title={<Space><Tag>{toLabelMap(qtypes)[qType] || qType}</Tag><Text>{(i + 1) + '. ' + (q.title || '').substring(0, 80)}（{q.score || 0}分）</Text></Space>}>
                {(qType === 'SINGLE_CHOICE' || qType === 'MULTIPLE_CHOICE') && options
                  ? (
                    <Radio.Group value={answers[q.id]} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      style={{ display: 'block', marginLeft: 16 }}>
                      {options.map((opt) => (
                        <Radio key={opt.label} value={opt.label} style={{ display: 'block', marginBottom: 6, padding: 6, borderRadius: 4, background: answers[q.id] === opt.label ? '#f0f5ff' : 'transparent' }}>
                          {opt.label + '. ' + (opt.text || '')}
                        </Radio>
                      ))}
                    </Radio.Group>
                  )
                  : (
                    <div style={{ marginLeft: 16 }}>
                      <Input.TextArea rows={3} placeholder="请输入答案" value={answers[q.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        style={{ maxWidth: 500 }} />
                    </div>
                  )
                }
              </Card>
            );
          })}
        </Card>
      </div>
    );
  }

  // ── Top-Bottom Layout ──
  return (
    <div>
      {/* 待作答试卷 */}
      <Card
        title={<Space><Text strong style={{ fontSize: 15 }}>待作答试卷</Text><Tag color="blue">{pendingFiltered.length}</Tag></Space>}
        size="small"
        style={{ marginBottom: 8 }}
        extra={pendingFiltered.length > 0 ? <Text type="secondary" style={{ fontSize: 12 }}>点击"开始答题"进入作答</Text> : null}
      >
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col flex={1}>
            <Input placeholder="搜索试卷名称" value={pendingFilter} onChange={(e) => setPendingFilter(e.target.value)}
              prefix={<SearchOutlined />} allowClear />
          </Col>
          <Col>
            <Select placeholder="学科" value={pendingSubj || undefined} onChange={(v) => setPendingSubj(v || '')}
              allowClear style={{ width: 100 }} options={SUBJECT_OPTIONS} />
          </Col>
        </Row>
        {pendingFiltered.length > 0
          ? <Table<Paper> rowKey="id" size="small" dataSource={pendingFiltered} columns={pendingColumns} pagination={false} loading={loading} />
          : <Empty description="暂无待作答试卷" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '20px 0' }} />
        }
      </Card>

      {/* Transition zone */}
      <div style={{ textAlign: 'center', margin: '4px 0' }}>
        <Tooltip title="在下栏勾选试卷后，点击此按钮加入待作答区">
          <Button type="dashed" size="small" icon={<ArrowUpOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={() => moveToPending(selectedRowKeys)}>
            {selectedRowKeys.length > 0 ? '加入待作答 (' + selectedRowKeys.length + ')' : '↑ 从下方勾选试卷加入待作答 ↑'}
          </Button>
        </Tooltip>
      </div>

      {/* 我所有的试卷 */}
      <Card
        title={<Space><Text strong style={{ fontSize: 15 }}>我所有的试卷</Text><Tag color="default">{allFiltered.length}</Tag></Space>}
        size="small"
        extra={selectedRowKeys.length > 0 ? (
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>已选 {selectedRowKeys.length} 份</Text>
            <Button type="primary" size="small" icon={<ArrowUpOutlined />} onClick={() => moveToPending(selectedRowKeys)}>加入待作答</Button>
          </Space>
        ) : <Text type="secondary" style={{ fontSize: 12 }}>勾选试卷后可加入上方待作答区</Text>}
      >
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col flex={1}>
            <Input placeholder="搜索试卷名称" value={allFilter} onChange={(e) => setAllFilter(e.target.value)}
              prefix={<SearchOutlined />} allowClear />
          </Col>
          <Col>
            <Select placeholder="学科" value={allSubjFilter || undefined} onChange={(v) => setAllSubjFilter(v || '')}
              allowClear style={{ width: 100 }} options={SUBJECT_OPTIONS} />
          </Col>
        </Row>
        {allFiltered.length > 0
          ? (
            <Table<Paper>
              rowKey="id" size="small" dataSource={allFiltered} columns={allColumns}
              loading={loading} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => '共 ' + t + ' 份' }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
                getCheckboxProps: (r) => ({ disabled: !!pendingPapers.find((p) => p.id === r.id) }),
              }}
            />
          )
          : <Empty description="暂无试卷" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '20px 0' }} />
        }
      </Card>

      <PaperPreviewDrawer open={previewOpen} paperId={previewId || ''} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}
