import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Tag, Descriptions, Space, message, Row, Col, Spin, Alert } from 'antd';
import { UserOutlined, PhoneOutlined, MailOutlined, IdcardOutlined, ClockCircleOutlined, SaveOutlined, LinkOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/auth';

const { Title } = Typography;

interface ProfileData {
  username: string;
  full_name: string;
  phone?: string;
  email?: string;
  grade?: string;
  school?: string;
  created_at?: string;
  last_login_at?: string;
  role_label?: string;
  user_type?: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [form] = Form.useForm();
  const [phoneForm] = Form.useForm();
  const { updateUserName } = useAuthStore();

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteExpires, setInviteExpires] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteGenerating, setInviteGenerating] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  useEffect(() => {
    if (profile?.user_type === 'STUDENT') loadInviteCode();
  }, [profile?.user_type]);

  async function loadInviteCode() {
    setInviteLoading(true);
    try {
      const resp = await apiClient.get('/parent/students/invite-code');
      if (resp.data?.invite_code) {
        setInviteCode(resp.data.invite_code);
        setInviteExpires(resp.data.expires_at);
      }
    } catch { /* no code yet */ }
    finally { setInviteLoading(false); }
  }

  async function handleGenerateInviteCode() {
    setInviteGenerating(true);
    try {
      const resp = await apiClient.post('/parent/students/generate-invite-code');
      setInviteCode(resp.data.invite_code);
      setInviteExpires(resp.data.expires_at);
      message.success('邀请码已生成，分享给家长即可完成绑定');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '生成邀请码失败');
    } finally { setInviteGenerating(false); }
  }

  function handleCopyCode() {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      message.success('邀请码已复制到剪贴板');
    }
  }

  function loadProfile() {
    setLoading(true);
    apiClient.get('/auth/profile').then((resp) => {
      const data = resp.data;
      if (data && data.ok) { setProfile(data.data); }
      else { setProfile(data); }
    }).catch(() => { message.error('加载个人信息失败'); })
    .finally(() => { setLoading(false); });
  }

  function handleEdit() {
    form.setFieldsValue({
      full_name: profile?.full_name,
      email: profile?.email || '',
      grade: profile?.grade || '',
      school: profile?.school || '',
    });
    setEditing(true);
  }

  function handleCancel() { setEditing(false); }

  async function handleSave(values: Record<string, string>) {
    setSaving(true);
    try {
      const resp = await apiClient.put('/auth/profile', values);
      if (resp.data && resp.data.ok) {
        message.success('个人信息已更新');
        if (values.full_name) {
          updateUserName(values.full_name);
        }
        loadProfile();
        setEditing(false);
      } else {
        message.error(resp.data.message || '更新失败');
      }
    } catch (e: any) {
      let detail = '更新失败';
      if (e?.response?.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    } finally { setSaving(false); }
  }

  async function handlePhoneUpdate(values: Record<string, string>) {
    setPhoneSaving(true);
    try {
      const resp = await apiClient.put('/auth/profile/phone', values);
      if (resp.data && resp.data.ok) {
        message.success('手机号已更新');
        setShowPhoneEdit(false);
        phoneForm.resetFields();
        loadProfile();
      } else {
        message.error(resp.data.message || '更新失败');
      }
    } catch (e: any) {
      let detail = '更新失败';
      if (e?.response?.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    } finally { setPhoneSaving(false); }
  }

  if (loading) {
    return <Spin style={{ display: 'block', textAlign: 'center', padding: 80 }} size="large" />;
  }

  if (!profile) {
    return <div style={{ textAlign: 'center', padding: 40 }}>加载失败，请刷新重试</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={4}>
        <UserOutlined style={{ marginRight: 8 }} />
        个人信息
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={16}>
            <Descriptions column={1} size="middle">
              <Descriptions.Item label={<Space><IdcardOutlined />用户名</Space>}>{profile.username}</Descriptions.Item>
              <Descriptions.Item label={<Space><UserOutlined />姓名</Space>}>{profile.full_name}</Descriptions.Item>
              <Descriptions.Item label={<Space><PhoneOutlined />手机号</Space>}>
                {profile.phone || '未设置'}
                <Button
                  type="link"
                  size="small"
                  onClick={() => { setShowPhoneEdit(!showPhoneEdit); phoneForm.setFieldsValue({ phone: profile.phone || '' }); }}
                >
                  {profile.phone ? '修改' : '设置'}
                </Button>
              </Descriptions.Item>
              <Descriptions.Item label={<Space><MailOutlined />邮箱</Space>}>{profile.email || '未设置'}</Descriptions.Item>
              {profile.grade !== undefined && <Descriptions.Item label="年级">{profile.grade || '未设置'}</Descriptions.Item>}
              {profile.school !== undefined && <Descriptions.Item label="学校">{profile.school || '未设置'}</Descriptions.Item>}
              <Descriptions.Item label={<Space><ClockCircleOutlined />注册时间</Space>}>
                {profile.created_at ? profile.created_at.substring(0, 10) : '-'}
              </Descriptions.Item>
              {profile.last_login_at && (
                <Descriptions.Item label="最近登录">{profile.last_login_at.substring(0, 16)}</Descriptions.Item>
              )}
            </Descriptions>
          </Col>
          <Col span={8} style={{ textAlign: 'center', borderLeft: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 48, color: '#667eea', marginBottom: 8 }}>
              <UserOutlined />
            </div>
            <Title level={5} style={{ margin: 0 }}>{profile.full_name}</Title>
            <Tag color="blue" style={{ marginTop: 8 }}>{profile.role_label || profile.user_type}</Tag>
            <div style={{ marginTop: 16 }}>
              {!editing && <Button type="primary" icon={<SaveOutlined />} onClick={handleEdit}>编辑资料</Button>}
            </div>
          </Col>
        </Row>
      </Card>

      {profile.user_type === 'STUDENT' && (
        <Card
          title={<Space><LinkOutlined />家长绑定邀请码</Space>}
          style={{ marginBottom: 24 }}
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="邀请家长绑定后，家长可以查看你的学习进度、发送鼓励、设置奖励目标"
          />
          {inviteLoading ? (
            <Spin size="small" />
          ) : inviteCode ? (
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 20, textAlign: 'center' }}>
              <div style={{ color: '#52c41a', fontSize: 13, marginBottom: 8 }}>当前邀请码</div>
              <div style={{ fontSize: 36, fontWeight: 'bold', letterSpacing: 8, fontFamily: 'monospace', color: '#262626', marginBottom: 8 }}>
                {inviteCode}
              </div>
              <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 12 }}>
                有效期至 {inviteExpires ? inviteExpires.substring(0, 10) : '-'}
              </div>
              <Space>
                <Button icon={<CopyOutlined />} onClick={handleCopyCode}>复制</Button>
                <Button icon={<ReloadOutlined />} onClick={handleGenerateInviteCode} loading={inviteGenerating}>重新生成</Button>
              </Space>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ color: '#8c8c8c', marginBottom: 12 }}>还没有邀请码，点击下方按钮生成</div>
              <Button type="primary" icon={<LinkOutlined />} loading={inviteGenerating} onClick={handleGenerateInviteCode}>
                生成邀请码
              </Button>
            </div>
          )}
        </Card>
      )}

      {showPhoneEdit && (
        <Card title="修改手机号" size="small" style={{ marginBottom: 24 }}>
          <Form form={phoneForm} layout="inline" onFinish={handlePhoneUpdate}>
            <Form.Item name="phone" label="新手机号" rules={[{ required: true, pattern: /^\d{11}$/, message: '请输入11位手机号' }]}>
              <Input placeholder="请输入11位手机号" style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="sms_code" label="短信验证码" rules={[{ required: true }]}>
              <Input placeholder="测试环境输入111111" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={phoneSaving}>确认修改</Button>
            </Form.Item>
            <Form.Item>
              <Button onClick={() => setShowPhoneEdit(false)}>取消</Button>
            </Form.Item>
          </Form>
        </Card>
      )}

      {editing && (
        <Card title="编辑个人信息" size="small">
          <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 500 }}>
            <Form.Item name="full_name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '请输入有效邮箱' }]}>
              <Input placeholder="请输入邮箱" />
            </Form.Item>
            {profile.grade !== undefined && (
              <Form.Item name="grade" label="年级">
                <Input placeholder="如：八年级" />
              </Form.Item>
            )}
            {profile.school !== undefined && (
              <Form.Item name="school" label="学校">
                <Input placeholder="请输入学校名称" />
              </Form.Item>
            )}
            <Space>
              <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>保存</Button>
              <Button onClick={handleCancel}>取消</Button>
            </Space>
          </Form>
        </Card>
      )}
    </div>
  );
}
