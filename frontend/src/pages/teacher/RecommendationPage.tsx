import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Space, Tag, Input, Select, message, Typography, Popconfirm, Empty } from 'antd';
import { StarOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

const { Title } = Typography;

interface RecommendationItem {
  id: string;
  question_id: string;
  question_title: string;
  question_type: string;
  subject: string;
  student_id: string;
  student_name: string;
  created_at: string;
}

export default function RecommendationPage() {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (subject) params.subject = subject;
      if (keyword) params.keyword = keyword;
      const resp = await apiClient.get('/recommendations/teacher', { params });
      setItems(Array.isArray(resp.data) ? resp.data : []);
    } catch {
      message.error('加载推荐记录失败');
    } finally {
      setLoading(false);
    }
  }, [subject, keyword]);

  useEffect(() => { fetchRecommendations(); }, [fetchRecommendations]);

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete('/recommendations/' + id);
      message.success('已取消推荐');
      fetchRecommendations();
    } catch {
      message.error('删除失败');
    }
  };

  const qtypeMap: Record<string, string> = {
    SINGLE_CHOICE: '单选题',
    MULTIPLE_CHOICE: '多选题',
    FILL_BLANK: '填空题',
    SUBJECTIVE: '解答题',
  };

  const columns = [
    {
      title: '试题',
      dataIndex: 'question_title',
      ellipsis: true,
      render: (t: string, r: RecommendationItem) => (
        <Space>
          <Tag>{qtypeMap[r.question_type] || r.question_type}</Tag>
          <span>{t}</span>
        </Space>
      ),
    },
    { title: '学科', dataIndex: 'subject', width: 80 },
    { title: '推荐学生', dataIndex: 'student_name', width: 100 },
    {
      title: '推荐时间',
      dataIndex: 'created_at',
      width: 140,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, r: RecommendationItem) => (
        <Popconfirm title="确定取消推荐？" onConfirm={() => handleDelete(r.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>取消</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <StarOutlined style={{ marginRight: 8 }} />
          推荐管理
        </Title>
        <Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchRecommendations}>刷新</Button>
        </Space>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input
          placeholder="搜索试题标题"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={fetchRecommendations}
          allowClear
          style={{ width: 200 }}
          size="small"
        />
        <Select
          placeholder="学科"
          allowClear
          style={{ width: 100 }}
          size="small"
          value={subject}
          onChange={(v) => setSubject(v)}
          options={[
            { value: '数学', label: '数学' },
            { value: '语文', label: '语文' },
            { value: '英语', label: '英语' },
            { value: '物理', label: '物理' },
            { value: '化学', label: '化学' },
          ]}
        />
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条推荐` }}
        locale={{ emptyText: <Empty description="暂无推荐记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </div>
  );
}
