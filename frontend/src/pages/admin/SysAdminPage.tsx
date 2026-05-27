import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Typography, Popconfirm, Divider, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, ReloadOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';

const { Title } = Typography;

interface AdminItem {
  id: string;
  username: string;
  full_name: string;
  admin_type: string;
  is_active: boolean;
  email?: string;
  phone?: string;
  qualification?: string;
  subjects?: string[];
  grade_level?: string[];
}

export default function SysAdminPage() {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminItem | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const { 'grade-levels': grades } = useReferenceValues();
  const [subjectOptions, setSubjectOptions] = useState<{value:string;label:string}[]>([]);
  const [isQAdmin, setIsQAdmin] = useState(false);
  const [isQAdminEdit, setIsQAdminEdit] = useState(false);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterSubject, setFilterSubject] = useState<string | undefined>();
  const [filterGrade, setFilterGrade] = useState<string | undefined>();

  useEffect(() => {
    apiClient.get('/subjects/all').then(({ data }) => {
      setSubjectOptions((data || []).map((s: any) => ({ value: s.name, label: s.name })));
    }).catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAdmins(); }, [filterName, filterType, filterStatus, filterSubject, filterGrade]);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterName) params.name = filterName;
      if (filterSubject && filterSubject !== '') params.subject = filterSubject;
      if (filterGrade && filterGrade !== '') params.grade = filterGrade;
      if (filterType !== undefined && filterType !== '') params.admin_type = filterType;
      if (filterStatus !== undefined && filterStatus !== '') params.is_active = String(filterStatus);
      const { data } = await apiClient.get('/auth/admin/list', { params });
      setAdmins(data);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      const params: any = { ...values };
      if (params.subjects?.length) params.subjects = JSON.stringify(params.subjects);
      if (params.grade_level) params.grade_level = JSON.stringify([params.grade_level]);
      else params.grade_level = JSON.stringify([]);
      await apiClient.post('/auth/admin/create', null, { params });
      message.success('管理员创建成功');
      setModalOpen(false);
      loadAdmins();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '创建失败');
    }
  };

  const handleEdit = (record: AdminItem) => {
    setEditingAdmin(record);
    editForm.setFieldsValue({
      full_name: record.full_name,
      phone: record.phone,
      email: record.email,
      admin_type: record.admin_type,
      qualification: record.qualification,
      is_active: record.is_active,
      subjects: record.subjects || [],
      grade_level: (record.grade_level || [])[0] || undefined,
    });
    setIsQAdminEdit(String(record.admin_type) === '1');
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    const values = await editForm.validateFields();
    try {
      const params: any = { ...values };
      if (params.subjects?.length) params.subjects = JSON.stringify(params.subjects);
      else params.subjects = JSON.stringify([]);
      if (params.grade_level) params.grade_level = JSON.stringify([params.grade_level]);
      else params.grade_level = JSON.stringify([]);
      if (!values.password) delete params.password;
      await apiClient.put(`/auth/admin/${editingAdmin!.id}`, null, { params });
      message.success('更新成功');
      setEditOpen(false);
      loadAdmins();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '更新失败');
    }
  };

  const handleToggleStatus = async (record: AdminItem) => {
    try {
      await apiClient.put(`/auth/admin/${record.id}`, null, { params: { is_active: !record.is_active } });
      message.success(record.is_active ? '已停用' : '已启用');
      loadAdmins();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '操作失败');
    }
  };

  const typeMap: Record<string, { color: string; label: string }> = {
    0: { color: 'blue', label: '教师' },
    1: { color: 'purple', label: '题库管理员' },
    2: { color: 'gold', label: '校长' },
    3: { color: 'orange', label: '教务主任' },
    4: { color: 'cyan', label: '学管' },
    5: { color: 'green', label: '班主任' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><UserOutlined /> 管理员账号管理</Title>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { form.resetFields(); setModalOpen(true); }}>
          创建管理员
        </Button>
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input placeholder="搜索用户名/姓名" prefix={<SearchOutlined />}
          value={filterName} onChange={e => setFilterName(e.target.value)}
          onPressEnter={loadAdmins}
          style={{ width: 180 }} allowClear size="small" />
        <Select value={filterSubject} onChange={v => { setFilterSubject(v); }}
          allowClear size="small" style={{ width: 110 }}
          options={[{ value: '', label: '全部学科' }, ...subjectOptions]} />
        <Select value={filterGrade} onChange={v => { setFilterGrade(v); }}
          allowClear size="small" style={{ width: 100 }}
          options={[{ value: '', label: '全部年级' }, ...grades.map(g => ({ value: g.code, label: g.name }))]} />
        <Select value={filterType} onChange={v => { setFilterType(v); }}
          allowClear size="small" style={{ width: 120 }}
          options={[{ value: '', label: '全部角色' }, { value: '0', label: '教师' }, { value: '1', label: '题库管理员' }]} />
        <Select value={filterStatus} onChange={v => { setFilterStatus(v); }}
          allowClear size="small" style={{ width: 90 }}
          options={[{ value: '', label: '全部状态' }, { value: 'true', label: '启用' }, { value: 'false', label: '停用' }]} />
        <Button icon={<ReloadOutlined />} onClick={loadAdmins} size="small">刷新</Button>
      </Space>

      <Table rowKey="id" loading={loading} dataSource={admins} columns={[
        { title: '用户名', dataIndex: 'username' },
        { title: '姓名', dataIndex: 'full_name' },
        { title: '类型', dataIndex: 'admin_type', width: 100,
          render: (t: string) => <Tag color={typeMap[t]?.color}>{typeMap[t]?.label || t}</Tag> },
        { title: '手机', dataIndex: 'phone' },
        { title: '学科', dataIndex: 'subjects', width: 160,
          render: (v: string[]) => v?.length ? v.map(s => <Tag key={s} style={{marginBottom:2}}>{s}</Tag>) : '-' },
        { title: '年级上限', dataIndex: 'grade_level', width: 90,
          render: (v: string[]) => v?.length ? v.sort().map(g => <Tag key={g} color="blue" style={{marginBottom:2}}>{g.replace('G','')}</Tag>) : '-' },
        { title: '状态', dataIndex: 'is_active', width: 60,
          render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '停用'}</Tag> },
        {
          title: '操作', width: 100,
          render: (_: any, r: AdminItem) => (
            <Space size={2}>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
              <Popconfirm title={r.is_active ? '确定停用?' : '确定启用?'} onConfirm={() => handleToggleStatus(r)}>
                <Button size="small" type="link"
                  danger={r.is_active}
                  icon={r.is_active ? <StopOutlined /> : <CheckCircleOutlined />}>
                  {r.is_active ? '停用' : '启用'}
                </Button>
              </Popconfirm>
            </Space>
          ),
        },
      ]} />

      <Modal title="编辑管理员" open={editOpen} onOk={handleUpdate} onCancel={() => { setEditOpen(false); setIsQAdminEdit(false); }} width={600}>
        <Form form={editForm} layout="vertical">
          <Divider style={{ margin: '8px 0' }} />
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="用户名">
                <Input value={editingAdmin?.username} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="password" label="新密码">
                <Input.Password placeholder="留空则不修改" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="full_name" label="姓名" rules={[{ required: true }]}>
                <Input placeholder="真实姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
                <Input placeholder="必填" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="admin_type" label="角色类型" rules={[{ required: true }]}>
                <Select options={[{ value: 0, label: '教师' }, { value: 1, label: '题库管理员' }]}
                  onChange={v => {
                    if (v === 1) {
                      editForm.setFieldsValue({ subjects: subjectOptions.map(s => s.value), grade_level: grades[grades.length-1]?.code });
                      setIsQAdminEdit(true);
                    } else {
                      editForm.setFieldsValue({ subjects: [], grade_level: undefined });
                      setIsQAdminEdit(false);
                    }
                  }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="qualification" label="教师资格证号"><Input placeholder="教师必填" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱"><Input placeholder="选填" /></Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '8px 0' }}>权限范围</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="subjects" label="学科权限">
                <Select mode="multiple" allowClear placeholder="可多选" options={subjectOptions}
                  disabled={isQAdminEdit}
                  maxTagCount={3}
                  dropdownRender={menu => (
                    <div>
                      {menu}
                      <Divider style={{ margin: '4px 0' }} />
                      <div style={{ textAlign: 'center', padding: '4px 0', color: '#999', fontSize: 12 }}>
                        勾选完成后点击空白处确认
                      </div>
                    </div>
                  )}
                />
              </Form.Item>
              <div style={{ color: '#888', fontSize: 11, marginTop: -16, marginBottom: 8 }}>
                选择该教师负责的学科，可多选
              </div>
            </Col>
            <Col span={12}>
              <Form.Item name="grade_level" label="年级上限">
                <Select allowClear placeholder="选择最高年级" options={toSelectOptions(grades)}
                  disabled={isQAdminEdit} />
              </Form.Item>
              <div style={{ color: '#888', fontSize: 11, marginTop: -16, marginBottom: 8 }}>
                教师可查看和处理所选年级及以下所有年级的试卷和试题
              </div>
            </Col>
          </Row>
          <Divider style={{ margin: '8px 0' }}>状态</Divider>
          <Row>
            <Col span={12}>
              <Form.Item name="is_active" label="启用状态">
                <Select options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="创建管理员" open={modalOpen} onOk={handleCreate} onCancel={() => { setModalOpen(false); setIsQAdmin(false); }} width={600}>
        <Form form={form} layout="vertical" initialValues={{ admin_type: 0 }}>
          <Divider style={{ margin: '8px 0' }} />
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                <Input placeholder="登录用户名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
                <Input.Password placeholder="初始密码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="full_name" label="姓名" rules={[{ required: true }]}>
                <Input placeholder="真实姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
                <Input placeholder="必填" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="admin_type" label="角色类型" rules={[{ required: true }]}>
                <Select options={[{ value: 0, label: '教师' }, { value: 1, label: '题库管理员' }]}
                  onChange={v => {
                    if (v === 1) {
                      form.setFieldsValue({ subjects: subjectOptions.map(s => s.value), grade_level: grades[grades.length-1]?.code });
                      setIsQAdmin(true);
                    } else {
                      form.setFieldsValue({ subjects: [], grade_level: undefined });
                      setIsQAdmin(false);
                    }
                  }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="qualification" label="教师资格证号"><Input placeholder="教师必填" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱"><Input placeholder="选填" /></Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '8px 0' }}>权限范围</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="subjects" label="学科权限">
                <Select mode="multiple" allowClear placeholder="可多选" options={subjectOptions}
                  disabled={isQAdmin}
                  maxTagCount={3}
                  dropdownRender={menu => (
                    <div>
                      {menu}
                      <Divider style={{ margin: '4px 0' }} />
                      <div style={{ textAlign: 'center', padding: '4px 0', color: '#999', fontSize: 12 }}>
                        勾选完成后点击空白处确认
                      </div>
                    </div>
                  )}
                />
              </Form.Item>
              <div style={{ color: '#888', fontSize: 11, marginTop: -16, marginBottom: 8 }}>
                选择该教师负责的学科，可多选
              </div>
            </Col>
            <Col span={12}>
              <Form.Item name="grade_level" label="年级上限">
                <Select allowClear placeholder="选择最高年级" options={toSelectOptions(grades)}
                  disabled={isQAdmin} />
              </Form.Item>
              <div style={{ color: '#888', fontSize: 11, marginTop: -16, marginBottom: 8 }}>
                教师可查看和处理所选年级及以下所有年级的试卷和试题
              </div>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
