import { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag, message, Popconfirm, Typography, Card, Row, Col, Tabs, Empty,
} from 'antd';
import { PlusOutlined, DeleteOutlined, UserAddOutlined, EditOutlined, SearchOutlined, TeamOutlined, MessageOutlined, NotificationOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';

const { Title } = Typography;

interface ClassItem {
  id: string;
  name: string;
  subject?: string;
  grade_level?: string;
  student_count?: number;
  is_active?: boolean;
}

interface StudentItem {
  id: string;
  full_name: string;
  username?: string;
  phone?: string;
  grade?: string;
  school?: string;
  email?: string;
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const refs = useReferenceValues();
  const grades = refs['grade-levels'];

  // Class modal
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [classSaving, setClassSaving] = useState(false);
  const [classForm] = Form.useForm();

  // Student modal
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [availStudents, setAvailStudents] = useState<StudentItem[]>([]);
  const [availSearch, setAvailSearch] = useState('');
  const [studentTab, setStudentTab] = useState('select');

  // Edit student modal
  const [editStudentOpen, setEditStudentOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [studentForm] = Form.useForm();
  const [studentSaving, setStudentSaving] = useState(false);
  const [manualForm] = Form.useForm();

  // Feedback modal
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackStudent, setFeedbackStudent] = useState<StudentItem | null>(null);
  const [feedbackForm] = Form.useForm();
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  // Announcement modal
  const [announceModalOpen, setAnnounceModalOpen] = useState(false);
  const [announceClass, setAnnounceClass] = useState<ClassItem | null>(null);
  const [announceForm] = Form.useForm();
  const [announceSaving, setAnnounceSaving] = useState(false);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const resp = await apiClient.get('/classes', { params });
      setClasses(Array.isArray(resp.data) ? resp.data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  // ── Class CRUD ──
  const openCreateClass = () => { setEditingClass(null); classForm.resetFields(); setClassModalOpen(true); };
  const openEditClass = (cls: ClassItem) => { setEditingClass(cls); classForm.setFieldsValue(cls); setClassModalOpen(true); };

  async function handleClassSave() {
    const values = await classForm.validateFields();
    setClassSaving(true);
    try {
      if (editingClass) {
        await apiClient.put('/classes/' + editingClass.id, values);
        message.success('班级已更新');
      } else {
        await apiClient.post('/classes', values);
        message.success('班级创建成功');
      }
      setClassModalOpen(false);
      loadClasses();
    } catch (e: any) {
      let detail = '操作失败';
      if (e?.response?.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
    setClassSaving(false);
  }

  async function handleDeleteClass(id: string) {
    try { await apiClient.delete('/classes/' + id); message.success('已删除'); loadClasses(); }
    catch { message.error('删除失败'); }
  }

  // ── Student Management ──
  async function openStudentModal(cls: ClassItem) {
    setSelectedClass(cls);
    setStudentTab('select');
    setAvailSearch('');
    try {
      const stuResp = await apiClient.get('/classes/' + cls.id + '/students');
      setStudents(Array.isArray(stuResp.data) ? stuResp.data : []);
      const availResp = await apiClient.get('/classes/' + cls.id + '/available-students');
      setAvailStudents(Array.isArray(availResp.data) ? availResp.data : []);
    } catch { /* ignore */ }
    setStudentModalOpen(true);
  }

  async function loadStudents() {
    if (!selectedClass) return;
    try {
      const stuResp = await apiClient.get('/classes/' + selectedClass.id + '/students');
      setStudents(Array.isArray(stuResp.data) ? stuResp.data : []);
      const params: Record<string, string> = {};
      if (availSearch) params.search = availSearch;
      const availResp = await apiClient.get('/classes/' + selectedClass.id + '/available-students', { params });
      setAvailStudents(Array.isArray(availResp.data) ? availResp.data : []);
    } catch { /* ignore */ }
  }

  async function addExistingStudent(studentId: string) {
    if (!selectedClass) return;
    try {
      await apiClient.post('/classes/' + selectedClass.id + '/students', { student_id: studentId });
      message.success('学生已添加');
      loadStudents();
    } catch (e: any) {
      let detail = '添加失败';
      if (e?.response?.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
  }

  async function addManualStudent(values: Record<string, string>) {
    if (!selectedClass) return;
    try {
      await apiClient.post('/classes/' + selectedClass.id + '/students', values);
      message.success('学生已添加');
      manualForm.resetFields();
      loadStudents();
    } catch (e: any) {
      let detail = '添加失败';
      if (e?.response?.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
  }

  async function removeStudent(studentId: string) {
    if (!selectedClass) return;
    try {
      await apiClient.delete('/classes/' + selectedClass.id + '/students/' + studentId);
      message.success('已移除');
      loadStudents();
    } catch { message.error('移除失败'); }
  }

  function openEditStudent(s: StudentItem) {
    setEditingStudent(s);
    studentForm.setFieldsValue(s);
    setEditStudentOpen(true);
  }

  async function handleSaveStudent() {
    if (!selectedClass || !editingStudent) return;
    const values = await studentForm.validateFields();
    setStudentSaving(true);
    try {
      await apiClient.put('/classes/' + selectedClass.id + '/students/' + editingStudent.id, values);
      message.success('学生信息已更新');
      setEditStudentOpen(false);
      loadStudents();
    } catch (e: any) {
      let detail = '保存失败';
      if (e?.response?.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
    setStudentSaving(false);
  }

  // ── Feedback ──
  function openFeedbackModal(s: StudentItem) {
    setFeedbackStudent(s);
    feedbackForm.resetFields();
    setFeedbackModalOpen(true);
  }

  async function handleSendFeedback() {
    if (!feedbackStudent) return;
    const values = await feedbackForm.validateFields();
    setFeedbackSaving(true);
    try {
      await apiClient.post('/teacher/interaction/feedback', {
        student_id: feedbackStudent.id,
        feedback: values.feedback,
      });
      message.success(`已向${feedbackStudent.full_name}发送评语`);
      setFeedbackModalOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '发送评语失败');
    }
    setFeedbackSaving(false);
  }

  // ── Announcement ──
  function openAnnounceModal(cls: ClassItem) {
    setAnnounceClass(cls);
    announceForm.resetFields();
    setAnnounceModalOpen(true);
  }

  async function handleSendAnnouncement() {
    if (!announceClass) return;
    const values = await announceForm.validateFields();
    setAnnounceSaving(true);
    try {
      const resp = await apiClient.post('/teacher/interaction/class-announcement', {
        class_id: announceClass.id,
        title: values.title,
        content: values.content,
      });
      message.success(resp.data?.message || '班级通知已发送');
      setAnnounceModalOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '发送通知失败');
    }
    setAnnounceSaving(false);
  }

  // ── Render ──
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8 }} />
          班级管理
        </Title>
        <Space>
          <Input
            placeholder="搜索班级名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
            allowClear
            size="small"
            onPressEnter={loadClasses}
          />
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateClass}>新建班级</Button>
        </Space>
      </div>

      {/* Class table */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={classes}
        size="middle"
        columns={[
          { title: '班级名称', dataIndex: 'name', ellipsis: true },
          { title: '学科', dataIndex: 'subject', width: 80 },
          { title: '年级', dataIndex: 'grade_level', width: 80 },
          { title: '学生数', dataIndex: 'student_count', width: 80, align: 'center' as const },
          {
            title: '状态',
            dataIndex: 'is_active',
            width: 70,
            render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
          },
          {
            title: '操作',
            width: 300,
            render: (_: unknown, r: ClassItem) => (
              <Space>
                <Button type="link" size="small" icon={<UserAddOutlined />} onClick={() => openStudentModal(r)}>学生</Button>
                <Button type="link" size="small" icon={<NotificationOutlined />} onClick={() => openAnnounceModal(r)}>通知</Button>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditClass(r)}>编辑</Button>
                <Popconfirm title="确定删除该班级？" onConfirm={() => handleDeleteClass(r.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {/* ── Class Create/Edit Modal ── */}
      <Modal
        title={editingClass ? '编辑班级' : '新建班级'}
        open={classModalOpen}
        onOk={handleClassSave}
        onCancel={() => setClassModalOpen(false)}
        confirmLoading={classSaving}
      >
        <Form form={classForm} layout="vertical">
          <Form.Item name="name" label="班级名称" rules={[{ required: true, message: '请输入班级名称' }]}>
            <Input placeholder="如: 八年级数学提高班" size="small" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="subject" label="学科" rules={[{ required: true }]}>
                <Select
                  size="small"
                  options={[
                    { value: '数学', label: '数学' },
                    { value: '语文', label: '语文' },
                    { value: '英语', label: '英语' },
                    { value: '物理', label: '物理' },
                    { value: '化学', label: '化学' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="grade_level" label="年级">
                <Select size="small" options={toSelectOptions(grades)} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="班级描述（选填）" size="small" />
          </Form.Item>
          <Form.Item name="is_active" label="状态" initialValue={true} valuePropName="checked">
            <Select size="small" options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Student Management Modal ── */}
      <Modal
        title={'管理学生 — ' + (selectedClass ? selectedClass.name : '')}
        open={studentModalOpen}
        onCancel={() => setStudentModalOpen(false)}
        footer={null}
        width={750}
      >
        {/* Currently enrolled students */}
        <Card title={'班级学生（' + students.length + '人）'} size="small" style={{ marginBottom: 16 }}>
          {students.length === 0 ? (
            <Empty description="暂无学生" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Table
              rowKey="id"
              size="small"
              dataSource={students}
              pagination={false}
              columns={[
                { title: '姓名', dataIndex: 'full_name' },
                { title: '用户名', dataIndex: 'username' },
                { title: '手机号', dataIndex: 'phone', render: (v: string) => v || '-' },
                { title: '年级', dataIndex: 'grade' },
                {
                  title: '操作',
                  width: 180,
                  render: (_: unknown, s: StudentItem) => (
                    <Space>
                      <Button type="link" size="small" icon={<MessageOutlined />} onClick={() => openFeedbackModal(s)}>评语</Button>
                      <Button type="link" size="small" onClick={() => openEditStudent(s)}>编辑</Button>
                      <Popconfirm title="从班级移除？" onConfirm={() => removeStudent(s.id)}>
                        <Button type="link" size="small" danger>移除</Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Card>

        {/* Add student */}
        <Card title="添加学生" size="small">
          <Tabs activeKey={studentTab} onChange={setStudentTab} size="small" items={[
            {
              key: 'select',
              label: '从学生库选择',
              children: (
                <div>
                  <Input
                    placeholder="搜索学生姓名"
                    value={availSearch}
                    onChange={(e) => setAvailSearch(e.target.value)}
                    onPressEnter={loadStudents}
                    style={{ marginBottom: 12, width: 250 }}
                    prefix={<SearchOutlined />}
                    allowClear
                    size="small"
                  />
                  <Table
                    rowKey="id"
                    size="small"
                    dataSource={availStudents}
                    pagination={{ pageSize: 5 }}
                    columns={[
                      { title: '姓名', dataIndex: 'full_name' },
                      { title: '用户名', dataIndex: 'username' },
                      { title: '年级', dataIndex: 'grade' },
                      {
                        title: '操作',
                        width: 80,
                        render: (_: unknown, s: StudentItem) => (
                          <Button type="primary" size="small" onClick={() => addExistingStudent(s.id)}>添加</Button>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'manual',
              label: '直接录入',
              children: (
                <Form form={manualForm} layout="inline" onFinish={addManualStudent}>
                  <Form.Item name="full_name" label="姓名" rules={[{ required: true }]}>
                    <Input placeholder="学生姓名" style={{ width: 100 }} size="small" />
                  </Form.Item>
                  <Form.Item name="phone" label="手机号">
                    <Input placeholder="手机号" style={{ width: 120 }} size="small" />
                  </Form.Item>
                  <Form.Item name="grade" label="年级">
                    <Input placeholder="年级" style={{ width: 80 }} size="small" />
                  </Form.Item>
                  <Form.Item name="school" label="学校">
                    <Input placeholder="学校" style={{ width: 120 }} size="small" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" size="small">添加</Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]} />
        </Card>
      </Modal>

      {/* ── Edit Student Modal ── */}
      <Modal
        title={'编辑学生 — ' + (editingStudent ? editingStudent.full_name : '')}
        open={editStudentOpen}
        onOk={handleSaveStudent}
        onCancel={() => setEditStudentOpen(false)}
        confirmLoading={studentSaving}
      >
        <Form form={studentForm} layout="vertical">
          <Form.Item name="full_name" label="姓名" rules={[{ required: true }]}>
            <Input size="small" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input size="small" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="grade" label="年级">
                <Input size="small" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="school" label="学校">
                <Input size="small" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="手机号">
            <Input value={editingStudent ? editingStudent.phone || '' : ''} disabled size="small" addonAfter={<Tag color="orange" style={{ margin: 0 }}>不可修改</Tag>} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Feedback Modal ── */}
      <Modal
        title={'发送评语 — ' + (feedbackStudent ? feedbackStudent.full_name : '')}
        open={feedbackModalOpen}
        onOk={handleSendFeedback}
        onCancel={() => setFeedbackModalOpen(false)}
        confirmLoading={feedbackSaving}
        okText="发送"
      >
        <Form form={feedbackForm} layout="vertical">
          <Form.Item name="feedback" rules={[{ required: true, message: '请输入评语内容' }, { max: 500, message: '最多500字' }]}>
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="对该学生的学习表现进行评价和鼓励，学生将收到通知..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Announcement Modal ── */}
      <Modal
        title={'班级通知 — ' + (announceClass ? announceClass.name : '')}
        open={announceModalOpen}
        onOk={handleSendAnnouncement}
        onCancel={() => setAnnounceModalOpen(false)}
        confirmLoading={announceSaving}
        okText="发送通知"
      >
        <Form form={announceForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入通知标题' }]}>
            <Input placeholder="如：本周作业安排" size="small" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入通知内容' }, { max: 1000, message: '最多1000字' }]}>
            <Input.TextArea
              rows={4}
              maxLength={1000}
              showCount
              placeholder="通知将发送给班级所有学生及已绑定的家长..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
