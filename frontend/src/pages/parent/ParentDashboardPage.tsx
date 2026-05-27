import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Tag,
  List,
  Typography,
  Space,
  Empty,
  Spin,
  Button,
  Progress,
  Input,
  Form,
  message,
  Modal,
} from 'antd';
import {
  HeartOutlined,
  TrophyOutlined,
  StarOutlined,
  SmileOutlined,
  ThunderboltOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useParentStore from '../../store/useParentStore';

const { Text } = Typography;

type AnyObj = Record<string, any>;

const ParentDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const {
    linkedStudents,
    positiveStats,
    rewardGoals,
    fetchLinkedStudents,
    fetchPositiveStats,
    fetchRewardGoals,
    linkStudent,
  } = useParentStore();

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkForm] = Form.useForm();

  const handleLinkStudent = async () => {
    try {
      const values = await linkForm.validateFields();
      setLinkLoading(true);
      await linkStudent(values.invite_code, values.relationship || '其他');
      message.success('关联成功！');
      setLinkModalOpen(false);
      linkForm.resetFields();
    } catch (err: any) {
      if (err?.message) message.error(err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  // Fetch linked students on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await fetchLinkedStudents();
      } catch (err) {
        console.error('获取关联学生失败:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchLinkedStudents]);

  // Auto-select first student when linkedStudents loads
  useEffect(() => {
    if (linkedStudents && linkedStudents.length > 0 && !selectedStudentId) {
      const firstStudent = linkedStudents[0];
      const studentId = firstStudent.student_id || firstStudent.id;
      setSelectedStudentId(studentId);
    }
  }, [linkedStudents, selectedStudentId]);

  // Fetch stats when selected student changes
  useEffect(() => {
    if (selectedStudentId) {
      fetchPositiveStats(selectedStudentId);
      fetchRewardGoals(selectedStudentId, 'ACTIVE');
    }
  }, [selectedStudentId, fetchPositiveStats, fetchRewardGoals]);

  const handleStudentChange = (value: string) => {
    setSelectedStudentId(value);
  };

  const getSelectedStudentName = (): string => {
    if (!linkedStudents || !selectedStudentId) return '';
    const student = linkedStudents.find(
      (s: AnyObj) => (s.student_id || s.id) === selectedStudentId
    );
    return student?.student_name || student?.name || '';
  };

  const getAccuracyColor = (value: number): string => {
    if (value >= 80) return 'green';
    if (value >= 60) return 'orange';
    return 'red';
  };

  const accuracyTrend: number[] = positiveStats?.accuracy_trend?.slice(-5) || [];
  const activeGoals: AnyObj[] = rewardGoals || [];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!linkedStudents || linkedStudents.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Empty
          description="尚未关联学生"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
        <Button type="primary" icon={<LinkOutlined />} size="large" onClick={() => setLinkModalOpen(true)} style={{ marginTop: 16 }}>
          输入邀请码关联学生
        </Button>
        <Modal title="关联学生" open={linkModalOpen} onCancel={() => setLinkModalOpen(false)}
          onOk={handleLinkStudent} confirmLoading={linkLoading} okText="关联">
          <Form form={linkForm} layout="vertical" initialValues={{ relationship: '其他' }}>
            <Form.Item name="invite_code" label="邀请码" rules={[{ required: true, message: '请输入6位邀请码' }, { len: 6, message: '邀请码为6位' }]}>
              <Input placeholder="请输入学生提供的6位邀请码" maxLength={6} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
            <Form.Item name="relationship" label="与学生的关系">
              <Select options={[
                { value: '父亲', label: '父亲' }, { value: '母亲', label: '母亲' },
                { value: '监护人', label: '监护人' }, { value: '其他', label: '其他' },
              ]} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Top section: Student selector */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large" align="center">
          <Text strong style={{ fontSize: 16 }}>选择学生：</Text>
          <Select
            value={selectedStudentId}
            onChange={handleStudentChange}
            style={{ minWidth: 200 }}
            placeholder="请选择学生"
            options={linkedStudents.map((s: AnyObj) => ({
              label: s.student_name || s.name,
              value: s.student_id || s.id,
            }))}
          />
          {selectedStudentId && (
            <Text style={{ fontSize: 18, color: '#1677ff' }}>
              当前查看：{getSelectedStudentName()}
            </Text>
          )}
          <Button icon={<LinkOutlined />} size="small" onClick={() => setLinkModalOpen(true)}>关联更多学生</Button>
        </Space>
      </Card>

      {/* Stats cards row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="完成试卷"
              value={positiveStats?.completed_papers ?? 0}
              prefix={<TrophyOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="消灭错题"
              value={positiveStats?.errors_cleared ?? 0}
              prefix={<ThunderboltOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="庆祝时刻"
              value={positiveStats?.celebration_count ?? 0}
              prefix={<StarOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待读鼓励"
              value={positiveStats?.unread_encouragements ?? 0}
              prefix={<HeartOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Accuracy trend */}
      <Card title="正确率趋势（近5次）" style={{ marginBottom: 24 }}>
        {accuracyTrend.length > 0 ? (
          <Space size="middle" wrap>
            {accuracyTrend.map((value: number, index: number) => (
              <Tag
                key={index}
                color={getAccuracyColor(value)}
                style={{ fontSize: 14, padding: '4px 12px' }}
              >
                {value}%
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">暂无数据</Text>
        )}
      </Card>

      {/* Active reward goals */}
      <Card title="进行中的奖励目标" style={{ marginBottom: 24 }}>
        {activeGoals.length > 0 ? (
          <List
            dataSource={activeGoals}
            renderItem={(goal: AnyObj) => {
              const current = goal.current_value ?? 0;
              const target = goal.target_value ?? 1;
              const percent = Math.min(Math.round((current / target) * 100), 100);
              return (
                <List.Item>
                  <List.Item.Meta
                    avatar={<SmileOutlined style={{ fontSize: 24, color: '#1677ff' }} />}
                    title={goal.goal_name || goal.name || '奖励目标'}
                    description={goal.description || ''}
                  />
                  <div style={{ flex: 1, marginLeft: 24, maxWidth: 300 }}>
                    <Progress
                      percent={percent}
                      format={() => `${current} / ${target}`}
                      status={percent >= 100 ? 'success' : 'active'}
                    />
                  </div>
                </List.Item>
              );
            }}
          />
        ) : (
          <Empty description="暂无进行中的奖励目标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {/* Quick actions */}
      <Card title="快捷操作">
        <Space size="middle">
          <Button
            type="primary"
            icon={<HeartOutlined />}
            size="large"
            onClick={() => navigate('/parent/encourage')}
          >
            发送鼓励
          </Button>
          <Button
            icon={<StarOutlined />}
            size="large"
            onClick={() => navigate('/parent/reward-goals')}
          >
            奖励目标
          </Button>
        </Space>
      </Card>

      {/* Link student modal */}
      <Modal title="关联学生" open={linkModalOpen} onCancel={() => setLinkModalOpen(false)}
        onOk={handleLinkStudent} confirmLoading={linkLoading} okText="关联">
        <Form form={linkForm} layout="vertical" initialValues={{ relationship: '其他' }}>
          <Form.Item name="invite_code" label="邀请码" rules={[{ required: true, message: '请输入6位邀请码' }, { len: 6, message: '邀请码为6位' }]}>
            <Input placeholder="请输入学生提供的6位邀请码" maxLength={6} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="relationship" label="与学生的关系">
            <Select options={[
              { value: '父亲', label: '父亲' }, { value: '母亲', label: '母亲' },
              { value: '监护人', label: '监护人' }, { value: '其他', label: '其他' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ParentDashboardPage;
