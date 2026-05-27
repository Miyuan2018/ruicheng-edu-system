import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Tag,
  List,
  Typography,
  message,
  Space,
  Progress,
  Modal,
  Empty,
} from 'antd';
import {
  TrophyOutlined,
  PlusOutlined,
  CheckOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import useParentStore from '../../store/useParentStore';

const { Text } = Typography;
const { TextArea } = Input;

type AnyObj = Record<string, any>;

const METRIC_TYPE_MAP: Record<string, { label: string; color: string }> = {
  PAPERS_COMPLETED: { label: '完成试卷', color: 'blue' },
  PRACTICE_SESSIONS: { label: '练习次数', color: 'cyan' },
  STREAK_DAYS: { label: '连续天数', color: 'orange' },
  ERRORS_CLEARED: { label: '消灭错题', color: 'green' },
  ACCURACY_IMPROVEMENT: { label: '正确率提升', color: 'purple' },
};

const METRIC_TYPE_OPTIONS = Object.entries(METRIC_TYPE_MAP).map(([value, { label }]) => ({
  label,
  value,
}));

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '进行中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
  CLAIMED: { label: '已领取', color: 'default' },
  CANCELLED: { label: '已取消', color: 'default' },
  EXPIRED: { label: '已过期', color: 'warning' },
};

const ParentRewardGoalsPage: React.FC = () => {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const {
    linkedStudents,
    rewardGoals,
    fetchLinkedStudents,
    selectStudent,
    fetchRewardGoals,
    createRewardGoal,
    claimReward,
  } = useParentStore();

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
      selectStudent(studentId);
    }
  }, [linkedStudents, selectedStudentId, selectStudent]);

  // Fetch reward goals when selected student changes
  useEffect(() => {
    if (selectedStudentId) {
      fetchRewardGoals(selectedStudentId);
    }
  }, [selectedStudentId, fetchRewardGoals]);

  const handleStudentChange = (value: string) => {
    setSelectedStudentId(value);
    selectStudent(value);
  };

  const handleCreateGoal = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);

      const payload: AnyObj = {
        student_id: selectedStudentId,
        title: values.title,
        reward_description: values.reward_description,
        metric_type: values.metric_type,
        target_value: values.target_value,
      };
      if (values.description) {
        payload.description = values.description;
      }
      if (values.deadline) {
        payload.deadline = values.deadline.toISOString();
      }

      await createRewardGoal(payload);
      message.success('奖励目标创建成功');
      setModalOpen(false);
      form.resetFields();
      if (selectedStudentId) {
        fetchRewardGoals(selectedStudentId);
      }
    } catch (err: any) {
      if (err?.errorFields) return; // form validation error
      message.error('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleClaimReward = async (goalId: string) => {
    setClaimingId(goalId);
    try {
      await claimReward(goalId);
      message.success('奖励已领取');
      if (selectedStudentId) {
        fetchRewardGoals(selectedStudentId);
      }
    } catch {
      message.error('领取失败，请重试');
    } finally {
      setClaimingId(null);
    }
  };

  const getProgressPercent = (goal: AnyObj): number => {
    const current = goal.current_value ?? 0;
    const target = goal.target_value ?? 1;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const activeGoals = rewardGoals.filter((g: AnyObj) => g.status === 'ACTIVE');
  const completedGoals = rewardGoals.filter(
    (g: AnyObj) => g.status === 'COMPLETED' || g.status === 'CLAIMED'
  );
  const otherGoals = rewardGoals.filter(
    (g: AnyObj) => g.status === 'CANCELLED' || g.status === 'EXPIRED'
  );

  const renderGoalCard = (goal: AnyObj) => {
    const metricInfo = METRIC_TYPE_MAP[goal.metric_type] || { label: goal.metric_type, color: 'default' };
    const statusInfo = STATUS_MAP[goal.status] || { label: goal.status, color: 'default' };
    const current = goal.current_value ?? 0;
    const target = goal.target_value ?? 1;
    const percent = getProgressPercent(goal);
    const isCompleted = goal.status === 'COMPLETED';
    const isClaimed = goal.status === 'CLAIMED';

    return (
      <Card
        key={goal.id}
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row justify="space-between" align="top">
          <Col flex="1">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space size="middle" align="center">
                <Text strong style={{ fontSize: 16 }}>
                  {isClaimed ? (
                    <CheckOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  ) : (
                    <GiftOutlined style={{ color: '#1677ff', marginRight: 8 }} />
                  )}
                  {goal.title || '奖励目标'}
                </Text>
                <Tag color={metricInfo.color}>{metricInfo.label}</Tag>
                <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
              </Space>
              {goal.description && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {goal.description}
                </Text>
              )}
              <Space size="small" align="center">
                <Text style={{ fontSize: 13 }}>
                  <GiftOutlined style={{ marginRight: 4 }} />
                  奖励：{goal.reward_description || '无'}
                </Text>
              </Space>
              {goal.deadline && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  截止日期：{new Date(goal.deadline).toLocaleDateString('zh-CN')}
                </Text>
              )}
            </Space>
          </Col>
          <Col flex="280px" style={{ paddingLeft: 16 }}>
            <Progress
              percent={percent}
              format={() => `${current} / ${target}`}
              status={percent >= 100 ? 'success' : 'active'}
              style={{ marginBottom: 8 }}
            />
            {isCompleted && !isClaimed && (
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                loading={claimingId === goal.id}
                onClick={() => handleClaimReward(goal.id)}
                style={{ width: '100%' }}
              >
                确认领取奖励
              </Button>
            )}
            {isClaimed && (
              <Tag color="success" style={{ textAlign: 'center', width: '100%' }}>
                已领取
              </Tag>
            )}
          </Col>
        </Row>
      </Card>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Text type="secondary" style={{ fontSize: 16 }}>加载中...</Text>
      </div>
    );
  }

  if (!linkedStudents || linkedStudents.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Empty
          description="尚未关联学生，请先在个人中心使用邀请码关联孩子"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Student selector + create button */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
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
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
              disabled={!selectedStudentId}
            >
              创建目标
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Active goals */}
      <Card
        title={
          <Space>
            <TrophyOutlined style={{ color: '#faad14' }} />
            <span>进行中的奖励目标</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {activeGoals.length > 0 ? (
          activeGoals.map(renderGoalCard)
        ) : (
          <Empty description="暂无进行中的奖励目标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {/* Completed goals */}
      <Card
        title="已完成 / 已领取"
        style={{ marginBottom: 24 }}
      >
        {completedGoals.length > 0 ? (
          <List
            dataSource={completedGoals}
            renderItem={(goal: AnyObj) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <CheckOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                  }
                  title={
                    <Space>
                      <span>{goal.title || '奖励目标'}</span>
                      <Tag color={goal.status === 'CLAIMED' ? 'default' : 'success'}>
                        {goal.status === 'CLAIMED' ? '已领取' : '已完成'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        奖励：{goal.reward_description || '无'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        进度：{goal.current_value ?? 0} / {goal.target_value ?? 1}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无已完成的奖励目标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {/* Cancelled / Expired goals */}
      <Card title="已取消 / 已过期">
        {otherGoals.length > 0 ? (
          <List
            dataSource={otherGoals}
            renderItem={(goal: AnyObj) => {
              const statusInfo = STATUS_MAP[goal.status] || { label: goal.status, color: 'default' };
              return (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{goal.title || '奖励目标'}</span>
                        <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                      </Space>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {goal.metric_type && METRIC_TYPE_MAP[goal.metric_type]
                          ? METRIC_TYPE_MAP[goal.metric_type].label
                          : goal.metric_type}
                        {' '}目标：{goal.target_value ?? '?'}
                      </Text>
                    }
                  />
                </List.Item>
              );
            }}
          />
        ) : (
          <Empty description="暂无已取消或已过期的奖励目标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {/* Create goal modal */}
      <Modal
        title="创建奖励目标"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => { setModalOpen(false); form.resetFields(); }}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={creating}
            onClick={handleCreateGoal}
          >
            创建
          </Button>,
        ]}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="目标名称"
            rules={[{ required: true, message: '请输入目标名称' }]}
          >
            <Input placeholder="例如：完成10份数学试卷" maxLength={100} />
          </Form.Item>

          <Form.Item name="description" label="目标描述（可选）">
            <TextArea
              placeholder="描述一下这个目标的具体内容"
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="reward_description"
            label="奖励内容"
            rules={[{ required: true, message: '请输入奖励内容' }]}
          >
            <Input placeholder="例如：周末去游乐场" maxLength={200} />
          </Form.Item>

          <Form.Item
            name="metric_type"
            label="指标类型"
            rules={[{ required: true, message: '请选择指标类型' }]}
          >
            <Select placeholder="请选择" options={METRIC_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="target_value"
            label="目标值"
            rules={[{ required: true, message: '请输入目标值' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入目标数值" />
          </Form.Item>

          <Form.Item name="deadline" label="截止日期（可选）">
            <DatePicker style={{ width: '100%' }} placeholder="请选择截止日期" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ParentRewardGoalsPage;
