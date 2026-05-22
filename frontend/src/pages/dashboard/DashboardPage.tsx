import React, { useState, useEffect } from 'react';
import { Card, Typography, Statistic, Row, Col, Table, Tag, Spin, Space } from 'antd';
import {
  BookOutlined, CheckCircleOutlined, FileTextOutlined, TrophyOutlined,
  QuestionCircleOutlined, ApartmentOutlined, RobotOutlined, ClockCircleOutlined,
  TeamOutlined, BarChartOutlined,
} from '@ant-design/icons';
import apiClient from '../../api/client';

var Title = Typography.Title;

export default function DashboardPage() {
  var userType = localStorage.getItem('user_type') || 'STUDENT';
  var role = userType;

  var statsState = useState(null); var stats = statsState[0]; var setStats = statsState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];
  // Teacher dashboard data (loaded at top level to avoid conditional hooks)
  var teacherClassesState = useState([]); var teacherClasses = teacherClassesState[0]; var setTeacherClasses = teacherClassesState[1];
  var teacherPapersState = useState([]); var teacherPapers = teacherPapersState[0]; var setTeacherPapers = teacherPapersState[1];
  var teacherDashLoadingState = useState(true); var teacherDashLoading = teacherDashLoadingState[0]; var setTeacherDashLoading = teacherDashLoadingState[1];

  useEffect(function () {
    if (role === 'QUESTION_ADMIN') {
      loadStats();
    } else if (role === 'TEACHER') {
      loadTeacherStats();
    } else {
      setLoading(false);
    }
  }, [role]);

  function loadStats() {
    setLoading(true);
    Promise.all([
      apiClient.get('/questions', { params: { limit: 1 } }).catch(function () { return { data: [] }; }),
      apiClient.get('/exam-papers', { params: { limit: 1 } }).catch(function () { return { data: [] }; }),
      apiClient.get('/question-admin/pending').catch(function () { return { data: [] }; }),
    ]).then(function (results) {
      setStats({
        questionCount: '...',
        paperCount: '...',
        pendingCount: (results[2].data || []).length,
      });
    }).finally(function () { setLoading(false); });
  }

  function loadTeacherStats() {
    setTeacherDashLoading(true);
    Promise.all([
      apiClient.get('/classes').catch(function () { return { data: [] }; }),
      apiClient.get('/teacher/stats/papers').catch(function () { return { data: [] }; }),
    ]).then(function (results) {
      var cls = results[0].data || [];
      var pps = results[1].data || [];
      setTeacherClasses(Array.isArray(cls) ? cls : []);
      setTeacherPapers(Array.isArray(pps) ? pps : []);
    }).finally(function () { setTeacherDashLoading(false); });
  }

  if (loading && role !== 'TEACHER') return React.createElement(Spin, { style: { display: 'block', textAlign: 'center', padding: 80 } });

  // ── STUDENT dashboard ──
  if (role === 'STUDENT') {
    return React.createElement('div', null,
      React.createElement(Title, { level: 4 }, '学习仪表盘'),
      React.createElement(Row, { gutter: [16, 16] },
        React.createElement(Col, { xs: 24, sm: 12, lg: 6 },
          React.createElement(Card, null, React.createElement(Statistic, { title: '已完成试卷', value: 12, prefix: React.createElement(FileTextOutlined) }))
        ),
        React.createElement(Col, { xs: 24, sm: 12, lg: 6 },
          React.createElement(Card, null, React.createElement(Statistic, { title: '正确率', value: 85.5, suffix: '%', prefix: React.createElement(CheckCircleOutlined) }))
        ),
        React.createElement(Col, { xs: 24, sm: 12, lg: 6 },
          React.createElement(Card, null, React.createElement(Statistic, { title: '错题数量', value: 23, prefix: React.createElement(BookOutlined) }))
        ),
        React.createElement(Col, { xs: 24, sm: 12, lg: 6 },
          React.createElement(Card, null, React.createElement(Statistic, { title: '最高分', value: 98, prefix: React.createElement(TrophyOutlined) }))
        )
      )
    );
  }

  // ── TEACHER dashboard ──
  if (role === 'TEACHER') {
    var totalStudents = teacherClasses.reduce(function (s, c) { return s + (c.student_count || 0); }, 0);
    var activeClasses = teacherClasses.filter(function (c) { return c.is_active; }).length;

    return React.createElement('div', null,
      React.createElement(Title, { level: 4 }, '教学仪表盘'),

      // Stats row
      React.createElement(Row, { gutter: [16, 16], style: { marginBottom: 24 } },
        React.createElement(Col, { xs: 24, sm: 12, md: 6 },
          React.createElement(Card, { style: { background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 12 } },
            React.createElement(Statistic, { title: React.createElement('span', { style: { color: 'rgba(255,255,255,0.85)' } }, '班级'), value: teacherClasses.length, valueStyle: { color: '#fff', fontSize: 32 },
              prefix: React.createElement(TeamOutlined, { style: { color: 'rgba(255,255,255,0.7)' } }),
              suffix: React.createElement('span', { style: { fontSize: 14, color: 'rgba(255,255,255,0.6)' } }, '启用' + activeClasses)
            })
          )
        ),
        React.createElement(Col, { xs: 24, sm: 12, md: 6 },
          React.createElement(Card, { style: { background: 'linear-gradient(135deg, #f093fb, #f5576c)', borderRadius: 12 } },
            React.createElement(Statistic, { title: React.createElement('span', { style: { color: 'rgba(255,255,255,0.85)' } }, '学生'), value: totalStudents, valueStyle: { color: '#fff', fontSize: 32 },
              prefix: React.createElement(TeamOutlined, { style: { color: 'rgba(255,255,255,0.7)' } })
            })
          )
        ),
        React.createElement(Col, { xs: 24, sm: 12, md: 6 },
          React.createElement(Card, { style: { background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: 12 } },
            React.createElement(Statistic, { title: React.createElement('span', { style: { color: 'rgba(255,255,255,0.85)' } }, '试卷'), value: teacherPapers.length, valueStyle: { color: '#fff', fontSize: 32 },
              prefix: React.createElement(FileTextOutlined, { style: { color: 'rgba(255,255,255,0.7)' } })
            })
          )
        ),
        React.createElement(Col, { xs: 24, sm: 12, md: 6 },
          React.createElement(Card, { style: { background: 'linear-gradient(135deg, #43e97b, #38f9d7)', borderRadius: 12 } },
            React.createElement(Statistic, { title: React.createElement('span', { style: { color: 'rgba(255,255,255,0.85)' } }, '题库'), value: 110, valueStyle: { color: '#fff', fontSize: 32 },
              prefix: React.createElement(QuestionCircleOutlined, { style: { color: 'rgba(255,255,255,0.7)' } })
            })
          )
        )
      ),

      React.createElement(Row, { gutter: [16, 16] },
        // Left: Class list
        React.createElement(Col, { xs: 24, lg: 14 },
          React.createElement(Card, { title: React.createElement(Space, null, React.createElement(TeamOutlined, null), '我的班级'),
            extra: React.createElement('a', { href: '/teacher/classes' }, '管理班级 →'),
            style: { marginBottom: 16 }
          },
            teacherDashLoading ? React.createElement(Spin, null)
            : teacherClasses.length === 0 ? React.createElement('div', { style: { textAlign: 'center', padding: 24, color: '#999' } },
                '暂无班级，', React.createElement('a', { href: '/teacher/classes' }, '去创建'))
            : React.createElement(Table, { rowKey: 'id', size: 'small', dataSource: teacherClasses.slice(0, 5), pagination: false,
                columns: [
                  { title: '班级名称', dataIndex: 'name', ellipsis: true,
                    render: function (t, r) { return React.createElement('a', { href: '/teacher/classes' }, t); }
                  },
                  { title: '学科', dataIndex: 'subject', width: 60 },
                  { title: '年级', dataIndex: 'grade_level', width: 70 },
                  { title: '学生', dataIndex: 'student_count', width: 50, align: 'center' },
                  { title: '状态', dataIndex: 'is_active', width: 60, render: function (v) {
                    return React.createElement(Tag, { color: v ? 'green' : 'default' }, v ? '启用' : '停用');
                  }},
                ]
              })
          ),
          // Papers table
          React.createElement(Card, { title: React.createElement(Space, null, React.createElement(FileTextOutlined, null), '我的试卷'),
            extra: React.createElement('a', { href: '/papers' }, '全部试卷 →'),
          },
            teacherDashLoading ? React.createElement(Spin, null)
            : teacherPapers.length === 0 ? React.createElement('div', { style: { textAlign: 'center', padding: 24, color: '#999' } },
                '暂无试卷，', React.createElement('a', { href: '/papers' }, '去创建'))
            : React.createElement(Table, { rowKey: 'id', size: 'small', dataSource: teacherPapers.slice(0, 5), pagination: false,
                columns: [
                  { title: '试卷名称', dataIndex: 'title', ellipsis: true, render: function (t, r) {
                    return React.createElement('a', { href: '/papers' }, t);
                  }},
                  { title: '学科', dataIndex: 'subject', width: 60 },
                  { title: '年级', dataIndex: 'grade_level', width: 70 },
                  { title: '总分', dataIndex: 'total_score', width: 60, align: 'center' },
                  { title: '状态', dataIndex: 'status', width: 70, render: function (s) {
                    return React.createElement(Tag, { color: s === 'PUBLISHED' ? 'green' : 'default' }, s === 'PUBLISHED' ? '已发布' : '草稿');
                  }},
                ]
              })
          )
        ),
        // Right: Quick actions
        React.createElement(Col, { xs: 24, lg: 10 },
          React.createElement(Card, { title: '快捷操作', style: { marginBottom: 16 } },
            React.createElement(Row, { gutter: [12, 12] },
              [{ href: '/papers', icon: React.createElement(FileTextOutlined), color: '#667eea', bg: '#f0f5ff', label: '新建试卷', desc: '创建在线试卷' },
               { href: '/question-admin', icon: React.createElement(RobotOutlined), color: '#fa8c16', bg: '#fff7e6', label: '智能出题', desc: 'AI生成试题' },
               { href: '/teacher/classes', icon: React.createElement(TeamOutlined), color: '#52c41a', bg: '#f6ffed', label: '班级管理', desc: '管理学生班级' },
               { href: '/teacher/stats/paper', icon: React.createElement(BarChartOutlined), color: '#1890ff', bg: '#e6f7ff', label: '答题统计', desc: '查看学生成绩' },
               { href: '/syllabus', icon: React.createElement(ApartmentOutlined), color: '#722ed1', bg: '#f9f0ff', label: '考纲管理', desc: '创建知识考纲' },
               { href: '/questions', icon: React.createElement(QuestionCircleOutlined), color: '#eb2f96', bg: '#fff0f6', label: '题库浏览', desc: '浏览所有试题' },
              ].map(function (item) {
                return React.createElement(Col, { span: 12, key: item.label },
                  React.createElement('a', { href: item.href, style: { display: 'block', padding: '20px 16px', background: item.bg, borderRadius: 10, border: '1px solid ' + item.color + '20', textDecoration: 'none' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                      React.createElement('div', { style: { width: 40, height: 40, borderRadius: 8, background: item.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: item.color } }, item.icon),
                      React.createElement('div', null,
                        React.createElement('div', { style: { fontWeight: 600, color: '#333', fontSize: 13 } }, item.label),
                        React.createElement('div', { style: { fontSize: 11, color: '#999', marginTop: 2 } }, item.desc)
                      )
                    )
                  )
                );
              })
            )
          ),
          // Upcoming / info card
          React.createElement(Card, { title: '教学提示', size: 'small' },
            React.createElement('div', { style: { fontSize: 13, color: '#666', lineHeight: 2 } },
              React.createElement('p', null, '创建试卷后发布给学生，可在线作答。'),
              React.createElement('p', null, '使用智能出题可快速扩充题库。'),
              React.createElement('p', null, '在答题统计中查看学生答题情况。')
            )
          )
        )
      )
    );
  }

  // ── QUESTION_ADMIN dashboard (题库概览) ──
  if (role === 'QUESTION_ADMIN') {
    return React.createElement('div', null,
      React.createElement(Title, { level: 4 }, '题库概览'),
      React.createElement(Row, { gutter: [16, 16] },
        React.createElement(Col, { xs: 24, sm: 8 },
          React.createElement(Card, null, React.createElement(Statistic, { title: '题库总量', value: stats ? stats.questionCount : '-', prefix: React.createElement(QuestionCircleOutlined) }))
        ),
        React.createElement(Col, { xs: 24, sm: 8 },
          React.createElement(Card, null, React.createElement(Statistic, { title: '试卷数量', value: stats ? stats.paperCount : '-', prefix: React.createElement(FileTextOutlined) }))
        ),
        React.createElement(Col, { xs: 24, sm: 8 },
          React.createElement(Card, null, React.createElement(Statistic, { title: '待审试题', value: stats ? stats.pendingCount : '-', prefix: React.createElement(ClockCircleOutlined), valueStyle: (stats && stats.pendingCount > 0) ? { color: '#cf1322' } : {} }))
        )
      ),
      React.createElement(Card, { title: '题库管理入口', style: { marginTop: 16 } },
        React.createElement(Row, { gutter: [16, 16] },
          React.createElement(Col, { span: 6 },
            React.createElement('a', { href: '/questions', style: { display: 'block', padding: '24px 0', textAlign: 'center', background: '#f0f5ff', borderRadius: 8, border: '1px solid #d6e4ff' } },
              React.createElement(QuestionCircleOutlined, { style: { fontSize: 32, color: '#667eea' } }),
              React.createElement('div', { style: { marginTop: 8, fontWeight: 'bold', fontSize: 14 } }, '题库浏览'),
              React.createElement('div', { style: { marginTop: 4, fontSize: 12, color: '#999' } }, '浏览、编辑所有试题')
            )
          ),
          React.createElement(Col, { span: 6 },
            React.createElement('a', { href: '/syllabus', style: { display: 'block', padding: '24px 0', textAlign: 'center', background: '#f0f5ff', borderRadius: 8, border: '1px solid #d6e4ff' } },
              React.createElement(ApartmentOutlined, { style: { fontSize: 32, color: '#667eea' } }),
              React.createElement('div', { style: { marginTop: 8, fontWeight: 'bold', fontSize: 14 } }, '考纲管理'),
              React.createElement('div', { style: { marginTop: 4, fontSize: 12, color: '#999' } }, '创建考纲、提取知识点')
            )
          ),
          React.createElement(Col, { span: 6 },
            React.createElement('a', { href: '/question-admin', style: { display: 'block', padding: '24px 0', textAlign: 'center', background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' } },
              React.createElement(RobotOutlined, { style: { fontSize: 32, color: '#fa8c16' } }),
              React.createElement('div', { style: { marginTop: 8, fontWeight: 'bold', fontSize: 14 } }, '智能出题'),
              React.createElement('div', { style: { marginTop: 4, fontSize: 12, color: '#999' } }, 'AI生成、网络抓取试题')
            )
          ),
          React.createElement(Col, { span: 6 },
            React.createElement('a', { href: '/knowledge-tree', style: { display: 'block', padding: '24px 0', textAlign: 'center', background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' } },
              React.createElement(BarChartOutlined, { style: { fontSize: 32, color: '#52c41a' } }),
              React.createElement('div', { style: { marginTop: 8, fontWeight: 'bold', fontSize: 14 } }, '知识树'),
              React.createElement('div', { style: { marginTop: 4, fontSize: 12, color: '#999' } }, '知识点版本化管理')
            )
          )
        )
      ),
      React.createElement(Card, { title: '快捷操作', style: { marginTop: 16 } },
        React.createElement(Row, { gutter: 16 },
          React.createElement(Col, { span: 8 },
            React.createElement('a', { href: '/papers', style: { display: 'block', padding: 12, background: '#fafafa', borderRadius: 6 } },
              React.createElement(FileTextOutlined, null), ' 试卷管理'
            )
          ),
          React.createElement(Col, { span: 8 },
            React.createElement('a', { href: '/questions', style: { display: 'block', padding: 12, background: '#fafafa', borderRadius: 6 } },
              React.createElement(QuestionCircleOutlined, null), ' 试题管理'
            )
          ),
          React.createElement(Col, { span: 8 },
            React.createElement('a', { href: '/admin/config', style: { display: 'block', padding: 12, background: '#fafafa', borderRadius: 6 } },
              React.createElement(CheckCircleOutlined, null), ' 系统配置'
            )
          )
        )
      )
    );
  }

  // ── SYS_ADMIN / ADMIN dashboard ──
  return React.createElement('div', null,
    React.createElement(Title, { level: 4 }, '系统概览'),
    React.createElement(Row, { gutter: [16, 16] },
      React.createElement(Col, { xs: 24, sm: 12, lg: 6 },
        React.createElement(Card, null, React.createElement(Statistic, { title: '用户总数', value: '-', prefix: React.createElement(TeamOutlined) }))
      ),
      React.createElement(Col, { xs: 24, sm: 12, lg: 6 },
        React.createElement(Card, null, React.createElement(Statistic, { title: '题库总数', value: '-', prefix: React.createElement(QuestionCircleOutlined) }))
      ),
      React.createElement(Col, { xs: 24, sm: 12, lg: 6 },
        React.createElement(Card, null, React.createElement(Statistic, { title: '试卷总数', value: '-', prefix: React.createElement(FileTextOutlined) }))
      ),
      React.createElement(Col, { xs: 24, sm: 12, lg: 6 },
        React.createElement(Card, null, React.createElement(Statistic, { title: '系统状态', value: '正常', prefix: React.createElement(CheckCircleOutlined), valueStyle: { color: '#3f8600' } }))
      )
    )
  );
}
