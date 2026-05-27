import React, { useState, useRef, useCallback } from 'react';
import { Form, Input, Button, Card, Typography, message, Tabs } from 'antd';
import { PhoneOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/auth';

const { Title } = Typography;
type AnyObj = Record<string, any>;

const ParentLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s: any) => s.setAuth);

  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  const [loginCountdown, setLoginCountdown] = useState(0);
  const [registerCountdown, setRegisterCountdown] = useState(0);

  const loginTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const registerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(
    (type: 'login' | 'register') => {
      const isLogin = type === 'login';
      const setCountdown = isLogin ? setLoginCountdown : setRegisterCountdown;
      const timerRef = isLogin ? loginTimerRef : registerTimerRef;

      if (timerRef.current) return;

      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((prev: number) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [],
  );

  const handleSendLoginSms = async () => {
    try {
      const phone = loginForm.getFieldValue('phone');
      if (!phone || !/^1\d{10}$/.test(phone)) {
        message.warning('请输入正确的11位手机号');
        return;
      }
      message.success('短信验证码已发送 (占位码: 111111)');
      loginForm.setFieldsValue({ sms_code: '111111' });
      startCountdown('login');
    } catch {
      // validation handled by form
    }
  };

  const handleSendRegisterSms = async () => {
    try {
      const phone = registerForm.getFieldValue('phone');
      if (!phone || !/^1\d{10}$/.test(phone)) {
        message.warning('请输入正确的11位手机号');
        return;
      }
      message.success('短信验证码已发送 (占位码: 111111)');
      registerForm.setFieldsValue({ sms_code: '111111' });
      startCountdown('register');
    } catch {
      // validation handled by form
    }
  };

  const handleLogin = async (values: AnyObj) => {
    setLoginLoading(true);
    try {
      const res = await apiClient.post('/auth/parent/login', {
        phone: values.phone,
        sms_code: values.sms_code,
      });
      const data = res.data ?? res;
      setAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_type: 'PARENT',
        user_name: data.full_name,
        user_id: data.user_id,
      });
      message.success('登录成功');
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || '登录失败，请重试';
      message.error(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (values: AnyObj) => {
    setRegisterLoading(true);
    try {
      const res = await apiClient.post('/auth/parent/register', {
        phone: values.phone,
        sms_code: values.sms_code,
        full_name: values.full_name,
      });
      const data = res.data ?? res;
      setAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_type: 'PARENT',
        user_name: data.full_name,
        user_id: data.user_id,
      });
      message.success('注册成功');
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || '注册失败，请重试';
      message.error(msg);
    } finally {
      setRegisterLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'login',
      label: '登录',
      children: (
        <Form form={loginForm} onFinish={handleLogin} layout="vertical" size="large">
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '请输入正确的11位手机号' },
            ]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="手机号" maxLength={11} />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item
                name="sms_code"
                noStyle
                rules={[{ required: true, message: '请输入验证码' }]}
              >
                <Input prefix={<SafetyOutlined />} placeholder="验证码" maxLength={6} />
              </Form.Item>
              <Button
                onClick={handleSendLoginSms}
                disabled={loginCountdown > 0}
                style={{ minWidth: 120 }}
              >
                {loginCountdown > 0 ? `${loginCountdown}s` : '获取验证码'}
              </Button>
            </div>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loginLoading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'register',
      label: '注册',
      children: (
        <Form form={registerForm} onFinish={handleRegister} layout="vertical" size="large">
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '请输入正确的11位手机号' },
            ]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="手机号" maxLength={11} />
          </Form.Item>

          <Form.Item
            name="full_name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="姓名" maxLength={20} />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item
                name="sms_code"
                noStyle
                rules={[{ required: true, message: '请输入验证码' }]}
              >
                <Input prefix={<SafetyOutlined />} placeholder="验证码" maxLength={6} />
              </Form.Item>
              <Button
                onClick={handleSendRegisterSms}
                disabled={registerCountdown > 0}
                style={{ minWidth: 120 }}
              >
                {registerCountdown > 0 ? `${registerCountdown}s` : '获取验证码'}
              </Button>
            </div>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={registerLoading} block>
              注册
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card style={{ width: 420, borderRadius: 8 }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 0 }}>
            睿承教育 - 家长登录
          </Title>
        </div>
        <Tabs items={tabItems} centered />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="link" onClick={() => navigate('/login')}>← 返回学生登录</Button>
        </div>
      </Card>
    </div>
  );
};

export default ParentLoginPage;
