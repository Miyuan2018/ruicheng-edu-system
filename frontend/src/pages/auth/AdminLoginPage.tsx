import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Space, Steps, Select, Tag } from 'antd';
import { LockOutlined, UserOutlined, SafetyOutlined, MobileOutlined, IdcardOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/auth';

const { Title, Text } = Typography;

const getErrMsg = (err: any, fallback: string): string => {
  const data = err?.response?.data;
  // FastAPI HTTPException 返回 { detail: "..." }
  if (typeof data?.detail === 'string') return data.detail;
  // 普通字符串
  if (typeof data?.message === 'string') return data.message;
  // 网络断开
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') return '网络连接失败，请检查后端服务是否已启动';
  // 超时
  if (err?.code === 'ECONNABORTED') return '请求超时，请稍后重试';
  return fallback;
};

const ROLE_MAP: Record<string, string> = {
  TEACHER: '教师', QUESTION_ADMIN: '题库管理员', SYS_ADMIN: '系统管理员',
};

export default function AdminLoginPage() {
  const [step, setStep] = useState(0); // 0=verify, 1=sms+login
  const [loading, setLoading] = useState(false);
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaKey, setCaptchaKey] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [verified, setVerified] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [userInfo, setUserInfo] = useState<{ user_type: string; full_name: string } | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const refreshCaptcha = async () => {
    try { const { data } = await apiClient.get('/auth/captcha'); setCaptchaSvg(data.captcha_svg); setCaptchaKey(data.captcha_key); } catch {}
  };

  useEffect(() => { refreshCaptcha(); }, []);
  useEffect(() => {
    if (countdown > 0) { const t = setTimeout(() => setCountdown(countdown - 1), 1000); return () => clearTimeout(t); }
  }, [countdown]);

  const handleVerify = async (values: any) => {
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/admin/verify', {
        username: values.username, password: values.password,
        captcha_key: captchaKey, captcha_code: values.captcha_code, role: values.role,
      });
      setVerified(true);
      setVerifyToken(data.verify_token);
      setUserInfo({ user_type: data.user_type, full_name: data.full_name });
      setStep(1);
      message.success(data.message || '验证通过');
    } catch (err: any) {
      message.error(getErrMsg(err, '身份验证失败，请检查用户名、密码和验证码'));
      refreshCaptcha();
      form.setFieldValue('captcha_code', '');
    } finally { setLoading(false); }
  };

  const handleSendSms = () => {
    setCountdown(60);
    message.success('短信验证码已发送 (占位码: 111111)');
  };

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/admin/login', {
        username: values.username, password: values.password,
        captcha_key: captchaKey, captcha_code: values.captcha_code,
        sms_code: values.sms_code, role: values.role,
        verify_token: verifyToken,
      });
      setAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_type: data.user_type,
        user_name: data.full_name,
        user_id: data.user_id,
      });
      message.success(`欢迎, ${data.full_name}`);
      const routes: Record<string, string> = {
        SYS_ADMIN: '/admin/sys-admin', TEACHER: '/dashboard', QUESTION_ADMIN: '/question-admin',
      };
      navigate(routes[data.user_type] || '/dashboard');
    } catch (err: any) {
      message.error(getErrMsg(err, '登录失败，请重试'));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <Card style={{ width: 460, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 4, color: '#1a1a2e' }}>睿承教育平台</Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>管理端登录</Text>

        <Steps current={step} size="small" style={{ marginBottom: 24 }}
          items={[{ title: '验证身份' }, { title: '短信验证登录' }]} />

        {verified && userInfo && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#e6f7ff', borderRadius: 6, border: '1px solid #91d5ff' }}>
            <IdcardOutlined style={{ color: '#1890ff' }} /> {userInfo.full_name}
            <Tag color="blue" style={{ marginLeft: 8 }}>{ROLE_MAP[userInfo.user_type] || userInfo.user_type}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}> 身份已验证</Text>
          </div>
        )}

        <Form form={form} onFinish={step === 0 ? handleVerify : handleLogin} size="large"
          initialValues={{ role: 0 }}>

          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select disabled={verified} options={[
              { value: 0, label: '教师（默认）' },
              { value: 1, label: '题库管理员' },
              { value: 2, label: '系统管理员' },
            ]} />
          </Form.Item>

          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名或手机号' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名或手机号" disabled={verified} />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" disabled={verified} />
          </Form.Item>

          <Form.Item name="captcha_code" rules={[{ required: step === 0, message: '请输入图形验证码' }]}>
            <Space.Compact style={{ width: '100%' }}>
              <Input prefix={<SafetyOutlined />} placeholder="图形验证码" style={{ flex: 1 }} disabled={verified} />
              <div onClick={verified ? undefined : refreshCaptcha} style={{
                cursor: verified ? 'default' : 'pointer', height: 40, width: 120,
                border: '1px solid #d9d9d9', borderRadius: 6, opacity: verified ? 0.5 : 1,
              }}>
                {captchaSvg && <img src={captchaSvg} width="120" height="40" alt="验证码" />}
              </div>
            </Space.Compact>
          </Form.Item>

          {/* Step 0: Verify button */}
          {step === 0 && (
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>验证身份</Button>
            </Form.Item>
          )}

          {/* Step 1: SMS button + input on same row */}
          <Form.Item name="sms_code" rules={[
            { required: step === 1, message: '请输入短信验证码' },
            { pattern: /^\d{6}$/, message: '验证码为6位数字' },
          ]}>
            <Space.Compact style={{ width: '100%' }}>
              <Button icon={<MobileOutlined />} onClick={handleSendSms}
                disabled={!verified || countdown > 0}
                style={{ width: 130, height: 40 }}>
                {!verified ? '获取验证码' :
                  countdown > 0 ? `${countdown}秒` : '获取验证码'}
              </Button>
              <Input prefix={<MobileOutlined />} placeholder="输入短信验证码" maxLength={6}
                style={{ flex: 1, height: 40 }}
                disabled={!verified} />
            </Space.Compact>
          </Form.Item>

          {/* Step 1: Login button */}
          {step === 1 && (
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>管理员登录</Button>
            </Form.Item>
          )}
        </Form>
      </Card>
    </div>
  );
}
