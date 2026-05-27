import { useState, useEffect } from 'react';
import { Card, Button, Select, Table, Tag, message, Typography, Space, Empty, Row, Col } from 'antd';
import { DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { getUserId } from '../../store/auth';

const { Text } = Typography;

interface PaperItem {
  id: string;
  title: string;
  subject: string;
}

interface NotebookItem {
  id: string;
  title: string;
  question_count: number;
  status: string;
  generated_at: string;
}

export default function GenerateMistakeBookTab() {
  const userId = getUserId();
  const [papers] = useState<PaperItem[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.get('/exam-papers', { params: { status: 'PUBLISHED', limit: 100 } }).catch(() => ({ data: [] })),
      loadNotebooks(),
    ]).finally(() => { setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadNotebooks() {
    return apiClient.get('/error-notebooks/student/' + userId).then((resp) => {
      const data = resp.data || [];
      setNotebooks(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const params: Record<string, string> = {};
      if (selectedPaper) params.exam_paper_id = selectedPaper;
      await apiClient.post('/error-notebooks/generate', null, { params });
      message.success('错题本生成成功');
      setTimeout(() => { loadNotebooks(); }, 1000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      const detail = err?.response?.data?.detail || JSON.stringify(err?.response?.data) || '生成失败';
      message.error(detail);
    }
    setGenerating(false);
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete('/error-notebooks/' + id);
      message.success('已删除');
      loadNotebooks();
    } catch {
      message.error('删除失败');
    }
  }

  return (
    <div>
      <Card title="生成纸质错题练习本" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Text strong>选择试卷:</Text>
          </Col>
          <Col flex={1}>
            <Select
              placeholder="全部试卷（不选则基于所有错题）"
              value={selectedPaper}
              onChange={setSelectedPaper}
              allowClear
              style={{ width: '100%', maxWidth: 400 }}
              options={papers.map((p) => ({
                value: p.id,
                label: p.title + ' (' + (p.subject || '') + ')',
              }))}
            />
          </Col>
          <Col>
            <Button type="primary" icon={<PrinterOutlined />} onClick={handleGenerate} loading={generating}>
              生成纸质错题练习本
            </Button>
          </Col>
        </Row>
      </Card>
      <Card title={`已生成的错题本（${notebooks.length}）`} size="small">
        {notebooks.length > 0 ? (
          <Table
            rowKey="id"
            size="small"
            dataSource={notebooks}
            loading={loading}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: '名称', dataIndex: 'title', ellipsis: true },
              { title: '题数', dataIndex: 'question_count', width: 60, align: 'center' },
              {
                title: '状态',
                dataIndex: 'status',
                width: 80,
                render: (s: string) => {
                  const color = s === 'GENERATED' ? 'green' : s === 'DRAFT' ? 'default' : 'blue';
                  const label = s === 'GENERATED' ? '已完成' : s === 'DRAFT' ? '生成中' : '已导出';
                  return <Tag color={color}>{label}</Tag>;
                },
              },
              {
                title: '时间',
                dataIndex: 'generated_at',
                width: 140,
                render: (v: string) => (v ? v.substring(0, 16) : '-'),
              },
              {
                title: '操作',
                width: 100,
                render: (_: unknown, r: NotebookItem) => (
                  <Space>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>
                      删除
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        ) : (
          <Empty description="暂无错题本，请先提交试卷作答或点击生成错题本" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </div>
  );
}
