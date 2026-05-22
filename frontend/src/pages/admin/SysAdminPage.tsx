import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Typography, Card, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

const { Title } = Typography;

interface AdminItem {
  id: string;
  username: string;
  full_name: string;
  admin_type: string;
  is_active: boolean;
  email?: string;
  phone?: string;
}

export default function SysAdminPage() {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { loadAdmins(); }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/auth/admin/list');
      setAdmins(data);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await apiClient.post('/auth/admin/create', null, { params: values });
      message.success('管理员创建成功');
      setModalOpen(false);
      loadAdmins();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/auth/admin/${id}`);
      message.success('已删除');
      loadAdmins();
    } catch { message.error('删除失败'); }
  };

  const typeMap: Record<string, { color: string; label: string }> = {
    0: { color: 'blue', label: '教师' },
    1: { color: 'purple', label: '题库管理员' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><UserOutlined /> 管理员账号管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAdmins}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setModalOpen(true); }}>
            创建管理员
          </Button>
        </Space>
      </div>

      <Table rowKey="id" loading={loading} dataSource={admins} columns={[
        { title: '用户名', dataIndex: 'username' },
        { title: '姓名', dataIndex: 'full_name' },
        { title: '类型', dataIndex: 'admin_type', width: 120,
          render: (t: string) => <Tag color={typeMap[t]?.color}>{typeMap[t]?.label || t}</Tag> },
        { title: '邮箱', dataIndex: 'email' },
        { title: '手机', dataIndex: 'phone' },
        { title: '资格证号', dataIndex: 'qualification' },
        { title: '状态', dataIndex: 'is_active', width: 70,
          render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '停用'}</Tag> },
        {
          title: '操作', width: 80,
          render: (_: any, r: AdminItem) => (
            <Popconfirm title="确定删除?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ),
        },
      ]} />

      <Modal title="创建管理员" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" initialValues={{ admin_type: 0 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="登录用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="初始密码" />
          </Form.Item>
          <Form.Item name="full_name" label="姓名" rules={[{ required: true }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item name="admin_type" label="角色类型" rules={[{ required: true }]}>
            <Select options={[
              { value: 0, label: '教师' },
              { value: 1, label: '题库管理员' },
            ]} />
          </Form.Item>
          <Form.Item name="qualification" label="教师资格证号"><Input placeholder="教师必填" /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input placeholder="必填" />
          </Form.Item>
          <Form.Item name="email" label="邮箱"><Input placeholder="选填" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
