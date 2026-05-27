import { useState, useEffect } from 'react';
import { Table, Card, Typography, Select, Tag, Statistic, Row, Col, Spin, Empty, Progress, Space, Button } from 'antd';
import { FileTextOutlined, QuestionCircleOutlined, UserOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toColorMap } from '../../hooks/useReferenceValues';

const Title = Typography.Title;
const Text = Typography.Text;


function ChoiceDistribution(props: { distribution?: any }) {
  const dist = props.distribution;
  if (!dist) return null;
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  return (
    <div style={{ marginTop: 4 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>选项分布: </Text>
      {dist.options.map(function (opt: any, i: any) {
        const count = dist.distribution[opt.label] || 0;
        const pct = dist.total_responses > 0 ? Math.round(count / dist.total_responses * 100) : 0;
        return (
          <span key={opt.label} style={{ marginRight: 6, fontSize: 11 }}>
            <Tag color={colors[i % colors.length]} style={{ margin: 0 }}>
              {opt.label + ': ' + count + '(' + pct + '%)'}
            </Tag>
          </span>
        );
      })}
    </div>
  );
}

export default function PaperStatsPage() {
  const papersState = useState<any[]>([]); const papers = papersState[0]; const setPapers = papersState[1];
  const selectedPaperState = useState<any>(null); const selectedPaper = selectedPaperState[0]; const setSelectedPaper = selectedPaperState[1];
  const loadingState = useState(false); const loading = loadingState[0]; const setLoading = loadingState[1];
  const statsState = useState<any>(null); const stats = statsState[0]; const setStats = statsState[1];
  const refs = useReferenceValues();
  const qtypes = refs['question-types'];
  const diffs = refs['difficulty-levels'];

  useEffect(function () {
    apiClient.get('/teacher/stats/papers').then(function (r) { setPapers(r.data || []); }).catch(function () {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadStats(paperId: any) {
    setLoading(true);
    apiClient.get('/teacher/stats/paper/' + paperId).then(function (r) {
      setStats(r.data);
    }).catch(function () { setStats(null); })
    .finally(function () { setLoading(false); });
  }

  function handleSelect(paperId: any) {
    setSelectedPaper(paperId);
    if (paperId) loadStats(paperId);
  }

  const columns = [
    { title: '#', dataIndex: 'position', width: 40 },
    { title: '题目', dataIndex: 'title', ellipsis: true, render: function (t: any, r: any) {
      return (
        <Space>
          <Tag color={toColorMap(diffs)[r.difficulty]?.color}>{toLabelMap(diffs)[r.difficulty] || r.difficulty}</Tag>
          <Tag>{toLabelMap(qtypes)[r.question_type] || r.question_type}</Tag>
          <Text>{(t || '').substring(0, 50)}</Text>
        </Space>
      );
    }},
    { title: '分值', dataIndex: 'score', width: 50, align: 'center' as const },
    { title: '作答', dataIndex: 'attempted', width: 70, align: 'center' as const,
      render: function (v: any, r: any) { return v + '/' + r.total_students; }
    },
    { title: '正确率', dataIndex: 'correct_rate', width: 200,
      render: function (v: any, r: any) {
        return (
          <Progress
            percent={v}
            size="small"
            format={function () { return v + '% (' + r.correct_count + '/' + r.attempted + ')'; }}
            strokeColor={v >= 80 ? '#52c41a' : v >= 60 ? '#faad14' : '#f5222d'}
          />
        );
      }
    },
    { title: '选项分布', render: function (_: any, r: any) {
      return <ChoiceDistribution distribution={r.choice_distribution} />;
    }},
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        试卷答题统计
      </Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Text strong>选择试卷: </Text>
          <Select
            placeholder="请选择一份试卷查看每题统计"
            value={selectedPaper}
            onChange={handleSelect}
            style={{ width: 400 }}
            showSearch
            allowClear
            size="small"
            filterOption={function (input: any, option: any) { return (option?.label || '').indexOf(input) >= 0; }}
            options={papers.map(function (p) { return { value: p.id, label: p.title + ' (' + (p.subject || '') + ' ' + (p.grade_level || '') + ')' }; })}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={function () { if (selectedPaper) loadStats(selectedPaper); }}>刷新</Button>
        </div>
      </Card>
      {loading ? (
        <Spin style={{ display: 'block', textAlign: 'center', padding: 40 }} />
      ) : stats ? (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic title="参与学生" value={stats.total_students || 0} prefix={<UserOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="试题数" value={(stats.questions || []).length} prefix={<QuestionCircleOutlined />} />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic title="试卷" value={stats.paper ? stats.paper.title : ''} valueStyle={{ fontSize: 15 }} />
              </Card>
            </Col>
          </Row>
          {(stats.questions || []).length > 0
            ? (
              <Table
                rowKey="question_id"
                dataSource={stats.questions}
                columns={columns}
                pagination={false}
                size="middle"
                scroll={{ x: 900 }}
              />
            )
            : <Empty description="该试卷暂无答题记录" />
          }
        </div>
      ) : (
        <Empty description="请选择试卷查看统计" />
      )}
    </div>
  );
}
