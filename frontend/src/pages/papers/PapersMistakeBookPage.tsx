import { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Typography, Space, Tag, message, Modal, Radio, Card, Progress, Descriptions, Tabs } from 'antd';
import { EditOutlined, CameraOutlined, PrinterOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import PaperPreviewDrawer from './PaperPreviewDrawer';
import GenerateMistakeBookTab from '../exam-mistakes/GenerateMistakeBookTab';
import PhotoScanTab from '../exam-mistakes/PhotoScanTab';

const Title = Typography.Title;
const Text = Typography.Text;

export default function PapersMistakeBookPage() {
  const [activeTab, setActiveTab] = useState('list');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>试卷错题本</Title>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} size="large" items={[
        {
          key: 'list',
          label: <Space><EditOutlined />试卷列表</Space>,
          children: <PaperListWithActions />
        },
        {
          key: 'generate',
          label: <Space><PrinterOutlined />生成纸质错题练习本</Space>,
          children: <GenerateMistakeBookTab />
        },
      ]} />
    </div>
  );
}


function PaperListWithActions() {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjFilter, setSubjFilter] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Answering flow
  const [answeringPaper, setAnsweringPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Photo scan modal
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(function () { loadPapers(); }, []);

  function loadPapers() {
    setLoading(true);
    apiClient.get('/exam-papers', { params: { status: 'PUBLISHED', limit: 100 } }).then(function (resp) {
      setPapers(Array.isArray(resp.data) ? resp.data : []);
    }).catch(function () { setPapers([]); })
    .finally(function () { setLoading(false); });
  }

  // ── Online Answering ──
  function startAnswering(paper: any) {
    setAnsweringPaper(paper);
    setAnswers({});
    setResult(null);
    apiClient.get('/exam-papers/' + paper.id + '/questions').then(function (resp) {
      setQuestions(Array.isArray(resp.data) ? resp.data : []);
    }).catch(function () { message.error('加载试题失败'); });
  }

  function handleAnswerChange(qid: string, value: any) {
    const newAnswers: Record<string, any> = {}; Object.keys(answers).forEach(function (k) { newAnswers[k] = answers[k]; });
    newAnswers[qid] = value; setAnswers(newAnswers);
  }

  function submitAnswers() {
    setSubmitting(true);
    const body = { exam_paper_id: answeringPaper.id, answers: questions.map(function (q: any) { return { question_id: q.id, answer_text: answers[q.id] || '' }; }) };
    apiClient.post('/answers', body).then(function (resp) {
      setResult(resp.data || resp);
      message.success('提交成功');
    }).catch(function () { message.error('提交失败'); })
    .finally(function () { setSubmitting(false); });
  }

  // ── Generate Mistake Book ──
  function generateMistakeBook(paperId: string) {
    apiClient.post('/error-notebooks/generate', { exam_paper_id: paperId }).then(function () {
      message.success('错题本已生成');
    }).catch(function () { message.error('生成失败'); });
  }

  function handlePreview(id: string) { setPreviewId(id); setPreviewOpen(true); }

  // Filter
  const filteredPapers = papers.filter(function (p: any) {
    if (search && !(p.title || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (subjFilter && p.subject !== subjFilter) return false;
    return true;
  });

  return (
    <div>
      {/* ── Answering View ── */}
      {answeringPaper ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Button size="small" onClick={function () { setAnsweringPaper(null); }}>← 返回试卷列表</Button>
            <Text strong style={{ marginLeft: 16, fontSize: 16 }}>{answeringPaper.title}</Text>
          </div>
          {result ? (
            <Card title="答题结果" size="small">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="总分">{result.total_score + '/' + (result.max_score || '?')}</Descriptions.Item>
                <Descriptions.Item label="正确率">
                  <Progress percent={result.percentage || 0} size="small" strokeColor={(result.percentage || 0) >= 60 ? '#52c41a' : '#ff4d4f'} />
                </Descriptions.Item>
              </Descriptions>
              <Button size="small" type="primary" onClick={function () { setAnsweringPaper(null); loadPapers(); }}>完成</Button>
            </Card>
          ) : (
            <Card title="在线答题" size="small" extra={<Button size="small" type="primary" loading={submitting} onClick={submitAnswers} disabled={questions.length === 0}>提交答案</Button>}>
              {questions.length === 0 ? (
                <Text type="secondary">加载试题中...</Text>
              ) : (
                questions.map(function (q: any, idx: number) {
                  return (
                    <Card key={q.id} size="small" style={{ marginBottom: 8 }}>
                      <Text strong>{(idx + 1) + '. ' + q.title}</Text>
                      <div style={{ marginTop: 8 }}>
                        <Radio.Group onChange={function (e) { handleAnswerChange(q.id, e.target.value); }} value={answers[q.id]}>
                          <Space direction="vertical">
                            {q.correct_answer ? (function () { try { const ca = JSON.parse(q.correct_answer); return (ca.options || []).map(function (o: any) { return <Radio key={o.label} value={o.label}>{o.label + '. ' + (o.text || o)}</Radio>; }); } catch { return null; } })() : null}
                          </Space>
                        </Radio.Group>
                      </div>
                    </Card>
                  );
                })
              )}
            </Card>
          )}
        </div>
      ) : (
        // ── Paper List ──
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Input placeholder="搜索试卷名称" value={search} onChange={function (e) { setSearch(e.target.value); }}
              style={{ width: 180 }} prefix={<SearchOutlined />} allowClear size="small"
            />
            <Select placeholder="学科" value={subjFilter || undefined} onChange={setSubjFilter}
              allowClear style={{ width: 100 }} size="small"
              options={[{ value: '数学', label: '数学' }, { value: '语文', label: '语文' }, { value: '英语', label: '英语' }, { value: '物理', label: '物理' }, { value: '化学', label: '化学' }]}
            />
          </div>
          <Table rowKey="id" loading={loading} dataSource={filteredPapers} size="middle"
            columns={[
              { title: '试卷名称', dataIndex: 'title', ellipsis: true,
                render: function (text: string, record: any) { return <a onClick={function () { handlePreview(record.id); }}>{text}</a>; }
              },
              { title: '学科', dataIndex: 'subject', width: 80 },
              { title: '年级', dataIndex: 'grade_level', width: 80 },
              { title: '总分', dataIndex: 'total_score', width: 60, align: 'center' },
              { title: '时长(分)', dataIndex: 'duration_minutes', width: 70, align: 'center' },
              { title: '状态', dataIndex: 'status', width: 80, render: function (s: any) { return <Tag>{s}</Tag>; } },
              { title: '操作', width: 280, render: function (_: any, record: any) {
                return (
                  <Space>
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={function () { startAnswering(record); }}>在线答题</Button>
                    <Button type="link" size="small" icon={<CameraOutlined />} onClick={function () { setScanOpen(true); }}>拍照/扫描录入</Button>
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={function () { handlePreview(record.id); }}>预览</Button>
                    <Button type="link" size="small" icon={<PrinterOutlined />} onClick={function () { generateMistakeBook(record.id); }}>生成错题</Button>
                  </Space>
                );
              }}
            ]}
          />
          <PaperPreviewDrawer open={previewOpen} paperId={previewId || ''} onClose={function () { setPreviewOpen(false); }} />

          {/* Photo Scan Modal */}
          <Modal title="拍照/扫描录入答案" open={scanOpen} width={750} footer={null} onCancel={function () { setScanOpen(false); }}>
            <PhotoScanTab />
          </Modal>
        </div>
      )}
    </div>
  );
}
