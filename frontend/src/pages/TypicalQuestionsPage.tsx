import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Typography, Space, Tag, Select, Tabs, Tooltip } from 'antd';
import { ReloadOutlined, BulbOutlined, PlayCircleOutlined } from '@ant-design/icons';
import apiClient from '../api/client';
import { useReferenceValues, toLabelMap, toSelectOptions } from '../hooks/useReferenceValues';
import ExplanationDrawer from '../components/topic-board/ExplanationDrawer';

const { Title, Text } = Typography;

interface QuestionItem {
  id: string;
  title: string;
  question_type: string;
  difficulty: string;
  correct_answer: string;
  explanation?: string;
  has_explanation?: boolean;
  subject?: string;
  score?: number;
}

export default function TypicalQuestionsPage() {
  const [activeTab, setActiveTab] = useState('typical');
  // Typical questions state
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string | undefined>();
  const [filterGrade, setFilterGrade] = useState<string | undefined>();
  // Recommended questions state
  const [recommendations, setRecommendations] = useState<QuestionItem[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerQuestionId, setDrawerQuestionId] = useState<string | null>(null);

  const refs = useReferenceValues();
  const qtypes = refs['question-types'];
  const diffs = refs['difficulty-levels'];
  const grades = refs['grade-levels'];
  const subjects = refs['subjects'];
  const typeMap = useMemo(() => toLabelMap(qtypes), [qtypes]);
  const diffMap = useMemo(() => toLabelMap(diffs), [diffs]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterSubject) params.subject = filterSubject;
      if (filterGrade) params.grade = filterGrade;
      const resp = await apiClient.get('/questions/typical', { params });
      setQuestions(Array.isArray(resp.data) ? resp.data : []);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [filterSubject, filterGrade]);

  const loadRecommendations = useCallback(async () => {
    setRecLoading(true);
    try {
      const resp = await apiClient.get('/recommendations/my');
      setRecommendations(Array.isArray(resp.data) ? resp.data : []);
    } catch {
      setRecommendations([]);
    } finally {
      setRecLoading(false);
    }
  }, []);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);
  useEffect(() => {
    if (activeTab === 'recommended') loadRecommendations();
  }, [activeTab, loadRecommendations]);

  function parseAnswer(v: string | unknown) {
    if (!v) return null;
    try {
      const p = typeof v === 'string' ? JSON.parse(v) : v;
      if ((p as { correct_answer?: unknown }).correct_answer === undefined) return null;
      const a = (p as { correct_answer: unknown }).correct_answer;
      if (Array.isArray(a)) return a.join(', ');
      if (typeof a === 'object' && a !== null) {
        return (a as { keywords?: string[] }).keywords ? (a as { keywords: string[] }).keywords.join(', ') : null;
      }
      return String(a);
    } catch {
      return null;
    }
  }

  const openDrawer = (questionId: string) => {
    setDrawerQuestionId(questionId);
    setDrawerOpen(true);
  };

  const sharedColumns = [
    { title: '题目', dataIndex: 'title', ellipsis: true, width: 220 },
    {
      title: '题型',
      dataIndex: 'question_type',
      width: 70,
      render: (t: string) => <Tag>{typeMap[t] || t}</Tag>,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 60,
      render: (t: string) => (
        <Tag color={t === 'EASY' ? 'green' : t === 'MEDIUM' ? 'gold' : 'red'}>
          {diffMap[t] || t}
        </Tag>
      ),
    },
    {
      title: '正确答案',
      dataIndex: 'correct_answer',
      width: 80,
      render: (v: string) => {
        const a = parseAnswer(v);
        return a ? <Tag color="green">{a}</Tag> : <Text type="secondary">-</Text>;
      },
    },
    { title: '解题思路', dataIndex: 'explanation', ellipsis: true, width: 180, render: (v: string) => v || '-' },
    {
      title: '讲解',
      dataIndex: 'has_explanation',
      width: 60,
      align: 'center' as const,
      render: (v: boolean, record: QuestionItem) => v ? (
        <Tooltip title="查看讲解">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined style={{ color: '#667eea', fontSize: 18 }} />}
            onClick={() => openDrawer(record.id)}
          />
        </Tooltip>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          <BulbOutlined style={{ marginRight: 8 }} />
          试题讲解
        </Title>
        <Space>
          <Select
            placeholder="学科"
            value={filterSubject}
            onChange={setFilterSubject}
            allowClear
            style={{ width: 100 }}
            size="small"
            options={toSelectOptions(subjects)}
          />
          <Select
            placeholder="年级"
            value={filterGrade}
            onChange={setFilterGrade}
            allowClear
            style={{ width: 100 }}
            size="small"
            options={toSelectOptions(grades)}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={activeTab === 'typical' ? loadQuestions : loadRecommendations}>刷新</Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'typical',
            label: '重点题',
            children: (
              <Table
                rowKey="id"
                loading={loading}
                dataSource={questions}
                size="middle"
                pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `共 ${t} 题` }}
                columns={sharedColumns}
                expandable={{
                  expandedRowRender: (r: QuestionItem) => (
                    <div style={{ padding: '8px 16px' }}>
                      <Text strong>解题思路：</Text>
                      <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.explanation || '暂无'}</div>
                    </div>
                  ),
                  rowExpandable: (r: QuestionItem) => !!r.explanation,
                }}
              />
            ),
          },
          {
            key: 'recommended',
            label: `推荐题${recommendations.length > 0 ? ` (${recommendations.length})` : ''}`,
            children: (
              <Table
                rowKey="id"
                loading={recLoading}
                dataSource={recommendations}
                size="middle"
                pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `共 ${t} 题` }}
                columns={sharedColumns}
                expandable={{
                  expandedRowRender: (r: QuestionItem) => (
                    <div style={{ padding: '8px 16px' }}>
                      <Text strong>解题思路：</Text>
                      <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.explanation || '暂无'}</div>
                    </div>
                  ),
                  rowExpandable: (r: QuestionItem) => !!r.explanation,
                }}
              />
            ),
          },
        ]}
      />

      <ExplanationDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDrawerQuestionId(null); }}
        questionId={drawerQuestionId}
      />
    </div>
  );
}
