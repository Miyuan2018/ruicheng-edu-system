import { useState, useEffect } from 'react';
import { Table, Card, Typography, Select, Tag, Progress, Space, Button } from 'antd';
import { QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toColorMap, toSelectOptions } from '../../hooks/useReferenceValues';

const { Title } = Typography;

interface ChoiceDist {
  options: { label: string }[];
  distribution: Record<string, number>;
  total_responses: number;
}

interface StatItem {
  question_id: string;
  title?: string;
  difficulty?: string;
  question_type?: string;
  attempted: number;
  correct_count: number;
  correct_rate: number;
  choice_distribution?: ChoiceDist;
}

function ChoiceDistribution({ dist }: { dist?: ChoiceDist }) {
  if (!dist) return null;
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  return (
    <div style={{ marginTop: 4 }}>
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>选项分布: </Typography.Text>
      {dist.options.map((opt, i) => {
        const count = dist.distribution[opt.label] || 0;
        const pct = dist.total_responses > 0 ? Math.round(count / dist.total_responses * 100) : 0;
        return (
          <span key={opt.label} style={{ marginRight: 6, fontSize: 11 }}>
            <Tag color={colors[i % colors.length]} style={{ margin: 0 }}>
              {opt.label}: {count}({pct}%)
            </Tag>
          </span>
        );
      })}
    </div>
  );
}

export default function QuestionStatsPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState('');
  const refs = useReferenceValues();
  const qtypes = refs['question-types'];
  const diffs = refs['difficulty-levels'];
  const subjects = refs['subjects'];

  function loadStats() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filterSubject) params.subject = filterSubject;
    if (filterType) params.question_type = filterType;
    apiClient.get('/teacher/stats/questions', { params }).then((r) => {
      setStats(r.data.questions || []);
    }).catch(() => { setStats([]); })
    .finally(() => { setLoading(false); });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats(); }, [filterSubject, filterType]);

  const columns = [
    {
      title: '题目',
      dataIndex: 'title',
      ellipsis: true,
      width: 300,
      render: (t: string, r: StatItem) => (
        <Space>
          <Tag color={toColorMap(diffs)[r.difficulty || '']?.color}>{toLabelMap(diffs)[r.difficulty || ''] || r.difficulty}</Tag>
          <Tag>{toLabelMap(qtypes)[r.question_type || ''] || r.question_type}</Tag>
          <Typography.Text>{(t || '').substring(0, 50)}</Typography.Text>
        </Space>
      ),
    },
    { title: '作答次数', dataIndex: 'attempted', width: 80, align: 'center' as const },
    {
      title: '正确率',
      dataIndex: 'correct_rate',
      width: 200,
      render: (v: number, r: StatItem) => (
        <Progress
          percent={v}
          size="small"
          format={() => v + '% (' + r.correct_count + '/' + r.attempted + ')'}
          strokeColor={v >= 80 ? '#52c41a' : v >= 60 ? '#faad14' : '#f5222d'}
        />
      ),
    },
    {
      title: '选项分布',
      render: (_: unknown, r: StatItem) => <ChoiceDistribution dist={r.choice_distribution} />,
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <QuestionCircleOutlined style={{ marginRight: 8 }} />
        试题答题统计
      </Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Typography.Text strong>筛选: </Typography.Text>
          <Select
            placeholder="学科"
            value={filterSubject || undefined}
            onChange={setFilterSubject}
            allowClear
            style={{ width: 100 }}
            size="small"
            options={toSelectOptions(subjects)}
          />
          <Select
            placeholder="题型"
            value={filterType || undefined}
            onChange={setFilterType}
            allowClear
            style={{ width: 110 }}
            size="small"
            options={toSelectOptions(qtypes)}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={loadStats}>刷新</Button>
        </div>
      </Card>
      <Table
        rowKey="question_id"
        dataSource={stats}
        columns={columns}
        loading={loading}
        size="middle"
        scroll={{ x: 900 }}
      />
    </div>
  );
}
