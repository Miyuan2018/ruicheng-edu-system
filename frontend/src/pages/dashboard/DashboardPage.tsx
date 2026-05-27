import { useState, useEffect } from 'react';
import { Card, Typography, Statistic, Row, Col, Table, Tag, Spin, Space, Button, Progress } from 'antd';
import {
  BookOutlined, CheckCircleOutlined, FileTextOutlined, TrophyOutlined,
  QuestionCircleOutlined, ApartmentOutlined, RobotOutlined, ClockCircleOutlined,
  TeamOutlined, BarChartOutlined, ThunderboltOutlined, AppstoreOutlined, SettingOutlined, UserOutlined,
  HeartOutlined, GiftOutlined,
} from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toColorMap } from '../../hooks/useReferenceValues';
import { getUserType } from '../../store/auth';
import ParentDashboardPage from '../parent/ParentDashboardPage';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const { Title } = Typography;

// 宽松类型，用于后端返回的动态结构
type AnyObj = Record<string, any>;

export default function DashboardPage() {
  const role = getUserType();

  const [stats, setStats] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(true);
  // Student dashboard data
  const [studentStats, setStudentStats] = useState({ completed_papers: 0, accuracy_rate: 0, error_count: 0, highest_score: 0, recent_papers: [] as AnyObj[], subject_distribution: [] as AnyObj[] });
  const [studentLoading, setStudentLoading] = useState(true);
  // Student progress data (charts)
  const [progressData, setProgressData] = useState<{ accuracy_trend: AnyObj[], completion_activity: AnyObj[], subject_performance: AnyObj[] }>({ accuracy_trend: [], completion_activity: [], subject_performance: [] });
  const [progressLoading, setProgressLoading] = useState(true);
  // Teacher dashboard data (loaded at top level to avoid conditional hooks)
  const [teacherClasses, setTeacherClasses] = useState<AnyObj[]>([]);
  const [teacherPapers, setTeacherPapers] = useState<AnyObj[]>([]);
  const [teacherDashLoading, setTeacherDashLoading] = useState(true);
  const [dashStats, setDashStats] = useState<AnyObj | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  // Student interaction data (encouragements + reward goals)
  const [encouragements, setEncouragements] = useState<AnyObj[]>([]);
  const [rewardGoals, setRewardGoals] = useState<AnyObj[]>([]);
  const { 'paper-statuses': paperStatuses } = useReferenceValues();
  const statusLabelMap = toLabelMap(paperStatuses);
  const statusColorMap = toColorMap(paperStatuses);

  useEffect(() => {
    if (role === 'STUDENT') {
      setStudentLoading(true);
      apiClient.get('/student/stats').then((res) => {
        setStudentStats((prev) => res.data || prev);
      }).catch(() => {}).finally(() => { setStudentLoading(false); });
      // Fetch progress data for charts
      setProgressLoading(true);
      apiClient.get('/student/progress').then((res) => {
        setProgressData((prev) => res.data || prev);
      }).catch(() => {}).finally(() => { setProgressLoading(false); });
      // Fetch encouragements and reward goals
      apiClient.get('/parent/encouragement/received?unread_only=true').then((res) => {
        setEncouragements(Array.isArray(res.data) ? res.data.slice(0, 3) : []);
      }).catch(() => {});
      apiClient.get('/parent/reward-goals?status=ACTIVE').then((res) => {
        setRewardGoals(Array.isArray(res.data) ? res.data.slice(0, 3) : []);
      }).catch(() => {});
    } else if (role === 'QUESTION_ADMIN') {
      loadStats();
    } else if (role === 'TEACHER') {
      loadTeacherStats();
    } else if (role === 'SYS_ADMIN' || role === 'ADMIN') {
      setLoading(false);
      apiClient.get('/admin/dashboard/stats').then((res) => {
        setDashStats(res.data);
      }).catch(() => {}).finally(() => { setDashLoading(false); });
    } else {
      setLoading(false);
    }
  }, [role]);

  function loadStats() {
    setLoading(true);
    apiClient.get('/question-admin/stats').then((res) => {
      setStats(res.data);
    }).catch(() => {
      setStats(null);
    }).finally(() => { setLoading(false); });
  }

  function loadTeacherStats() {
    setTeacherDashLoading(true);
    Promise.all([
      apiClient.get('/classes').catch(() => { return { data: [] }; }),
      apiClient.get('/teacher/stats/papers').catch(() => { return { data: [] }; }),
    ]).then((results) => {
      const cls = results[0].data || [];
      const pps = results[1].data || [];
      setTeacherClasses(Array.isArray(cls) ? cls : []);
      setTeacherPapers(Array.isArray(pps) ? pps : []);
    }).finally(() => { setTeacherDashLoading(false); });
  }

  if (role === 'PARENT') return <ParentDashboardPage />;

  if (loading && role !== 'TEACHER') return <Spin style={{ display: 'block', textAlign: 'center', padding: 80 }} />;

  // ── STUDENT dashboard ──
  if (role === 'STUDENT') {
    const recentColumns = [
      { title: '试卷', dataIndex: 'title', ellipsis: true },
      { title: '学科', dataIndex: 'subject', width: 60 },
      { title: '正确率', dataIndex: 'percentage', width: 80, render: (v: any) => {
        const pct = v ? Math.round(v) : 0;
        return <Tag color={pct >= 80 ? 'green' : pct >= 60 ? 'orange' : 'red'}>{pct}%</Tag>;
      }},
    ];
    return (
      <div>
        <Title level={4}>学习仪表盘</Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={studentLoading}>
              <Statistic title="已完成试卷" value={studentStats.completed_papers} prefix={<FileTextOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={studentLoading}>
              <Statistic title="正确率" value={studentStats.accuracy_rate} precision={1} suffix="%" prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={studentLoading}>
              <Statistic title="错题数量" value={studentStats.error_count} prefix={<BookOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={studentLoading}>
              <Statistic title="最高得分率" value={studentStats.highest_score} precision={1} suffix="%" prefix={<TrophyOutlined />} />
            </Card>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <Card title="最近完成试卷" size="small">
              {studentStats.recent_papers && studentStats.recent_papers.length > 0 ? (
                <Table rowKey="id" size="small" dataSource={studentStats.recent_papers} pagination={false} columns={recentColumns} />
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>暂无完成试卷，去答题吧！</div>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="学科分布" size="small">
              {studentStats.subject_distribution && studentStats.subject_distribution.length > 0 ? (
                studentStats.subject_distribution.map((item: any) => {
                  const maxCount = Math.max.apply(null, studentStats.subject_distribution.map((x: any) => x.count));
                  return (
                    <div key={item.subject} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ width: 60, color: '#666' }}>{item.subject || '未分类'}</span>
                      <div style={{ flex: 1, height: 16, background: '#f0f0f0', borderRadius: 8, margin: '0 8px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#667eea', borderRadius: 8, minWidth: item.count > 0 ? 4 : 0, width: Math.max(4, (item.count / maxCount) * 100) + '%' }} />
                      </div>
                      <span style={{ width: 30, textAlign: 'right', fontWeight: 'bold' }}>{item.count}</span>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>暂无数据</div>
              )}
            </Card>
          </Col>
        </Row>
        {/* ── 学习进度图表 ── */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="正确率趋势" size="small">
              {progressLoading ? <Spin style={{ display: 'block', padding: 40 }} /> :
                progressData.accuracy_trend && progressData.accuracy_trend.length > 0 ? (
                  <div>
                    {progressData.accuracy_trend.length < 3 && (
                      <div style={{ fontSize: 12, color: '#faad14', marginBottom: 8 }}>答题次数较少，趋势图需要至少3次答题记录</div>
                    )}
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={progressData.accuracy_trend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" fontSize={12} />
                        <YAxis domain={[0, 100]} tickFormatter={(v: number) => v + '%'} fontSize={12} />
                        <Tooltip formatter={(v: number) => v + '%'} labelFormatter={(l: string) => '日期: ' + l} />
                        <Line type="monotone" dataKey="accuracy" stroke="#667eea" strokeWidth={2} dot={false} name="正确率" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无数据</div>
              }
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="答题活跃度" size="small">
              {progressLoading ? <Spin style={{ display: 'block', padding: 40 }} /> :
                progressData.completion_activity && progressData.completion_activity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={progressData.completion_activity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <Tooltip formatter={(v: number) => v + '份'} labelFormatter={(l: string) => '日期: ' + l} />
                      <Bar dataKey="count" fill="#667eea" radius={[4, 4, 0, 0]} name="完成试卷" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无数据</div>
              }
            </Card>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card title="学科表现对比" size="small">
              {progressLoading ? <Spin style={{ display: 'block', padding: 40 }} /> :
                progressData.subject_performance && progressData.subject_performance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={progressData.subject_performance.map((s: AnyObj) => ({
                      ...s,
                      correct_rate: s.total_questions > 0 ? Math.round(s.correct_questions / s.total_questions * 100) : 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" fontSize={12} />
                      <YAxis domain={[0, 100]} tickFormatter={(v: number) => v + '%'} fontSize={12} />
                      <Tooltip formatter={(v: number) => v + '%'} />
                      <Legend />
                      <Bar dataKey="avg_accuracy" fill="#667eea" radius={[4, 4, 0, 0]} name="平均正确率" />
                      <Bar dataKey="correct_rate" fill="#52c41a" radius={[4, 4, 0, 0]} name="题目正确率" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无数据</div>
              }
            </Card>
          </Col>
        </Row>
        {/* ── 家长的鼓励 ── */}
        {encouragements.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24}>
              <Card title={<span><HeartOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />家长的鼓励</span>} size="small">
                <Row gutter={[12, 12]}>
                  {encouragements.map((enc: AnyObj) => (
                    <Col xs={24} sm={8} key={enc.id}>
                      <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffd591' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{enc.title || '鼓励'}</div>
                        <div style={{ fontSize: 13, color: '#666' }}>{enc.message}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                          {enc.created_at ? new Date(enc.created_at).toLocaleDateString('zh-CN') : ''}
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
          </Row>
        )}
        {/* ── 奖励目标进度 ── */}
        {rewardGoals.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24}>
              <Card title={<span><GiftOutlined style={{ color: '#722ed1', marginRight: 8 }} />奖励目标</span>} size="small">
                <Row gutter={[12, 12]}>
                  {rewardGoals.map((g: AnyObj) => {
                    const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
                    return (
                      <Col xs={24} sm={8} key={g.id}>
                        <Card size="small">
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{g.title}</div>
                          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{g.reward_description}</div>
                          <Progress percent={pct} size="small" format={() => `${g.current_value}/${g.target_value}`} />
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            </Col>
          </Row>
        )}
      </div>
    );
  }
  if (role === 'TEACHER') {
    const totalStudents = teacherClasses.reduce((s, c) => s + (c.student_count || 0), 0);
    const activeClasses = teacherClasses.filter((c) => c.is_active).length;

    return (
      <div>
        <Title level={4}>教学仪表盘</Title>

        {/* Stats row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 12 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>班级</span>}
                value={teacherClasses.length}
                valueStyle={{ color: '#fff', fontSize: 32 }}
                prefix={<TeamOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
                suffix={<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>启用{activeClasses}</span>}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)', borderRadius: 12 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>学生</span>}
                value={totalStudents}
                valueStyle={{ color: '#fff', fontSize: 32 }}
                prefix={<TeamOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: 12 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>试卷</span>}
                value={teacherPapers.length}
                valueStyle={{ color: '#fff', fontSize: 32 }}
                prefix={<FileTextOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: 'linear-gradient(135deg, #43e97b, #38f9d7)', borderRadius: 12 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>题库</span>}
                value={110}
                valueStyle={{ color: '#fff', fontSize: 32 }}
                prefix={<QuestionCircleOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* Left: Class list */}
          <Col xs={24} lg={14}>
            <Card
              title={<Space><TeamOutlined />我的班级</Space>}
              extra={<a href="/teacher/classes">管理班级 →</a>}
              style={{ marginBottom: 16 }}
            >
              {teacherDashLoading ? <Spin /> :
                teacherClasses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                    暂无班级，<a href="/teacher/classes">去创建</a>
                  </div>
                ) : (
                  <Table
                    rowKey="id"
                    size="small"
                    dataSource={teacherClasses.slice(0, 5)}
                    pagination={false}
                    columns={[
                      { title: '班级名称', dataIndex: 'name', ellipsis: true,
                        render: (t: any) => <a href="/teacher/classes">{t}</a>
                      },
                      { title: '学科', dataIndex: 'subject', width: 60 },
                      { title: '年级', dataIndex: 'grade_level', width: 70 },
                      { title: '学生', dataIndex: 'student_count', width: 50, align: 'center' },
                      { title: '状态', dataIndex: 'is_active', width: 60, render: (v: any) => (
                        <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>
                      )},
                    ]}
                  />
                )}
            </Card>
            {/* Papers table */}
            <Card
              title={<Space><FileTextOutlined />试卷错题本</Space>}
              extra={<a href="/papers">全部试卷 →</a>}
            >
              {teacherDashLoading ? <Spin /> :
                teacherPapers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                    暂无试卷，<a href="/papers">去创建</a>
                  </div>
                ) : (
                  <Table
                    rowKey="id"
                    size="small"
                    dataSource={teacherPapers.slice(0, 5)}
                    pagination={false}
                    columns={[
                      { title: '试卷名称', dataIndex: 'title', ellipsis: true, render: (t: any) => (
                        <a href="/papers">{t}</a>
                      )},
                      { title: '学科', dataIndex: 'subject', width: 60 },
                      { title: '年级', dataIndex: 'grade_level', width: 70 },
                      { title: '总分', dataIndex: 'total_score', width: 60, align: 'center' },
                      { title: '状态', dataIndex: 'status', width: 70, render: (s: any) => (
                        <Tag color={(statusColorMap[s] || {}).color || 'default'}>{statusLabelMap[s] || s}</Tag>
                      )},
                    ]}
                  />
                )}
            </Card>
          </Col>
          {/* Right: Quick actions */}
          <Col xs={24} lg={10}>
            <Card title="快捷操作" style={{ marginBottom: 16 }}>
              <Row gutter={[12, 12]}>
                {[
                  { href: '/papers', icon: <FileTextOutlined />, color: '#667eea', bg: '#f0f5ff', label: '新建试卷', desc: '创建在线试卷' },
                  { href: '/question-admin', icon: <RobotOutlined />, color: '#fa8c16', bg: '#fff7e6', label: '智能出题', desc: 'AI生成试题' },
                  { href: '/teacher/classes', icon: <TeamOutlined />, color: '#52c41a', bg: '#f6ffed', label: '班级管理', desc: '管理学生班级' },
                  { href: '/teacher/stats/paper', icon: <BarChartOutlined />, color: '#1890ff', bg: '#e6f7ff', label: '答题统计', desc: '查看学生成绩' },
                  { href: '/syllabus', icon: <ApartmentOutlined />, color: '#722ed1', bg: '#f9f0ff', label: '考纲管理', desc: '创建知识考纲' },
                  { href: '/questions', icon: <QuestionCircleOutlined />, color: '#eb2f96', bg: '#fff0f6', label: '题库浏览', desc: '浏览所有试题' },
                ].map((item) => (
                  <Col span={12} key={item.label}>
                    <a href={item.href} style={{ display: 'block', padding: '20px 16px', background: item.bg, borderRadius: 10, border: '1px solid ' + item.color + '20', textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: item.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: item.color }}>{item.icon}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#333', fontSize: 13 }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{item.desc}</div>
                        </div>
                      </div>
                    </a>
                  </Col>
                ))}
              </Row>
            </Card>
            {/* Upcoming / info card */}
            <Card title="教学提示" size="small">
              <div style={{ fontSize: 13, color: '#666', lineHeight: 2 }}>
                <p>创建试卷后发布给学生，可在线作答。</p>
                <p>使用智能出题可快速扩充题库。</p>
                <p>在答题统计中查看学生答题情况。</p>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  // ── QUESTION_ADMIN dashboard (题库概览) ──
  const questionTypes: Record<string, string> = { SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', FILL_BLANK: '填空题', SUBJECTIVE: '解答题' };
  const difficulties: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
  const sources: Record<string, string> = { MANUAL: '人工录入', LLM_GENERATED: 'LLM生成', SCRAPED: '网络抓取', OCR_UPLOAD: '学生上传' };
  const statusLabels: Record<string, string> = { APPROVED: '已发布', PENDING: '待审核', REJECTED: '已驳回', NEEDS_REVIEW: '待复审' };
  const s = stats || {};

  const handleQuickApprove = (id: string) => {
    apiClient.post('/question-admin/' + id + '/approve').then(() => {
      loadStats();
    }).catch(() => {});
  };
  const handleQuickReject = (id: string) => {
    apiClient.post('/question-admin/' + id + '/reject').then(() => {
      loadStats();
    }).catch(() => {});
  };

  const distItem = (label: string, count: number, total: number, color?: string) => {
    const pct = total > 0 ? Math.round(count / total * 100) : 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, fontSize: 13 }}>
        <span style={{ width: 60, color: '#666' }}>{label}</span>
        <div style={{ flex: 1, height: 16, background: '#f0f0f0', borderRadius: 8, margin: '0 8px', overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: color || '#667eea', borderRadius: 8, minWidth: count > 0 ? 4 : 0, transition: 'width 0.3s' }} />
        </div>
        <span style={{ width: 60, textAlign: 'right', fontWeight: 'bold' }}>{count}</span>
      </div>
    );
  };

  if (role === 'QUESTION_ADMIN') {
    return loading ? (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    ) : (
      <div>
        <Title level={4}>题库概览</Title>
        {/* ── Stats Row ── */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card><Statistic title="题库总量" value={s.total || 0} prefix={<QuestionCircleOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card><Statistic title="已发布" value={(s.by_status && s.by_status.APPROVED) || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#389e0d' }} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card><Statistic title="待审核" value={s.pending_total || 0} prefix={<ClockCircleOutlined />} valueStyle={s.pending_total > 0 ? { color: '#cf1322' } : {}} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card><Statistic title="待复审" value={(s.by_status && s.by_status.NEEDS_REVIEW) || 0} prefix={<ClockCircleOutlined />} valueStyle={(s.by_status && s.by_status.NEEDS_REVIEW > 0) ? { color: '#d48806' } : {}} /></Card>
          </Col>
        </Row>
        {/* ── Distribution + Pending List ── */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={10}>
            <Card title="题型分布" size="small">
              {s.by_type ? Object.keys(questionTypes).map((k) => distItem(questionTypes[k], s.by_type[k] || 0, s.total, '#667eea')) : <div style={{ color: '#999', fontSize: 12 }}>暂无数据</div>}
            </Card>
            <Card title="难度分布" size="small" style={{ marginTop: 12 }}>
              {s.by_difficulty ? Object.keys(difficulties).map((k) => distItem(difficulties[k], s.by_difficulty[k] || 0, s.total, k === 'EASY' ? '#52c41a' : k === 'MEDIUM' ? '#faad14' : '#ff4d4f')) : <div style={{ color: '#999', fontSize: 12 }}>暂无数据</div>}
            </Card>
            <Card title="来源分布" size="small" style={{ marginTop: 12 }}>
              {s.by_source ? Object.keys(sources).map((k) => distItem(sources[k], s.by_source[k] || 0, s.total, k === 'MANUAL' ? '#1890ff' : k === 'LLM_GENERATED' ? '#722ed1' : k === 'SCRAPED' ? '#fa8c16' : '#13c2c2')) : <div style={{ color: '#999', fontSize: 12 }}>暂无数据</div>}
            </Card>
          </Col>
          <Col xs={24} md={14}>
            <Card title={'待审核试题 (' + (s.pending_total || 0) + ')'} size="small">
              {s.pending_items && s.pending_items.length > 0 ? (
                <Table
                  rowKey="id"
                  dataSource={s.pending_items}
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '题目', dataIndex: 'title', ellipsis: true },
                    { title: '题型', dataIndex: 'question_type', width: 70, render: (t: any) => <Tag>{questionTypes[t] || t}</Tag> },
                    { title: '难度', dataIndex: 'difficulty', width: 60, render: (t: any) => { const colors: Record<string, string> = { EASY: 'green', MEDIUM: 'gold', HARD: 'red' }; return <Tag color={colors[t]}>{difficulties[t] || t}</Tag>; } },
                    { title: '来源', dataIndex: 'source', width: 80, render: (t: any) => <Tag>{sources[t] || t}</Tag> },
                    { title: '状态', dataIndex: 'review_status', width: 70, render: (t: any) => { const colors: Record<string, string> = { PENDING: 'orange', NEEDS_REVIEW: 'gold' }; return <Tag color={colors[t]}>{statusLabels[t] || t}</Tag>; } },
                    { title: '操作', width: 100, render: (_: any, r: any) => (
                      <Space size={2}>
                        <Button type="link" size="small" onClick={() => handleQuickApprove(r.id)}>通过</Button>
                        <Button type="link" size="small" danger onClick={() => handleQuickReject(r.id)}>驳回</Button>
                      </Space>
                    )},
                  ]}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>暂无待审核试题</div>
              )}
            </Card>
          </Col>
        </Row>
        {/* ── Quick Links ── */}
        <Card title="快捷入口" style={{ marginTop: 16 }}>
          <Row gutter={[12, 12]}>
            <Col xs={12} sm={6}>
              <a href="/questions" style={{ display: 'block', padding: '20px 12px', textAlign: 'center', background: '#f0f5ff', borderRadius: 8 }}>
                <QuestionCircleOutlined style={{ fontSize: 28, color: '#667eea' }} />
                <div style={{ marginTop: 6, fontWeight: 'bold', fontSize: 13 }}>题库浏览</div>
              </a>
            </Col>
            <Col xs={12} sm={6}>
              <a href="/syllabus" style={{ display: 'block', padding: '20px 12px', textAlign: 'center', background: '#f0f5ff', borderRadius: 8 }}>
                <ApartmentOutlined style={{ fontSize: 28, color: '#667eea' }} />
                <div style={{ marginTop: 6, fontWeight: 'bold', fontSize: 13 }}>考纲管理</div>
              </a>
            </Col>
            <Col xs={12} sm={6}>
              <a href="/question-admin" style={{ display: 'block', padding: '20px 12px', textAlign: 'center', background: '#fff7e6', borderRadius: 8 }}>
                <RobotOutlined style={{ fontSize: 28, color: '#fa8c16' }} />
                <div style={{ marginTop: 6, fontWeight: 'bold', fontSize: 13 }}>智能出题</div>
              </a>
            </Col>
            <Col xs={12} sm={6}>
              <a href="/papers" style={{ display: 'block', padding: '20px 12px', textAlign: 'center', background: '#f6ffed', borderRadius: 8 }}>
                <FileTextOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                <div style={{ marginTop: 6, fontWeight: 'bold', fontSize: 13 }}>试卷管理</div>
              </a>
            </Col>
          </Row>
        </Card>
      </div>
    );
  }

  // ── SYS_ADMIN / ADMIN dashboard ──
  if (role === 'SYS_ADMIN' || role === 'ADMIN') {
    const s = dashStats;
    const uptimeMin = s ? Math.floor(s.server.uptime_seconds / 60) : 0;
    return (
      <div>
        <Title level={4}>系统概览</Title>

        {/* Stats row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 12 }} loading={dashLoading}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>用户总数</span>}
                value={s ? s.stats.users : '-'}
                valueStyle={{ color: '#fff', fontSize: 32 }}
                prefix={<TeamOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: 12 }} loading={dashLoading}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>题库总数</span>}
                value={s ? s.stats.questions : '-'}
                valueStyle={{ color: '#fff', fontSize: 32 }}
                prefix={<QuestionCircleOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)', borderRadius: 12 }} loading={dashLoading}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>试卷总数</span>}
                value={s ? s.stats.papers : '-'}
                valueStyle={{ color: '#fff', fontSize: 32 }}
                prefix={<FileTextOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ background: 'linear-gradient(135deg, #43e97b, #38f9d7)', borderRadius: 12 }} loading={dashLoading}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>班级数</span>}
                value={s ? s.stats.classes : '-'}
                valueStyle={{ color: '#fff', fontSize: 32 }}
                prefix={<ApartmentOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
              />
            </Card>
          </Col>
        </Row>

        {/* Second row: System info + LLM status */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={14}>
            <Card title={<Space><ApartmentOutlined />系统信息</Space>} loading={dashLoading}>
              {s ? (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <Row gutter={24}>
                    <Col span={8}>
                      <div>
                        <span style={{ color: '#888', fontSize: 12 }}>数据库</span>
                        <div><Tag color="blue">PostgreSQL 16</Tag></div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div>
                        <span style={{ color: '#888', fontSize: 12 }}>大小</span>
                        <div><strong>{s.database.size_mb} MB</strong></div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div>
                        <span style={{ color: '#888', fontSize: 12 }}>数据表</span>
                        <div><strong>{s.database.table_count} 张</strong></div>
                      </div>
                    </Col>
                  </Row>
                  <Row gutter={24}>
                    <Col span={8}>
                      <div>
                        <span style={{ color: '#888', fontSize: 12 }}>总记录</span>
                        <div><strong>{s.database.total_rows} 条</strong></div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div>
                        <span style={{ color: '#888', fontSize: 12 }}>Python</span>
                        <div><Tag>Python {s.server.python}</Tag></div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div>
                        <span style={{ color: '#888', fontSize: 12 }}>运行时长</span>
                        <div><strong>{uptimeMin > 60 ? Math.floor(uptimeMin / 60) + 'h ' + uptimeMin % 60 + 'm' : uptimeMin + ' 分钟'}</strong></div>
                      </div>
                    </Col>
                  </Row>
                </Space>
              ) : null}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={<Space><ThunderboltOutlined />大模型状态</Space>} loading={dashLoading}>
              {s ? (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <div>
                    <span style={{ color: '#888', fontSize: 12 }}>当前服务商</span>
                    <div><Tag color={s.llm.current === 'deepseek' ? 'purple' : 'blue'}>{s.llm.current === 'deepseek' ? 'DeepSeek' : 'Ollama'}</Tag></div>
                  </div>
                  <div>
                    <span style={{ color: '#888', fontSize: 12 }}>当前模型</span>
                    <div><code>{s.llm.model || '未配置'}</code></div>
                  </div>
                </Space>
              ) : null}
            </Card>
          </Col>
        </Row>

        {/* Quick actions */}
        <Card title="快捷操作">
          <Row gutter={[12, 12]}>
            {[
              { href: '/admin/basic-config', icon: <AppstoreOutlined />, color: '#fa8c16', bg: '#fff7e6', label: '应用参数', desc: '学科管理、判卷/错题本设置' },
              { href: '/admin/sys-admin', icon: <UserOutlined />, color: '#722ed1', bg: '#f9f0ff', label: '管理员账号', desc: '管理教师和题库管理员' },
              { href: '/admin/config', icon: <SettingOutlined />, color: '#1890ff', bg: '#e6f7ff', label: '系统配置', desc: '大模型、OCR、数据库设置' },
            ].map((item) => (
              <Col span={12} key={item.label}>
                <a href={item.href} style={{ display: 'block', padding: '16px 12px', background: item.bg, borderRadius: 10, border: '1px solid ' + item.color + '20', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: item.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: item.color }}>{item.icon}</div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#333', fontSize: 13 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{item.desc}</div>
                    </div>
                  </div>
                </a>
              </Col>
            ))}
          </Row>
        </Card>
      </div>
    );
  }

  return null;
}
