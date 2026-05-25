import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Tabs, Space, Steps, Select } from 'antd';
import { UserOutlined, PhoneOutlined, BankOutlined, BookOutlined, SafetyOutlined, MobileOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';

const { Title } = Typography;

export default function LoginPage() {
  const { 'grade-levels': grades } = useReferenceValues();
  const [loading, setLoading] = useState(false);
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaKey, setCaptchaKey] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [form] = Form.useForm();

  // Registration state
  const [regStep, setRegStep] = useState(0);
  const [regPhone, setRegPhone] = useState('');
  const [regSmsVerified, setRegSmsVerified] = useState(false);
  const [regCountdown, setRegCountdown] = useState(0);
  const [regCaptchaSvg, setRegCaptchaSvg] = useState('');
  const [regCaptchaKey, setRegCaptchaKey] = useState('');
  const [regForm] = Form.useForm();

  const navigate = useNavigate();

  const refreshCaptcha = async () => {
    try { const { data } = await apiClient.get('/auth/captcha'); setCaptchaSvg(data.captcha_svg); setCaptchaKey(data.captcha_key); } catch {}
  };
  const refreshRegCaptcha = async () => {
    try { const { data } = await apiClient.get('/auth/captcha'); setRegCaptchaSvg(data.captcha_svg); setRegCaptchaKey(data.captcha_key); } catch {}
  };

  useEffect(() => { refreshCaptcha(); refreshRegCaptcha(); }, []);
  useEffect(() => {
    if (countdown > 0) { const t = setTimeout(() => setCountdown(countdown - 1), 1000); return () => clearTimeout(t); }
  }, [countdown]);
  useEffect(() => {
    if (regCountdown > 0) { const t = setTimeout(() => setRegCountdown(regCountdown - 1), 1000); return () => clearTimeout(t); }
  }, [regCountdown]);

  // ─── Login ──────────────────────────────────
  const handleSendSms = () => {
    if (!form.getFieldValue('captcha_code')) { message.warning('请先输入图形验证码'); return; }
    setSmsSent(true); setSmsCode('111111'); setCountdown(60);
    message.success('短信验证码已发送 (占位码: 111111)');
  };

  const handleLogin = async (values: any) => {
    if (!smsSent) { message.warning('请先获取短信验证码'); return; }
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/student/login', {
        username: values.username, captcha_key: captchaKey, captcha_code: values.captcha_code, sms_code: smsCode,
      });
      localStorage.setItem('access_token', data.access_token); localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_type', 'STUDENT'); localStorage.setItem('user_name', data.full_name);
      localStorage.setItem('user_id', data.user_id);
      localStorage.setItem('user_id', data.user_id);
      message.success(`欢迎, ${data.full_name}`); navigate('/dashboard');
    } catch (err: any) { message.error(err?.response?.data?.detail || '登录失败'); refreshCaptcha(); setSmsSent(false); } finally { setLoading(false); }
  };

  // ─── Register ───────────────────────────────
  const handleRegSendSms = () => {
    const phone = regForm.getFieldValue('phone');
    if (!phone || phone.length !== 11) { message.warning('请输入正确的11位手机号'); return; }
    if (!regForm.getFieldValue('captcha_code')) { message.warning('请先输入图形验证码'); return; }
    setRegPhone(phone);
    setRegCountdown(60);
    message.success('短信验证码已发送 (占位码: 111111)');
  };

  const handleVerifySms = () => {
    const sms = regForm.getFieldValue('sms_code');
    if (sms === '111111') {
      setRegSmsVerified(true);
      setRegStep(1);
      message.success('手机验证通过');
    } else {
      message.error('验证码错误');
    }
  };

  const handleRegSubmit = async (values: any) => {
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/student/register', {
        phone: regPhone,
        sms_code: values.sms_code || '111111',
        full_name: values.full_name,
        grade: values.grade,
        school: values.school,
      });
      localStorage.setItem('access_token', data.access_token); localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_type', 'STUDENT'); localStorage.setItem('user_name', data.full_name);
      localStorage.setItem('user_id', data.user_id);
      message.success('注册成功'); navigate('/dashboard');
    } catch (err: any) { message.error(err?.response?.data?.detail || '注册失败'); } finally { setLoading(false); }
  };

  // ─── Login Form ─────────────────────────────
  const loginForm = (
    <>
      <Steps current={smsSent ? 2 : 1} size="small" style={{ marginBottom: 20 }}
        items={[{ title: '身份验证' }, { title: '短信验证' }, { title: '登录' }]} />
      <Form.Item name="username" rules={[{ required: true, message: '请输入用户名或手机号' }]}>
        <Input prefix={<UserOutlined />} placeholder="用户名或手机号" size="large" />
      </Form.Item>
      <Form.Item name="captcha_code" rules={[{ required: true, message: '请输入验证码' }]}>
        <Space.Compact style={{ width: '100%' }}>
          <Input prefix={<SafetyOutlined />} placeholder="图形验证码" style={{ flex: 1 }} size="large" />
          <div onClick={refreshCaptcha} style={{ cursor: 'pointer', height: 40, width: 120, border: '1px solid #d9d9d9', borderRadius: 6 }}>
            {captchaSvg && <img src={captchaSvg} width="120" height="40" alt="验证码" />}
          </div>
        </Space.Compact>
      </Form.Item>
      <Form.Item>
        <Button icon={<MobileOutlined />} onClick={handleSendSms} disabled={countdown > 0} block size="large">
          {countdown > 0 ? `${countdown}秒后重发` : smsSent ? '重新获取验证码' : '获取短信验证码'}
        </Button>
      </Form.Item>
      {smsSent && (
        <Form.Item name="sms_code" initialValue="111111">
          <Input prefix={<MobileOutlined />} placeholder="短信验证码" size="large" />
        </Form.Item>
      )}
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block size="large" disabled={!smsSent}>登录</Button>
      </Form.Item>
    </>
  );

  // ─── Register Form ──────────────────────────
  const registerForm = (
    <>
      <Steps current={regStep} size="small" style={{ marginBottom: 24 }}
        items={[{ title: '手机验证' }, { title: '填写信息' }, { title: '完成' }]} />

      {regStep === 0 && (
        <>
          <Form.Item name="phone" rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的11位手机号' }
          ]}>
            <Input prefix={<PhoneOutlined />} placeholder="手机号" size="large" maxLength={11} />
          </Form.Item>
          <Form.Item name="captcha_code" rules={[{ required: true, message: '请输入图形验证码' }]}>
            <Space.Compact style={{ width: '100%' }}>
              <Input prefix={<SafetyOutlined />} placeholder="图形验证码" style={{ flex: 1 }} size="large" />
              <div onClick={refreshRegCaptcha} style={{ cursor: 'pointer', height: 40, width: 120, border: '1px solid #d9d9d9', borderRadius: 6 }}>
                {regCaptchaSvg && <img src={regCaptchaSvg} width="120" height="40" alt="验证码" />}
              </div>
            </Space.Compact>
          </Form.Item>
          <Form.Item>
            <Button icon={<MobileOutlined />} onClick={handleRegSendSms} disabled={regCountdown > 0} block size="large">
              {regCountdown > 0 ? `${regCountdown}秒后重发` : '获取短信验证码'}
            </Button>
          </Form.Item>
          <Form.Item name="sms_code" rules={[{ required: true }]}>
            <Input prefix={<MobileOutlined />} placeholder="输入短信验证码" size="large" maxLength={6} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleVerifySms} block size="large">验证手机号</Button>
          </Form.Item>
        </>
      )}

      {regStep === 1 && (
        <>
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f6ffed', borderRadius: 6 }}>
            <PhoneOutlined style={{ color: '#52c41a' }} /> 手机号 {regPhone} 已验证
          </div>
          <Form.Item name="full_name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input prefix={<UserOutlined />} placeholder="姓名" size="large" />
          </Form.Item>
          <Form.Item name="grade" rules={[{ required: true, message: '请选择年级' }]}>
            <Select placeholder="选择年级" size="large" options={toSelectOptions(grades)} />
          </Form.Item>
          <Form.Item name="school" rules={[{ required: true, message: '请输入学校名称' }]}>
            <Input prefix={<BankOutlined />} placeholder="学校名称" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">完成注册</Button>
          </Form.Item>
        </>
      )}
    </>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card style={{ width: 440, borderRadius: 12 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>睿承教育平台</Title>
        <Tabs centered items={[
          { key: 'login', label: '学生登录', children: <Form form={form} onFinish={handleLogin} size="large">{loginForm}</Form> },
          { key: 'register', label: '学生注册', children: <Form form={regForm} onFinish={handleRegSubmit} size="large">{registerForm}</Form> },
        ]} />
      </Card>
    </div>
  );
}
