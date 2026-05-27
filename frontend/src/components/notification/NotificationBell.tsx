import { useEffect, useState } from 'react';
import { Badge, Dropdown, List, Button, Empty, Spin, Tag, Typography } from 'antd';
import { BellOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNotificationStore } from '../../store/notification';

const { Text } = Typography;

const TYPE_MAP: Record<string, { color: string; label: string }> = {
  GRADING_COMPLETE: { color: 'green', label: '判分完成' },
  ERROR_NOTEBOOK_READY: { color: 'blue', label: '错题本' },
  EXAM_REMINDER: { color: 'orange', label: '考试提醒' },
  SYSTEM_UPDATE: { color: 'purple', label: '系统' },
  WELCOME: { color: 'cyan', label: '欢迎' },
  PASSWORD_RESET: { color: 'red', label: '安全' },
  ENCOURAGEMENT_RECEIVED: { color: 'pink', label: '收到鼓励' },
  CELEBRATION_EVENT: { color: 'gold', label: '庆祝' },
  REWARD_GOAL_UPDATE: { color: 'geekblue', label: '奖励进度' },
  TEACHER_FEEDBACK: { color: 'lime', label: '教师评语' },
  CLASS_ANNOUNCEMENT: { color: 'volcano', label: '班级通知' },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    fetchUnreadCount,
    connectWebSocket,
    disconnectWebSocket,
  } = useNotificationStore();

  // Connect WebSocket for real-time notifications (replaces polling)
  useEffect(() => {
    fetchUnreadCount();
    connectWebSocket();
    return () => { disconnectWebSocket(); };
  }, [connectWebSocket, disconnectWebSocket, fetchUnreadCount]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleMarkAll = async () => {
    await markAllAsRead();
    fetchUnreadCount();
  };

  const handleMarkOne = async (id: string) => {
    await markAsRead(id);
    fetchUnreadCount();
  };

  const overlay = (
    <div style={{ width: 360, maxHeight: 480, overflow: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>通知</Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={handleMarkAll}>
            全部已读
          </Button>
        )}
      </div>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : notifications.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" style={{ padding: 24 }}></Empty>
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item) => {
            const typeInfo = TYPE_MAP[item.notification_type] || { color: 'default', label: '通知' };
            const isUnread = item.status !== 'READ';
            return (
              <List.Item
                style={{
                  padding: '12px 16px',
                  background: isUnread ? '#f0f5ff' : '#fff',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                }}
                onClick={() => { if (isUnread) handleMarkOne(item.id); }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Tag color={typeInfo.color} style={{ fontSize: 11 }}>{typeInfo.label}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.created_at ? item.created_at.substring(5, 16) : ''}
                    </Text>
                  </div>
                  <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.content}</Text>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => overlay}
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }}></BellOutlined>} />
      </Badge>
    </Dropdown>
  );
}
