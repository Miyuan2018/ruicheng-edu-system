import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

const { Title } = Typography;

interface UserItem {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const roleMap: Record<string, { color: string; label: string }> = {
  STUDENT: { color: 'blue', label: '学生' },
  TEACHER: { color: 'green', label: '教师' },
  ADMIN: { color: 'red', label: '管理员' },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form] = Form.useForm();
  const [page, setPage] = useState(1);

  useEffect(() => { loadUsers(); }, [page]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/users', { params: { limit: 50, offset: (page - 1) * 50 } });
      setUsers(Array.isArray(data) ? data : data.items || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingUser) {
        await apiClient.put(`/users/${editingUser.id}`, values);
        message.success('更新成功');
      } else {
        await apiClient.post('/users', { ...values, password: 'default123', role: values.role || 'STUDENT' });
        message.success('创建成功');
      }
      setModalOpen(false);
      loadUsers();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try { await apiClient.delete(`/users/${id}`); message.success('已删除'); loadUsers(); }
    catch { message.error('删除失败'); }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      await apiClient.put(`/users/${user.id}`, { is_active: !user.is_active });
      message.success(user.is_active ? '已停用' : '已启用');
      loadUsers();
    } catch { message.error('操作失败'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditingUser(null); form.resetFields(); setModalOpen(true); }}>
          新建用户
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={users}
        pagination={{ current: page, onChange: setPage, showTotal: (t) => `共 ${t} 人` }}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '姓名', dataIndex: 'full_name' },
          { title: '邮箱', dataIndex: 'email' },
          { title: '角色', dataIndex: 'role', width: 80, render: (r: string) => <Tag color={roleMap[r]?.color}>{roleMap[r]?.label || r}</Tag> },
          { title: '状态', dataIndex: 'is_active', width: 70, render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag> },
          {
            title: '操作', width: 200,
            render: (_: unknown, r: UserItem) => (
              <Space>
                <Button size="small" icon={<EditOutlined />}
                  onClick={() => { setEditingUser(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
                <Button size="small" onClick={() => handleToggleActive(r)}>
                  {r.is_active ? '停用' : '启用'}
                </Button>
                <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={editingUser ? '编辑用户' : '新建用户'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="full_name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={[
              { value: 'STUDENT', label: '学生' },
              { value: 'TEACHER', label: '教师' },
              { value: 'ADMIN', label: '管理员' },
            ]} />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="密码"><Input.Password placeholder="默认密码: default123" /></Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
