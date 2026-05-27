import React, { useEffect, useState } from 'react';
import {
  Card,
  Select,
  Tag,
  Typography,
  Space,
  Empty,
  Timeline,
  Spin,
} from 'antd';
import {
  StarOutlined,
  FireOutlined,
  TrophyOutlined,
  RocketOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import useParentStore from '../../store/useParentStore';

const { Text } = Typography;

type AnyObj = Record<string, any>;

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  PAPER_COMPLETED: { color: 'green', label: '完成试卷', icon: <CheckCircleOutlined /> },
  STREAK_MILESTONE: { color: 'orange', label: '连续打卡', icon: <FireOutlined /> },
  ACCURACY_IMPROVED: { color: 'blue', label: '正确率提升', icon: <RocketOutlined /> },
  ERRORS_CLEARED: { color: 'red', label: '消灭错题', icon: <TrophyOutlined /> },
  SUBJECT_MASTERY: { color: 'gold', label: '学科掌握', icon: <StarOutlined /> },
};

const TIMELINE_DOT_COLOR: Record<string, string> = {
  PAPER_COMPLETED: 'green',
  STREAK_MILESTONE: 'orange',
  ACCURACY_IMPROVED: 'blue',
  ERRORS_CLEARED: 'red',
  SUBJECT_MASTERY: 'gold',
};

const ParentCelebrationsPage: React.FC = () => {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const {
    linkedStudents,
    celebrations,
    isLoading,
    fetchLinkedStudents,
    fetchCelebrations,
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
    }
  }, [linkedStudents, selectedStudentId]);

  // Fetch celebrations when selected student changes
  useEffect(() => {
    if (selectedStudentId) {
      fetchCelebrations(selectedStudentId);
    }
  }, [selectedStudentId, fetchCelebrations]);

  const handleStudentChange = (value: string) => {
    setSelectedStudentId(value);
  };

  const formatTime = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
          description="尚未关联学生，请先在个人中心使用邀请码关联孩子"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Student selector */}
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
        </Space>
      </Card>

      {/* Celebration timeline */}
      <Card title="庆祝时刻">
        <Spin spinning={isLoading}>
          {celebrations && celebrations.length > 0 ? (
            <Timeline
              items={celebrations.map((event: AnyObj) => {
                const config = EVENT_TYPE_CONFIG[event.event_type] || {
                  color: 'gray',
                  label: event.event_type,
                  icon: <StarOutlined />,
                };
                const dotColor = TIMELINE_DOT_COLOR[event.event_type] || 'gray';

                return {
                  key: event.id,
                  color: dotColor,
                  dot: <span style={{ fontSize: 16, color: dotColor === 'gold' ? '#faad14' : undefined }}>{config.icon}</span>,
                  children: (
                    <div style={{ paddingBottom: 8 }}>
                      <div style={{ marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 15 }}>{event.title}</Text>
                        <Tag
                          color={config.color}
                          style={{ marginLeft: 8 }}
                        >
                          {config.label}
                        </Tag>
                        <Tag color={event.parent_acknowledged ? 'green' : 'default'}>
                          {event.parent_acknowledged ? '已查看' : '未查看'}
                        </Tag>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary">{event.description}</Text>
                      </div>
                      <Space size="middle">
                        {event.metric_value != null && (
                          <Text style={{ color: '#1677ff' }}>
                            指标值：{event.metric_value}
                          </Text>
                        )}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatTime(event.created_at)}
                        </Text>
                      </Space>
                    </div>
                  ),
                };
              })}
            />
          ) : (
            <Empty description="暂无庆祝事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default ParentCelebrationsPage;
