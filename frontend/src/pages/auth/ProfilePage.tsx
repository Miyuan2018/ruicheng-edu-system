import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Tag, Descriptions, Space, message, Row, Col, Divider, Spin } from 'antd';
import { UserOutlined, PhoneOutlined, MailOutlined, IdcardOutlined, ClockCircleOutlined, SaveOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

var Title = Typography.Title;

export default function ProfilePage() {
  var profileState = useState(null); var profile = profileState[0]; var setProfile = profileState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];
  var editingState = useState(false); var editing = editingState[0]; var setEditing = editingState[1];
  var savingState = useState(false); var saving = savingState[0]; var setSaving = savingState[1];
  var phoneModalState = useState(false); var showPhoneEdit = phoneModalState[0]; var setShowPhoneEdit = phoneModalState[1];
  var phoneSavingState = useState(false); var phoneSaving = phoneSavingState[0]; var setPhoneSaving = phoneSavingState[1];
  var form = Form.useForm()[0];
  var phoneForm = Form.useForm()[0];

  useEffect(function () { loadProfile(); }, []);

  function loadProfile() {
    setLoading(true);
    apiClient.get('/auth/profile').then(function (resp) {
      var data = resp.data;
      if (data && data.ok) { setProfile(data.data); }
      else { setProfile(data); }
    }).catch(function () { message.error('加载个人信息失败'); })
    .finally(function () { setLoading(false); });
  }

  function handleEdit() {
    form.setFieldsValue({
      full_name: profile.full_name,
      email: profile.email || '',
      grade: profile.grade || '',
      school: profile.school || '',
    });
    setEditing(true);
  }

  function handleCancel() { setEditing(false); }

  async function handleSave(values) {
    setSaving(true);
    try {
      var resp = await apiClient.put('/auth/profile', values);
      if (resp.data && resp.data.ok) {
        message.success('个人信息已更新');
        // Update local storage for display name
        if (values.full_name) {
          localStorage.setItem('user_name', values.full_name);
        }
        loadProfile();
        setEditing(false);
      } else {
        message.error(resp.data.message || '更新失败');
      }
    } catch (e) {
      var detail = '更新失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    } finally { setSaving(false); }
  }

  async function handlePhoneUpdate(values) {
    setPhoneSaving(true);
    try {
      var resp = await apiClient.put('/auth/profile/phone', values);
      if (resp.data && resp.data.ok) {
        message.success('手机号已更新');
        setShowPhoneEdit(false);
        phoneForm.resetFields();
        loadProfile();
      } else {
        message.error(resp.data.message || '更新失败');
      }
    } catch (e) {
      var detail = '更新失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    } finally { setPhoneSaving(false); }
  }

  if (loading) {
    return React.createElement(Spin, { style: { display: 'block', textAlign: 'center', padding: 80 }, size: 'large' });
  }

  if (!profile) {
    return React.createElement('div', { style: { textAlign: 'center', padding: 40 } }, '加载失败，请刷新重试');
  }

  return React.createElement('div', { style: { maxWidth: 800, margin: '0 auto' } },
    React.createElement(Title, { level: 4 },
      React.createElement(UserOutlined, { style: { marginRight: 8 } }), '个人信息'
    ),

    // Profile card
    React.createElement(Card, { style: { marginBottom: 24 } },
      React.createElement(Row, { gutter: 24 },
        React.createElement(Col, { span: 16 },
          React.createElement(Descriptions, { column: 1, size: 'middle' },
            React.createElement(Descriptions.Item, { label: React.createElement(Space, null, React.createElement(IdcardOutlined, null), '用户名') }, profile.username),
            React.createElement(Descriptions.Item, { label: React.createElement(Space, null, React.createElement(UserOutlined, null), '姓名') }, profile.full_name),
            React.createElement(Descriptions.Item, { label: React.createElement(Space, null, React.createElement(PhoneOutlined, null), '手机号') },
              profile.phone || '未设置',
              React.createElement(Button, { type: 'link', size: 'small', onClick: function () { setShowPhoneEdit(!showPhoneEdit); phoneForm.setFieldsValue({ phone: profile.phone || '' }); } }, profile.phone ? '修改' : '设置')
            ),
            React.createElement(Descriptions.Item, { label: React.createElement(Space, null, React.createElement(MailOutlined, null), '邮箱') }, profile.email || '未设置'),
            profile.grade !== undefined ? React.createElement(Descriptions.Item, { label: '年级' }, profile.grade || '未设置') : null,
            profile.school !== undefined ? React.createElement(Descriptions.Item, { label: '学校' }, profile.school || '未设置') : null,
            React.createElement(Descriptions.Item, { label: React.createElement(Space, null, React.createElement(ClockCircleOutlined, null), '注册时间') }, profile.created_at ? profile.created_at.substring(0, 10) : '-'),
            profile.last_login_at ? React.createElement(Descriptions.Item, { label: '最近登录' }, profile.last_login_at.substring(0, 16)) : null
          )
        ),
        React.createElement(Col, { span: 8, style: { textAlign: 'center', borderLeft: '1px solid #f0f0f0' } },
          React.createElement('div', { style: { fontSize: 48, color: '#667eea', marginBottom: 8 } }, React.createElement(UserOutlined, null)),
          React.createElement(Title, { level: 5, style: { margin: 0 } }, profile.full_name),
          React.createElement(Tag, { color: 'blue', style: { marginTop: 8 } }, profile.role_label || profile.user_type),
          React.createElement('div', { style: { marginTop: 16 } },
            editing ? null : React.createElement(Button, { type: 'primary', icon: React.createElement(SaveOutlined), onClick: handleEdit }, '编辑资料')
          )
        )
      )
    ),

    // Phone edit section
    showPhoneEdit ? React.createElement(Card, { title: '修改手机号', size: 'small', style: { marginBottom: 24 } },
      React.createElement(Form, { form: phoneForm, layout: 'inline', onFinish: handlePhoneUpdate },
        React.createElement(Form.Item, { name: 'phone', label: '新手机号', rules: [{ required: true, pattern: /^\d{11}$/, message: '请输入11位手机号' }] },
          React.createElement(Input, { placeholder: '请输入11位手机号', style: { width: 160 } })
        ),
        React.createElement(Form.Item, { name: 'sms_code', label: '短信验证码', rules: [{ required: true }] },
          React.createElement(Input, { placeholder: '测试环境输入111111', style: { width: 180 } })
        ),
        React.createElement(Form.Item, null,
          React.createElement(Button, { type: 'primary', htmlType: 'submit', loading: phoneSaving }, '确认修改')
        ),
        React.createElement(Form.Item, null,
          React.createElement(Button, { onClick: function () { setShowPhoneEdit(false); } }, '取消')
        )
      )
    ) : null,

    // Edit form
    editing ? React.createElement(Card, { title: '编辑个人信息', size: 'small' },
      React.createElement(Form, { form: form, layout: 'vertical', onFinish: handleSave, style: { maxWidth: 500 } },
        React.createElement(Form.Item, { name: 'full_name', label: '姓名', rules: [{ required: true, message: '请输入姓名' }] },
          React.createElement(Input, { placeholder: '请输入姓名' })
        ),
        React.createElement(Form.Item, { name: 'email', label: '邮箱', rules: [{ type: 'email', message: '请输入有效邮箱' }] },
          React.createElement(Input, { placeholder: '请输入邮箱' })
        ),
        profile.grade !== undefined ? React.createElement(Form.Item, { name: 'grade', label: '年级' },
          React.createElement(Input, { placeholder: '如：八年级' })
        ) : null,
        profile.school !== undefined ? React.createElement(Form.Item, { name: 'school', label: '学校' },
          React.createElement(Input, { placeholder: '请输入学校名称' })
        ) : null,
        React.createElement(Space, null,
          React.createElement(Button, { type: 'primary', htmlType: 'submit', loading: saving, icon: React.createElement(SaveOutlined) }, '保存'),
          React.createElement(Button, { onClick: handleCancel }, '取消')
        )
      )
    ) : null
  );
}
