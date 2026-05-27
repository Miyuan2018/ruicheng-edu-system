import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Typography, Space, Input, Select, Modal, Form,
  DatePicker, message, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons';
import apiClient from '../../api/client';
import { getUserId } from '../../store/auth';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

type AnyObj = Record<string, any>;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待开始', color: 'default' },
  IN_PROGRESS: { label: '进行中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
  FAILED: { label: '失败', color: 'error' },
  CANCELLED: { label: '已取消', color: 'warning' },
};

const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([value, { label }]) => ({ value, label }));

const PRIORITY_OPTIONS = [
  { value: 1, label: '1 - 最低' },
  { value: 2, label: '2 - 低' },
  { value: 3, label: '3 - 中' },
  { value: 4, label: '4 - 高' },
  { value: 5, label: '5 - 最高' },
];

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  grade_level?: string;
  status: string;
  priority: number;
  scheduled_time?: string;
  completed_time?: string;
  created_at: string;
}

export default function SelfStudyPage() {
  const userId = getUserId();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskItem | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [form] = Form.useForm();
  const { subjects, 'grade-levels': grades } = useReferenceValues();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (filterStatus) params.status = filterStatus;
      if (filterSubject) params.subject = filterSubject;
      const resp = await apiClient.get('/self-study/tasks', { params });
      let data = resp.data;
      if (data && data.data && Array.isArray(data.data)) data = data.data;
      if (!Array.isArray(data)) data = [];
      // client-side keyword filter on title
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        data = data.filter((t: AnyObj) => (t.title || '').toLowerCase().includes(kw));
      }
      setTasks(data);
    } catch {
      message.error('加载自学任务失败');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSubject, searchKeyword]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const openCreate = () => {
    setEditTask(null);
    form.resetFields();
    form.setFieldsValue({ priority: 3, status: 'PENDING' });
    setModalOpen(true);
  };

  const openEdit = (record: TaskItem) => {
    setEditTask(record);
    form.setFieldsValue({
      ...record,
      scheduled_time: record.scheduled_time ? dayjs(record.scheduled_time) : undefined,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: AnyObj = {
        ...values,
        student_id: userId,
        scheduled_time: values.scheduled_time ? values.scheduled_time.toISOString() : null,
      };
      if (editTask) {
        await apiClient.put('/self-study/tasks/' + editTask.id, payload);
        message.success('任务已更新');
      } else {
        await apiClient.post('/self-study/tasks', payload);
        message.success('任务已创建');
      }
      setModalOpen(false);
      fetchTasks();
    } catch (err: unknown) {
      if ((err as AnyObj)?.errorFields) return; // form validation error
      message.error(editTask ? '更新失败' : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete('/self-study/tasks/' + id);
      message.success('任务已删除');
      fetchTasks();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'title',
      ellipsis: true,
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    { title: '学科', dataIndex: 'subject', width: 90 },
    { title: '年级', dataIndex: 'grade_level', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: string) => {
        const info = STATUS_MAP[s] || { label: s, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 70,
      align: 'center' as const,
      sorter: (a: TaskItem, b: TaskItem) => a.priority - b.priority,
    },
    {
      title: '计划时间',
      dataIndex: 'scheduled_time',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '操作',
      width: 140,
      render: (_: unknown, record: TaskItem) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该任务？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>自学任务</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTasks} size="small">刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建任务</Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          placeholder="搜索任务名称"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          style={{ width: 180 }}
          prefix={<SearchOutlined />}
          allowClear
          size="small"
        />
        <Select
          placeholder="状态筛选"
          value={filterStatus || undefined}
          onChange={(v) => setFilterStatus(v || '')}
          style={{ width: 120 }}
          allowClear
          size="small"
          options={STATUS_OPTIONS}
        />
        <Select
          placeholder="学科"
          value={filterSubject || undefined}
          onChange={(v) => setFilterSubject(v || '')}
          style={{ width: 120 }}
          allowClear
          size="small"
          options={toSelectOptions(subjects)}
        />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={tasks}
        columns={columns}
        size="middle"
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
      />

      <Modal
        title={editTask ? '编辑任务' : '新建任务'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="例如：复习二次函数" maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea placeholder="任务详情（可选）" rows={3} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="subject" label="学科" style={{ flex: 1 }}>
              <Select placeholder="选择学科" allowClear options={toSelectOptions(subjects)} />
            </Form.Item>
            <Form.Item name="grade_level" label="年级" style={{ flex: 1 }}>
              <Select placeholder="选择年级" allowClear options={toSelectOptions(grades)} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="status" label="状态" style={{ flex: 1 }}>
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="priority" label="优先级" style={{ flex: 1 }}>
              <Select options={PRIORITY_OPTIONS} />
            </Form.Item>
          </div>
          <Form.Item name="scheduled_time" label="计划时间">
            <DatePicker style={{ width: '100%' }} placeholder="选择计划完成时间" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
