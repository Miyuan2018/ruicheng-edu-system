import { useEffect, useState } from 'react';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';
import { Table, Button, Tag, Typography, Space, message, Card, Statistic, Row, Col, Empty, DatePicker, Select, Input, Modal, Form, Popconfirm, Descriptions, Divider, Upload, Progress, Spin, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, DeleteOutlined, CameraOutlined, EyeOutlined, PrinterOutlined, ThunderboltOutlined, ScanOutlined, PlayCircleOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import PhotoScanTab from '../exam-mistakes/PhotoScanTab';
import { getUserId } from '../../store/auth';
import ExplanationDrawer from '../../components/topic-board/ExplanationDrawer';

const Title = Typography.Title;
const Text = Typography.Text;
const RangePicker = DatePicker.RangePicker;

export default function MistakeBookPage() {
  const userId = getUserId();
  type AnyObj = Record<string, any>;
  const [books, setBooks] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBook, setPreviewBook] = useState<AnyObj | null>(null);
  const [practiceLoading, setPracticeLoading] = useState<Record<string, boolean>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState<AnyObj | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerQuestionId, setDrawerQuestionId] = useState<string | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const quickEntryForm = Form.useForm()[0];
  const refValues = useReferenceValues();
  const qtypes = refValues['question-types'];
  const errorTypes = refValues['error-types'];
  const [subjectOptions, setSubjectOptions] = useState<{ value: string; label: string }[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(function () { loadBooks(); }, []);
  useEffect(function () {
    apiClient.get('/subjects/all').then(function (res) {
      setSubjectOptions((res.data || []).filter(function (s: AnyObj) { return s.is_active; }).map(function (s: AnyObj) { return { value: s.name, label: s.name }; }));
    }).catch(function () {});
  }, []);

  function loadBooks() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (dateRange && dateRange[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
    if (dateRange && dateRange[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');
    apiClient.get('/error-notebooks/student/' + userId, { params: params }).then(function (resp) {
      const data = resp.data || [];
      setBooks(Array.isArray(data) ? data : []);
    }).catch(function () { setBooks([]); })
    .finally(function () { setLoading(false); });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(function () { loadBooks(); }, [dateRange]);

  function generateMistakeBook() {
    setGenerating(true);
    apiClient.post('/error-notebooks/generate').then(function () {
      message.success('纸质错题练习本生成成功');
      setTimeout(loadBooks, 1500);
    }).catch(function () { message.error('生成失败'); })
    .finally(function () { setGenerating(false); });
  }

  function generatePractice(bookId: string) {
    const pl: Record<string, boolean> = {}; pl[bookId] = true; setPracticeLoading(Object.assign({}, practiceLoading, pl));
    apiClient.post('/error-notebooks/' + bookId + '/practice').then(function () {
      message.success('加强练习题已生成');
      loadBooks();
    }).catch(function (e) {
      if (e && e.response && e.response.status === 404) message.info('加强练习功能将在下一版本完善');
      else message.error('生成失败');
    }).finally(function () {
      const pl2: Record<string, boolean> = {}; pl2[bookId] = false; setPracticeLoading(Object.assign({}, practiceLoading, pl2));
    });
  }

  async function handleDelete(id: string) {
    try { await apiClient.delete('/error-notebooks/' + id); message.success('已删除'); loadBooks(); }
    catch { message.error('删除失败'); }
  }

  function handlePrintSingle(book: AnyObj) {
    // Fetch full notebook with questions for printing
    apiClient.get('/error-notebooks/' + book.id).then(function (resp) {
      const data = resp.data || resp;
      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) { message.info('请允许弹出窗口'); return; }
      let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + (data.title || '错题本') + '</title>';
      html += '<style>body{font-family:"Microsoft YaHei",SimSun,serif;font-size:14px;padding:20px;color:#333;line-height:1.8;}';
      html += 'h1{text-align:center;font-size:20px;margin-bottom:4px;}';
      html += '.meta{text-align:center;color:#999;font-size:12px;margin-bottom:16px;}';
      html += '.mistake{border:1px solid #e8e8e8;border-radius:6px;padding:12px;margin-bottom:12px;page-break-inside:avoid;}';
      html += '.mistake .q-title{font-weight:bold;margin-bottom:6px;font-size:15px;}';
      html += '.mistake .wrong{color:#d4380d;margin:4px 0;}';
      html += '.mistake .right{color:#389e0d;margin:4px 0;}';
      html += '.mistake .practice{border-top:1px dashed #d9d9d9;margin-top:10px;padding-top:10px;color:#1677ff;}';
      html += '.mistake .field{margin-bottom:6px;}';
      html += '.print-btn{position:fixed;top:15px;right:15px;padding:8px 16px;background:#1677ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;}';
      html += '@media print{.print-btn{display:none;}body{padding:10px;}}</style></head><body>';
      html += '<button class="print-btn" onclick="window.print()">打印</button>';
      html += '<h1>' + (data.title || '错题本') + '</h1>';
      html += '<p class="meta">错题数: ' + (data.question_count || 0) + ' | 生成时间: ' + (data.generated_at || '').substring(0, 16) + '</p>';

      const questions = data.questions || [];
      questions.forEach(function (q: AnyObj, i: number) {
        html += '<div class="mistake">';
        html += '<div class="q-title">' + (i+1) + '. ' + (q.question_title || '题目') + '</div>';
        html += '<div class="wrong"> 错误答案: ' + (q.student_answer || '未作答') + '</div>';
        html += '<div class="right"> 正确答案: ' + (q.correct_answer || '-') + '</div>';
        html += '<div class="practice">';
        html += '<div class="field"><strong>原题信息:</strong></div>';
        html += '<div>' + (q.question_title || '题目') + '</div>';
        if (q.practice_question) {
          html += '<div class="field" style="margin-top:8px;"><strong>加强训练题:</strong></div>';
          html += '<div>' + q.practice_question + '</div>';
        } else {
          html += '<div class="field" style="margin-top:8px;"><strong>加强训练题:</strong></div>';
          html += '<div style="color:#999;">（请先点击"加强练习"按钮生成）</div>';
        }
        html += '<div style="margin-top:8px;border-bottom:1px dotted #ccc;padding-bottom:4px;">作答区: ________________________</div>';
        html += '</div>';
        html += '</div>';
      });

      html += '</body></html>';
      w.document.write(html);
      w.document.close();
      setTimeout(function () { w.print(); }, 600);
    }).catch(function () { message.error('加载错题本失败'); });
  }

  function handlePreview(book: AnyObj) {
    setPreviewBook(book);
    apiClient.get('/error-notebooks/' + book.id).then(function (resp) {
      setPreviewBook(Object.assign({}, book, resp.data || {}));
    }).catch(function () {
      setPreviewBook(Object.assign({}, book, { questions: [] }));
    });
    setPreviewOpen(true);
  }

  function handleReview(record: AnyObj) {
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewData(null);
    apiClient.get('/exam-papers/' + record.exam_paper_id + '/review').then(function (resp) {
      setReviewData(resp.data || resp);
    }).catch(function () { message.error('加载复盘数据失败'); })
    .finally(function () { setReviewLoading(false); });
  }

  function handlePrintPractice() {
    setPrintLoading(true);
    const incomplete = books.filter(function (b) { return b.status !== 'EXPORTED'; });
    if (incomplete.length === 0) { message.info('所有错题已全部完成，无需打印'); setPrintLoading(false); return; }
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { message.info('请允许弹出窗口'); setPrintLoading(false); return; }
    let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>纸质错题练习本</title>';
    html += '<style>body{font-family:"Microsoft YaHei",SimSun,serif;font-size:14px;padding:30px;color:#333;line-height:1.6;}';
    html += 'h1{text-align:center;font-size:22px;margin-bottom:4px;}';
    html += '.meta{text-align:center;color:#999;font-size:12px;margin-bottom:20px;}';
    html += '.book{margin-bottom:30px;page-break-after:always;}';
    html += '.book h2{font-size:17px;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:10px;}';
    html += '.book-info{color:#666;font-size:12px;margin-bottom:8px;}';
    html += '.mistake{border:1px solid #e8e8e8;border-radius:6px;padding:12px;margin-bottom:10px;}';
    html += '.mistake .q-title{font-weight:bold;margin-bottom:4px;}';
    html += '.mistake .wrong{color:#d4380d;margin:2px 0;}';
    html += '.mistake .right{color:#389e0d;margin:2px 0;}';
    html += '.mistake .practice{border-top:1px dashed #d9d9d9;margin-top:8px;padding-top:8px;color:#1677ff;}';
    html += '.practice .field{margin-bottom:6px;}';
    html += '.print-btn{position:fixed;top:15px;right:15px;padding:8px 16px;background:#1677ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;}';
    html += '@media print{.print-btn{display:none;}body{padding:10px;}.mistake{page-break-inside:avoid;}}</style></head><body>';
    html += '<button class="print-btn" onclick="window.print()">🖨 打印</button>';
    html += '<h1>纸质错题练习本</h1>';
    html += '<p class="meta">筛选未完成错题 · 共' + incomplete.length + '本 · 打印时间: ' + new Date().toLocaleDateString('zh-CN') + '</p>';

    incomplete.forEach(function (book) {
      html += '<div class="book">';
      html += '<h2>' + (book.title || '错题本') + '</h2>';
      html += '<p class="book-info">生成时间: ' + (book.generated_at || '').substring(0, 16) + ' | 错题数: ' + (book.question_count || 0) + ' | 来源: ' + (book.exam_paper_id ? '试卷' : '手动录入') + '</p>';

      if (book.questions && book.questions.length > 0) {
        book.questions.forEach(function (q: AnyObj, i: number) {
          html += '<div class="mistake">';
          html += '<div class="q-title">' + (i+1) + '. ' + (q.question_title || q.title || '题目') + '</div>';
          html += '<div class="wrong">✗ 错误答案: ' + (q.student_answer || '未作答') + '</div>';
          html += '<div class="right">✓ 正确答案: ' + (q.correct_answer || '') + '</div>';
          html += '<div class="practice">';
          html += '<div class="field"><strong>📝 原题信息:</strong></div>';
          html += '<div>' + (q.question_title || q.title || '题目') + '</div>';
          if (q.practice_question) {
            html += '<div class="field" style="margin-top:8px;"><strong>💪 加强训练题:</strong></div>';
            html += '<div>' + q.practice_question + '</div>';
          } else {
            html += '<div class="field" style="margin-top:8px;"><strong>💪 加强训练题:</strong></div>';
            html += '<div style="color:#999;">（点击"生成加强练习"按钮获取）</div>';
          }
          html += '<div style="margin-top:8px;border-bottom:1px dotted #ccc;padding-bottom:4px;">作答区: ________________________</div>';
          html += '</div>';
          html += '</div>';
        });
      } else {
        html += '<p style="color:#999;">暂无详细错题数据，请先通过预览查看或生成加强练习题</p>';
      }
      html += '</div>';
    });

    html += '</body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(function () { w.print(); }, 800);
    setPrintLoading(false);
  }

  async function handleQuickEntry(values: AnyObj) {
    setEntrySaving(true);
    try {
      const resp = await apiClient.post('/error-notebooks/manual-entry', values);
      if (resp.data && resp.data.ok) {
        message.success('错题已录入');
        setQuickEntryOpen(false);
        quickEntryForm.resetFields();
        loadBooks();
      }
    } catch (e: unknown) {
      let detail = '录入失败';
      const err = e as AnyObj;
      if (err && err.response && err.response.data) detail = err.response.data.detail || JSON.stringify(err.response.data);
      message.error(detail);
    }
    setEntrySaving(false);
  }

  function handleBatchDelete() {
    if (!selectedRowKeys || selectedRowKeys.length === 0) return;
    Modal.confirm({
      title: '批量删除错题本',
      content: '确定删除已选的 ' + selectedRowKeys.length + ' 个错题本？',
      okText: '确认删除', okButtonProps: { danger: true },
      onOk: function () {
        return Promise.all(selectedRowKeys.map(function (id) { return apiClient.delete('/error-notebooks/' + id); }))
          .then(function () { message.success('已删除 ' + selectedRowKeys.length + ' 个'); setSelectedRowKeys([]); loadBooks(); })
          .catch(function () { message.error('删除失败'); });
      }
    });
  }

  function handleBatchPractice() {
    if (!selectedRowKeys || selectedRowKeys.length === 0) return;
    const total = selectedRowKeys.length; let done = 0, failed = 0;
    const hide = message.loading('正在生成加强练习... (0/' + total + ')', 0);
    Promise.all(selectedRowKeys.map(function (id) {
      return apiClient.post('/error-notebooks/' + id + '/practice').then(function () { done++; }).catch(function () { failed++; });
    })).finally(function () {
      hide();
      if (failed > 0) message.warning('完成 ' + done + '/' + total + '，失败 ' + failed);
      else message.success('已为 ' + done + ' 个错题本生成加强练习');
      setSelectedRowKeys([]); loadBooks();
    });
  }

  function handleScanEntry() {
    setQuickEntryOpen(false);
    message.info('请使用 Tab 页中的「拍照扫描」功能录入错题');
    // Navigate to scan tab - triggered by parent or menu
  }

  // Apply subject + keyword filters client-side
  const filteredBooks = books.filter(function (b) {
    if (filterSubject && (b.subject || '') !== filterSubject) return false;
    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase();
      if ((b.title || '').toLowerCase().indexOf(kw) < 0 && (b.exam_paper_title || '').toLowerCase().indexOf(kw) < 0) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>消灭错题</Title>
        <Space>
          <Button icon={<CameraOutlined />} type="default" onClick={function () { setQuickEntryOpen(true); quickEntryForm.resetFields(); }}>快速录入</Button>
          <Button type="primary" icon={<PrinterOutlined />} loading={generating} onClick={generateMistakeBook}>生成纸质错题练习本</Button>
        </Space>
      </div>

      {/* Stats cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="错题本数量" value={books.length} valueStyle={{ fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总错题数" value={books.reduce(function (s, b) { return s + (b.question_count || 0); }, 0)} valueStyle={{ fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已完成" value={books.filter(function (b) { return b.status === 'EXPORTED'; }).length} valueStyle={{ fontSize: 24, color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待完成" value={books.filter(function (b) { return b.status !== 'EXPORTED'; }).length} valueStyle={{ fontSize: 24, color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      {/* 纸质错题练习本 + 筛选 + 表格 */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <PrinterOutlined />
            纸质错题练习本
          </Space>
        }
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {'未完成: ' + books.filter(function (b) { return b.status !== 'EXPORTED'; }).length + ' 本 | ' +
               '总错题: ' + books.filter(function (b) { return b.status !== 'EXPORTED'; }).reduce(function (s, b) { return s + (b.question_count || 0); }, 0) + ' 题'}
            </Text>
            <Button icon={<PrinterOutlined />} onClick={handlePrintPractice} loading={printLoading} type="primary" ghost size="small">筛选并打印</Button>
            <Button size="small" icon={<ThunderboltOutlined />} onClick={handleBatchPractice}>批量生成加强练习</Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>批量删除</Button>
          </Space>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          自动筛选未完成的错题，打印「原错题信息 + 错题加强训练题」。打印前请先为各错题本生成加强练习题。
        </Text>

        {/* Filter bar */}
        <Row gutter={12} align="middle" style={{ marginBottom: 12 }}>
          <Col>
            <Text strong>筛选:</Text>
          </Col>
          <Col>
            <RangePicker value={dateRange} onChange={setDateRange} size="small" placeholder={['开始日期', '结束日期']} style={{ width: 220 }} />
          </Col>
          <Col>
            <Select
              placeholder="学科"
              value={filterSubject || undefined}
              onChange={function (v) { setFilterSubject(v || ''); }}
              allowClear
              style={{ width: 90 }}
              size="small"
              options={subjectOptions}
            />
          </Col>
          <Col flex={1}>
            <Input
              placeholder="搜索错题本名称或试卷名"
              value={filterKeyword}
              onChange={function (e) { setFilterKeyword(e.target.value); }}
              allowClear
              size="small"
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} size="small" onClick={loadBooks}>刷新</Button>
          </Col>
        </Row>

        {/* Table */}
        {filteredBooks.length === 0 && !loading ? (
          <Empty description="暂无错题本，提交试卷作答或使用&quot;快速录入&quot;添加错题" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
        ) : (
          <Table
            rowKey="id"
            loading={loading}
            dataSource={filteredBooks}
            size="middle"
            rowSelection={{ selectedRowKeys: selectedRowKeys, onChange: function (keys) { setSelectedRowKeys(keys); } }}
            pagination={{ pageSize: 15, showSizeChanger: false, showTotal: function (t) { return '共 ' + t + ' 个错题本'; } }}
            columns={[
              {
                title: '错题出处',
                dataIndex: 'title',
                ellipsis: true,
                width: 220,
                render: function (t, r) {
                  return (
                    <Space direction="vertical" size={0}>
                      <Text strong>{(t || '未命名错题本').substring(0, 35)}</Text>
                      <Space size={4} style={{ marginTop: 2 }}>
                        {r.exam_paper_id ? (
                          <Tag color="blue" style={{ fontSize: 11 }}>试卷</Tag>
                        ) : (
                          <Tag color="orange" style={{ fontSize: 11 }}>作业/手动</Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>{(r.generated_at || '').substring(0, 16)}</Text>
                      </Space>
                    </Space>
                  );
                }
              },
              { title: '错题数', dataIndex: 'question_count', width: 70, align: 'center' },
              { title: '学科', dataIndex: 'subject', width: 60, render: function (v) { return v || '数学'; } },
              {
                title: '状态',
                dataIndex: 'status',
                width: 80,
                render: function (s: string) {
                  const map: Record<string, { color: string; label: string }> = { DRAFT: { color: 'default', label: '生成中' }, GENERATED: { color: 'green', label: '已完成' }, EXPORTED: { color: 'blue', label: '已导出' } };
                  return <Tag color={(map[s] || {}).color}>{(map[s] || {}).label || s}</Tag>;
                }
              },
              {
                title: '操作',
                width: 290,
                render: function (_, r) {
                  return (
                    <Space size={2}>
                      <Button type="link" size="small" icon={<EyeOutlined />} onClick={function () { handlePreview(r); }}>预览</Button>
                      {r.exam_paper_id ? (
                        <Button type="link" size="small" icon={<SearchOutlined />} style={{ color: '#722ed1' }} onClick={function () { handleReview(r); }}>试卷复盘</Button>
                      ) : null}
                      <Button type="link" size="small" icon={<ThunderboltOutlined />} loading={practiceLoading[r.id]} onClick={function () { generatePractice(r.id); }}>加强练习</Button>
                      <Button type="link" size="small" icon={<PrinterOutlined />} onClick={function () { handlePrintSingle(r); }}>打印</Button>
                      <Button type="link" size="small" icon={<CameraOutlined />} onClick={function () { setScanOpen(true); }}>拍照扫描</Button>
                      <Popconfirm title="确定删除此错题本？" description="删除后不可恢复" onConfirm={function () { handleDelete(r.id); }} okButtonProps={{ danger: true }}>
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    </Space>
                  );
                }
              },
            ]}
          />
        )}
      </Card>

      {/* Preview Modal */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            {'错题预览 — ' + (previewBook ? (previewBook.title || '').substring(0, 30) : '')}
          </Space>
        }
        open={previewOpen}
        onCancel={function () { setPreviewOpen(false); setPreviewBook(null); }}
        width={700}
        footer={<Button onClick={function () { setPreviewOpen(false); }}>关闭</Button>}
      >
        {previewBook ? (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="名称">{previewBook.title || '未命名'}</Descriptions.Item>
              <Descriptions.Item label="错题数">{previewBook.question_count || 0}</Descriptions.Item>
              <Descriptions.Item label="来源">{previewBook.exam_paper_id ? '试卷' : '手动录入'}</Descriptions.Item>
              <Descriptions.Item label="状态">{previewBook.status === 'EXPORTED' ? '已导出' : previewBook.status === 'GENERATED' ? '已完成' : '生成中'}</Descriptions.Item>
              <Descriptions.Item label="生成时间" span={2}>{(previewBook.generated_at || '').substring(0, 16) || '-'}</Descriptions.Item>
            </Descriptions>
            {previewBook.questions && previewBook.questions.length > 0 ? (
              <div>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>错题列表（共{previewBook.questions.length}题）</Text>
                {previewBook.questions.map(function (q: AnyObj, i: number) {
                  return (
                    <Card key={i} size="small" style={{ marginBottom: 8 }} type="inner"
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text strong>{(i+1) + '. ' + (q.question_title || q.title || '题目').substring(0, 60)}</Text>
                          {q.question_id && (
                            <Tooltip title="查看讲解">
                              <Button
                                type="link"
                                size="small"
                                icon={<PlayCircleOutlined style={{ color: '#667eea' }} />}
                                onClick={function () { setDrawerQuestionId(q.question_id); setDrawerOpen(true); }}
                              >讲解</Button>
                            </Tooltip>
                          )}
                        </div>
                      }
                    >
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="你的答案">
                          <Text type="danger">{q.student_answer || '未作答'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="正确答案">
                          <Text type="success">{q.correct_answer || '-'}</Text>
                        </Descriptions.Item>
                        {q.practice_question ? (
                          <Descriptions.Item label="加强训练">
                            <Text type="secondary">{q.practice_question.substring(0, 200)}</Text>
                          </Descriptions.Item>
                        ) : null}
                      </Descriptions>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Empty description="暂无详细错题数据，请点击&quot;加强练习&quot;按钮生成" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        ) : null}
      </Modal>

      {/* Paper Review Modal */}
      <Modal
        title={reviewData ? '试卷复盘 — ' + (reviewData.paper.title || '').substring(0, 30) : '试卷复盘'}
        open={reviewOpen}
        onCancel={function () { setReviewOpen(false); setReviewData(null); }}
        width={900}
        footer={<Button onClick={function () { setReviewOpen(false); }}>关闭</Button>}
      >
        {reviewLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : reviewData ? (
          <div>
            {/* Score summary */}
            <Row gutter={16} style={{ marginBottom: 20 }} align="middle">
              <Col>
                <Progress
                  type="circle"
                  size={80}
                  percent={reviewData.submission ? (reviewData.submission.percentage || 0) : 0}
                  format={function () { return (reviewData.submission ? reviewData.submission.total_score || 0 : 0) + '分'; }}
                />
              </Col>
              <Col flex={1}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="试卷">{reviewData.paper.title}</Descriptions.Item>
                  <Descriptions.Item label="学科">{reviewData.paper.subject}</Descriptions.Item>
                  <Descriptions.Item label="满分">{reviewData.paper.total_score}</Descriptions.Item>
                  <Descriptions.Item label="得分">{reviewData.submission ? reviewData.submission.total_score : '-'}</Descriptions.Item>
                  <Descriptions.Item label="状态">{reviewData.submission ? reviewData.submission.status : '未提交'}</Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>

            {/* Questions review */}
            <Text strong style={{ marginBottom: 8, display: 'block' }}>试题回顾（共{reviewData.questions.length}题）</Text>
            {reviewData.questions.map(function (q: AnyObj, i: number) {
              const isCorrect = q.is_correct;
              const bgColor = isCorrect === true ? '#f6ffed' : isCorrect === false ? '#fff2f0' : '#fafafa';
              const borderColor = isCorrect === true ? '#b7eb8f' : isCorrect === false ? '#ffccc7' : '#d9d9d9';
              return (
                <Card key={i} size="small" style={{ marginBottom: 8, background: bgColor, borderColor: borderColor }}
                  title={
                    <Space>
                      <Tag color="default">{q.question.question_type}</Tag>
                      <Text>{(i+1) + '. ' + (q.question.title || '').substring(0, 80) + '（' + q.question.score + '分）'}</Text>
                    </Space>
                  }
                >
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="正确答案">
                      <Text type="success">{q.question.correct_answer || '-'}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="你的答案">
                      <Text type={isCorrect ? 'success' : 'danger'}>{q.student_answer || '未作答'}</Text>
                    </Descriptions.Item>
                    {q.feedback ? (
                      <Descriptions.Item label="评语" span={2}>{q.feedback}</Descriptions.Item>
                    ) : null}
                  </Descriptions>
                </Card>
              );
            })}
          </div>
        ) : null}
      </Modal>

      {/* Photo scan modal */}
      <Modal title="拍照/扫描录入答案" open={scanOpen} width={750} footer={null} onCancel={function () { setScanOpen(false); }}>
        <PhotoScanTab />
      </Modal>

      {/* Quick entry modal */}
      <Modal
        title={
          <Space>
            <ScanOutlined />
            快速录入错题
          </Space>
        }
        open={quickEntryOpen}
        onCancel={function () { setQuickEntryOpen(false); }}
        footer={
          <Space>
            <Button icon={<CameraOutlined />} onClick={handleScanEntry}>拍照录入</Button>
            <Button type="primary" loading={entrySaving} onClick={function () { quickEntryForm.submit(); }}>保存错题</Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Upload accept="image/*" showUploadList={false} beforeUpload={function () { message.info('拍照功能将在下一版本开放'); return false; }}>
            <Button icon={<CameraOutlined />} block style={{ marginBottom: 12 }}>拍照/扫描识别题目（即将开放）</Button>
          </Upload>
        </div>
        <Divider plain>
          <Text type="secondary">或手动输入</Text>
        </Divider>
        <Form form={quickEntryForm} layout="vertical" onFinish={handleQuickEntry}>
          <Form.Item name="question_title" label="题目内容" rules={[{ required: true, message: '请输入题目内容' }]}>
            <Input.TextArea rows={3} placeholder="请输入错题内容（可从拍照识别结果粘贴）" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="subject" label="学科" initialValue="数学">
                <Select options={subjectOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="question_type" label="题型" initialValue="FILL_BLANK">
                <Select options={toSelectOptions(qtypes)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="error_type" label="错误类型" initialValue="CONCEPT">
                <Select options={toSelectOptions(errorTypes)} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="student_answer" label="错误答案">
                <Input placeholder="学生填写的错误答案" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="correct_answer" label="正确答案">
                <Input placeholder="题目正确答案" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <ExplanationDrawer
        open={drawerOpen}
        onClose={function () { setDrawerOpen(false); setDrawerQuestionId(null); }}
        questionId={drawerQuestionId}
      />
    </div>
  );
}
