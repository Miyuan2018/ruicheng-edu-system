import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Avatar, Dropdown, theme } from 'antd';
import {
  DashboardOutlined,
  QuestionCircleOutlined,
  FileTextOutlined,
  BookOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/auth';

const { Header, Sider, Content } = Layout;

const menuItems = {
  STUDENT: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '学习仪表盘' },
    { key: '/papers', icon: <FileTextOutlined />, label: '我的试卷' },
    { key: '/mistake-book', icon: <BookOutlined />, label: '错题本' },
  ],
  TEACHER: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '教学仪表盘' },
    { key: 'question-mgmt', icon: <QuestionCircleOutlined />, label: '试题管理', children: [
      { key: '/knowledge-tree', label: '知识树' },
      { key: '/syllabus', label: '考纲管理' },
      { key: '/question-admin', label: '智能出题' },
      { key: '/questions', label: '题库浏览' },
    ]},
    { key: '/papers', icon: <FileTextOutlined />, label: '试卷管理' },
    { key: '/teacher/classes', icon: <TeamOutlined />, label: '班级管理' },
    { key: 'stats-group', icon: <BarChartOutlined />, label: '答题统计', children: [
      { key: '/teacher/stats/paper', label: '试卷答题统计' },
      { key: '/teacher/stats/question', label: '试题答题统计' },
    ]},
  ],
  QUESTION_ADMIN: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '题库概览' },
    { key: 'question-mgmt', icon: <QuestionCircleOutlined />, label: '试题管理', children: [
      { key: '/knowledge-tree', label: '知识树' },
      { key: '/syllabus', label: '考纲管理' },
      { key: '/question-admin', label: '智能出题' },
      { key: '/questions', label: '题库浏览' },
    ]},
    { key: '/papers', icon: <FileTextOutlined />, label: '试卷管理' },
  ],
  SYS_ADMIN: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '系统概览' },
    { key: '/admin/sys-admin', icon: <UserOutlined />, label: '管理员账号' },
    { key: '/admin/config', icon: <SettingOutlined />, label: '系统配置' },
  ],
  ADMIN: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '系统概览' },
    { key: '/admin/users', icon: <TeamOutlined />, label: '用户管理' },
    { key: '/admin/sys-admin', icon: <UserOutlined />, label: '管理员账号' },
    { key: '/admin/config', icon: <SettingOutlined />, label: '系统配置' },
  ],
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(['question-mgmt', 'stats-group']);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();

  const userType = localStorage.getItem('user_type') || 'STUDENT';
  const userName = localStorage.getItem('user_name') || '用户';
  const role = userType;
  const items = menuItems[role] || menuItems.STUDENT;

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_name');
    navigate('/login');
  };

  const handleMenuClick = function (info: { key: string }) {
    // Only navigate for actual route paths (skip group keys like 'question-mgmt')
    if (info.key.startsWith('/')) {
      navigate(info.key);
    }
  };

  const handleUserMenuClick = function (info: { key: string }) {
    if (info.key === 'profile') {
      navigate('/profile');
    } else if (info.key === 'logout') {
      handleLogout();
    }
  };

  const userMenuItems = {
    items: [
      { key: 'profile', icon: React.createElement(UserOutlined), label: '个人信息' },
      { key: 'logout', icon: React.createElement(LogoutOutlined), label: '退出登录', danger: true },
    ],
    onClick: handleUserMenuClick,
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: themeToken.colorBgContainer }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: collapsed ? 14 : 18,
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          {collapsed ? 'RE' : '睿承教育'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={items}
          onClick={handleMenuClick}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: themeToken.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={userMenuItems} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} />
              <span>{userName}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: themeToken.colorBgContainer, borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
