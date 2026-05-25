import React, { useState, useEffect } from 'react';
import { Card, Typography, Statistic, Row, Col, Table, Tag, Spin, Space, Button } from 'antd';
import {
  BookOutlined, CheckCircleOutlined, FileTextOutlined, TrophyOutlined,
  QuestionCircleOutlined, ApartmentOutlined, RobotOutlined, ClockCircleOutlined,
  TeamOutlined, BarChartOutlined, ThunderboltOutlined, AppstoreOutlined, SettingOutlined, UserOutlined,
} from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toColorMap } from '../../hooks/useReferenceValues';

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
  var dashStatsState = useState(null); var dashStats = dashStatsState[0]; var setDashStats = dashStatsState[1];
  var dashLoadingState = useState(true); var dashLoading = dashLoadingState[0]; var setDashLoading = dashLoadingState[1];
  var { 'paper-statuses': paperStatuses } = useReferenceValues();
  var statusLabelMap = toLabelMap(paperStatuses);
  var statusColorMap = toColorMap(paperStatuses);

  useEffect(function () {
    if (role === 'QUESTION_ADMIN') {
      loadStats();
    } else if (role === 'TEACHER') {
      loadTeacherStats();
    } else if (role === 'SYS_ADMIN' || role === 'ADMIN') {
      setLoading(false);
      apiClient.get('/admin/dashboard/stats').then(function (res) {
        setDashStats(res.data);
      }).catch(function () {}).finally(function () { setDashLoading(false); });
    } else {
      setLoading(false);
    }
  }, [role]);

  function loadStats() {
    setLoading(true);
    apiClient.get('/question-admin/stats').then(function (res) {
      setStats(res.data);
    }).catch(function () {
      setStats(null);
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
          React.createElement(Card, { title: React.createElement(Space, null, React.createElement(FileTextOutlined, null), '试卷错题本'),
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
                    return React.createElement(Tag, { color: (statusColorMap[s] || {}).color || 'default' }, statusLabelMap[s] || s);
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
  var questionTypes = { SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', FILL_BLANK: '填空题', SUBJECTIVE: '解答题' };
  var difficulties = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
  var sources = { MANUAL: '人工录入', LLM_GENERATED: 'LLM生成', SCRAPED: '网络抓取', OCR_UPLOAD: '学生上传' };
  var statusLabels = { APPROVED: '已发布', PENDING: '待审核', REJECTED: '已驳回', NEEDS_REVIEW: '待复审' };
  var s = stats || {};

  var handleQuickApprove = function (id) {
    apiClient.post('/question-admin/' + id + '/approve').then(function () {
      loadStats();
    }).catch(function () {});
  };
  var handleQuickReject = function (id) {
    apiClient.post('/question-admin/' + id + '/reject').then(function () {
      loadStats();
    }).catch(function () {});
  };

  var distItem = function (label, count, total, color) {
    var pct = total > 0 ? Math.round(count / total * 100) : 0;
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', marginBottom: 6, fontSize: 13 } },
      React.createElement('span', { style: { width: 60, color: '#666' } }, label),
      React.createElement('div', { style: { flex: 1, height: 16, background: '#f0f0f0', borderRadius: 8, margin: '0 8px', overflow: 'hidden' } },
        React.createElement('div', { style: { width: pct + '%', height: '100%', background: color || '#667eea', borderRadius: 8, minWidth: count > 0 ? 4 : 0, transition: 'width 0.3s' } })
      ),
      React.createElement('span', { style: { width: 60, textAlign: 'right', fontWeight: 'bold' } }, count),
    );
  };

  if (role === 'QUESTION_ADMIN') {
    return loading ? React.createElement('div', { style: { textAlign: 'center', padding: 80 } }, React.createElement(Spin, { size: 'large' })) :
      React.createElement('div', null,
        React.createElement(Title, { level: 4 }, '题库概览'),
        // ── Stats Row ──
        React.createElement(Row, { gutter: [16, 16] },
          React.createElement(Col, { xs: 12, sm: 6 },
            React.createElement(Card, null, React.createElement(Statistic, { title: '题库总量', value: s.total || 0, prefix: React.createElement(QuestionCircleOutlined) }))
          ),
          React.createElement(Col, { xs: 12, sm: 6 },
            React.createElement(Card, null, React.createElement(Statistic, { title: '已发布', value: (s.by_status && s.by_status.APPROVED) || 0, prefix: React.createElement(CheckCircleOutlined), valueStyle: { color: '#389e0d' } }))
          ),
          React.createElement(Col, { xs: 12, sm: 6 },
            React.createElement(Card, null, React.createElement(Statistic, { title: '待审核', value: s.pending_total || 0, prefix: React.createElement(ClockCircleOutlined), valueStyle: s.pending_total > 0 ? { color: '#cf1322' } : {} }))
          ),
          React.createElement(Col, { xs: 12, sm: 6 },
            React.createElement(Card, null, React.createElement(Statistic, { title: '待复审', value: (s.by_status && s.by_status.NEEDS_REVIEW) || 0, prefix: React.createElement(ClockCircleOutlined), valueStyle: (s.by_status && s.by_status.NEEDS_REVIEW > 0) ? { color: '#d48806' } : {} }))
          )
        ),
        // ── Distribution + Pending List ──
        React.createElement(Row, { gutter: [16, 16], style: { marginTop: 16 } },
          React.createElement(Col, { xs: 24, md: 10 },
            React.createElement(Card, { title: '题型分布', size: 'small' },
              s.by_type ? Object.keys(questionTypes).map(function (k) { return distItem(questionTypes[k], s.by_type[k] || 0, s.total, '#667eea'); }) : React.createElement('div', { style: { color: '#999', fontSize: 12 } }, '暂无数据')
            ),
            React.createElement(Card, { title: '难度分布', size: 'small', style: { marginTop: 12 } },
              s.by_difficulty ? Object.keys(difficulties).map(function (k) { return distItem(difficulties[k], s.by_difficulty[k] || 0, s.total, k === 'EASY' ? '#52c41a' : k === 'MEDIUM' ? '#faad14' : '#ff4d4f'); }) : React.createElement('div', { style: { color: '#999', fontSize: 12 } }, '暂无数据')
            ),
            React.createElement(Card, { title: '来源分布', size: 'small', style: { marginTop: 12 } },
              s.by_source ? Object.keys(sources).map(function (k) { return distItem(sources[k], s.by_source[k] || 0, s.total, k === 'MANUAL' ? '#1890ff' : k === 'LLM_GENERATED' ? '#722ed1' : k === 'SCRAPED' ? '#fa8c16' : '#13c2c2'); }) : React.createElement('div', { style: { color: '#999', fontSize: 12 } }, '暂无数据')
            )
          ),
          React.createElement(Col, { xs: 24, md: 14 },
            React.createElement(Card, { title: '待审核试题 (' + (s.pending_total || 0) + ')', size: 'small' },
              s.pending_items && s.pending_items.length > 0
                ? React.createElement(Table, {
                    rowKey: 'id', dataSource: s.pending_items, size: 'small', pagination: false,
                    columns: [
                      { title: '题目', dataIndex: 'title', ellipsis: true },
                      { title: '题型', dataIndex: 'question_type', width: 70, render: function (t) { return React.createElement(Tag, null, questionTypes[t] || t); } },
                      { title: '难度', dataIndex: 'difficulty', width: 60, render: function (t) { var colors = { EASY: 'green', MEDIUM: 'gold', HARD: 'red' }; return React.createElement(Tag, { color: colors[t] }, difficulties[t] || t); } },
                      { title: '来源', dataIndex: 'source', width: 80, render: function (t) { return React.createElement(Tag, null, sources[t] || t); } },
                      { title: '状态', dataIndex: 'review_status', width: 70, render: function (t) { var colors = { PENDING: 'orange', NEEDS_REVIEW: 'gold' }; return React.createElement(Tag, { color: colors[t] }, statusLabels[t] || t); } },
                      { title: '操作', width: 100, render: function (_, r) {
                        return React.createElement(Space, { size: 2 },
                          React.createElement(Button, { type: 'link', size: 'small', onClick: function () { handleQuickApprove(r.id); } }, '通过'),
                          React.createElement(Button, { type: 'link', size: 'small', danger: true, onClick: function () { handleQuickReject(r.id); } }, '驳回')
                        );
                      }},
                    ]
                  })
                : React.createElement('div', { style: { textAlign: 'center', color: '#999', padding: 24 } }, '暂无待审核试题')
            )
          )
        ),
        // ── Quick Links ──
        React.createElement(Card, { title: '快捷入口', style: { marginTop: 16 } },
          React.createElement(Row, { gutter: [12, 12] },
            React.createElement(Col, { xs: 12, sm: 6 },
              React.createElement('a', { href: '/questions', style: { display: 'block', padding: '20px 12px', textAlign: 'center', background: '#f0f5ff', borderRadius: 8 } },
                React.createElement(QuestionCircleOutlined, { style: { fontSize: 28, color: '#667eea' } }),
                React.createElement('div', { style: { marginTop: 6, fontWeight: 'bold', fontSize: 13 } }, '题库浏览')
              )
            ),
            React.createElement(Col, { xs: 12, sm: 6 },
              React.createElement('a', { href: '/syllabus', style: { display: 'block', padding: '20px 12px', textAlign: 'center', background: '#f0f5ff', borderRadius: 8 } },
                React.createElement(ApartmentOutlined, { style: { fontSize: 28, color: '#667eea' } }),
                React.createElement('div', { style: { marginTop: 6, fontWeight: 'bold', fontSize: 13 } }, '考纲管理')
              )
            ),
            React.createElement(Col, { xs: 12, sm: 6 },
              React.createElement('a', { href: '/question-admin', style: { display: 'block', padding: '20px 12px', textAlign: 'center', background: '#fff7e6', borderRadius: 8 } },
                React.createElement(RobotOutlined, { style: { fontSize: 28, color: '#fa8c16' } }),
                React.createElement('div', { style: { marginTop: 6, fontWeight: 'bold', fontSize: 13 } }, '智能出题')
              )
            ),
            React.createElement(Col, { xs: 12, sm: 6 },
              React.createElement('a', { href: '/papers', style: { display: 'block', padding: '20px 12px', textAlign: 'center', background: '#f6ffed', borderRadius: 8 } },
                React.createElement(FileTextOutlined, { style: { fontSize: 28, color: '#52c41a' } }),
                React.createElement('div', { style: { marginTop: 6, fontWeight: 'bold', fontSize: 13 } }, '试卷管理')
              )
            )
          )
        )
      );
  }

  // ── SYS_ADMIN / ADMIN dashboard ──
  if (role === 'SYS_ADMIN' || role === 'ADMIN') {
    var s = dashStats;
    var uptimeMin = s ? Math.floor(s.server.uptime_seconds / 60) : 0;
    return React.createElement('div', null,
      React.createElement(Title, { level: 4 }, '系统概览'),

      // Stats row
      React.createElement(Row, { gutter: [16, 16], style: { marginBottom: 24 } },
        React.createElement(Col, { xs: 24, sm: 12, md: 6 },
          React.createElement(Card, { style: { background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 12 }, loading: dashLoading },
            React.createElement(Statistic, { title: React.createElement('span', { style: { color: 'rgba(255,255,255,0.85)' } }, '用户总数'), value: s ? s.stats.users : '-', valueStyle: { color: '#fff', fontSize: 32 },
              prefix: React.createElement(TeamOutlined, { style: { color: 'rgba(255,255,255,0.7)' } })
            })
          )
        ),
        React.createElement(Col, { xs: 24, sm: 12, md: 6 },
          React.createElement(Card, { style: { background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: 12 }, loading: dashLoading },
            React.createElement(Statistic, { title: React.createElement('span', { style: { color: 'rgba(255,255,255,0.85)' } }, '题库总数'), value: s ? s.stats.questions : '-', valueStyle: { color: '#fff', fontSize: 32 },
              prefix: React.createElement(QuestionCircleOutlined, { style: { color: 'rgba(255,255,255,0.7)' } })
            })
          )
        ),
        React.createElement(Col, { xs: 24, sm: 12, md: 6 },
          React.createElement(Card, { style: { background: 'linear-gradient(135deg, #f093fb, #f5576c)', borderRadius: 12 }, loading: dashLoading },
            React.createElement(Statistic, { title: React.createElement('span', { style: { color: 'rgba(255,255,255,0.85)' } }, '试卷总数'), value: s ? s.stats.papers : '-', valueStyle: { color: '#fff', fontSize: 32 },
              prefix: React.createElement(FileTextOutlined, { style: { color: 'rgba(255,255,255,0.7)' } })
            })
          )
        ),
        React.createElement(Col, { xs: 24, sm: 12, md: 6 },
          React.createElement(Card, { style: { background: 'linear-gradient(135deg, #43e97b, #38f9d7)', borderRadius: 12 }, loading: dashLoading },
            React.createElement(Statistic, { title: React.createElement('span', { style: { color: 'rgba(255,255,255,0.85)' } }, '班级数'), value: s ? s.stats.classes : '-', valueStyle: { color: '#fff', fontSize: 32 },
              prefix: React.createElement(ApartmentOutlined, { style: { color: 'rgba(255,255,255,0.7)' } })
            })
          )
        )
      ),

      // Second row: System info + LLM status
      React.createElement(Row, { gutter: [16, 16], style: { marginBottom: 24 } },
        React.createElement(Col, { xs: 24, lg: 14 },
          React.createElement(Card, { title: React.createElement(Space, null, React.createElement(ApartmentOutlined, null), '系统信息'), loading: dashLoading },
            s ? React.createElement(Space, { direction: 'vertical', style: { width: '100%' }, size: 'small' },
              React.createElement(Row, { gutter: 24 },
                React.createElement(Col, { span: 8 }, React.createElement('div', null, React.createElement('span', { style: { color: '#888', fontSize: 12 } }, '数据库'), React.createElement('div', null, React.createElement(Tag, { color: 'blue' }, 'PostgreSQL 16')))),
                React.createElement(Col, { span: 8 }, React.createElement('div', null, React.createElement('span', { style: { color: '#888', fontSize: 12 } }, '大小'), React.createElement('div', null, React.createElement('strong', null, s.database.size_mb, ' MB')))),
                React.createElement(Col, { span: 8 }, React.createElement('div', null, React.createElement('span', { style: { color: '#888', fontSize: 12 } }, '数据表'), React.createElement('div', null, React.createElement('strong', null, s.database.table_count, ' 张'))))
              ),
              React.createElement(Row, { gutter: 24 },
                React.createElement(Col, { span: 8 }, React.createElement('div', null, React.createElement('span', { style: { color: '#888', fontSize: 12 } }, '总记录'), React.createElement('div', null, React.createElement('strong', null, s.database.total_rows, ' 条')))),
                React.createElement(Col, { span: 8 }, React.createElement('div', null, React.createElement('span', { style: { color: '#888', fontSize: 12 } }, 'Python'), React.createElement('div', null, React.createElement(Tag, null, 'Python ' + s.server.python)))),
                React.createElement(Col, { span: 8 }, React.createElement('div', null, React.createElement('span', { style: { color: '#888', fontSize: 12 } }, '运行时长'), React.createElement('div', null, React.createElement('strong', null, uptimeMin > 60 ? Math.floor(uptimeMin / 60) + 'h ' + uptimeMin % 60 + 'm' : uptimeMin + ' 分钟'))))
              )
            ) : null
          )
        ),
        React.createElement(Col, { xs: 24, lg: 10 },
          React.createElement(Card, { title: React.createElement(Space, null, React.createElement(ThunderboltOutlined, null), '大模型状态'), loading: dashLoading },
            s ? React.createElement(Space, { direction: 'vertical', style: { width: '100%' }, size: 'small' },
              React.createElement('div', null,
                React.createElement('span', { style: { color: '#888', fontSize: 12 } }, '当前服务商'),
                React.createElement('div', null, React.createElement(Tag, { color: s.llm.current === 'deepseek' ? 'purple' : 'blue' }, s.llm.current === 'deepseek' ? 'DeepSeek' : 'Ollama'))
              ),
              React.createElement('div', null,
                React.createElement('span', { style: { color: '#888', fontSize: 12 } }, '当前模型'),
                React.createElement('div', null, React.createElement('code', null, s.llm.model || '未配置'))
              )
            ) : null
          )
        )
      ),

      // Quick actions
      React.createElement(Card, { title: '快捷操作' },
        React.createElement(Row, { gutter: [12, 12] },
          [{ href: '/admin/basic-config', icon: React.createElement(AppstoreOutlined), color: '#fa8c16', bg: '#fff7e6', label: '应用参数', desc: '学科管理、判卷/错题本设置' },
           { href: '/admin/sys-admin', icon: React.createElement(UserOutlined), color: '#722ed1', bg: '#f9f0ff', label: '管理员账号', desc: '管理教师和题库管理员' },
           { href: '/admin/config', icon: React.createElement(SettingOutlined), color: '#1890ff', bg: '#e6f7ff', label: '系统配置', desc: '大模型、OCR、数据库设置' },
          ].map(function (item) {
            return React.createElement(Col, { span: 12, key: item.label },
              React.createElement('a', { href: item.href, style: { display: 'block', padding: '16px 12px', background: item.bg, borderRadius: 10, border: '1px solid ' + item.color + '20', textDecoration: 'none' } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                  React.createElement('div', { style: { width: 36, height: 36, borderRadius: 8, background: item.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: item.color } }, item.icon),
                  React.createElement('div', null,
                    React.createElement('div', { style: { fontWeight: 600, color: '#333', fontSize: 13 } }, item.label),
                    React.createElement('div', { style: { fontSize: 11, color: '#999', marginTop: 2 } }, item.desc)
                  )
                )
              )
            );
          })
        )
      )
    );
  }
}
