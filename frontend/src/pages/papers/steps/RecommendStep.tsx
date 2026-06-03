import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, Button, Tag, Space, message, Spin, Empty, Popconfirm, Tooltip, Drawer, Input } from 'antd';
import { SyncOutlined, SwapOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { usePaperEditorStore } from '../../../store/paperEditor';
import { paperApi } from '../../../api/papers';
import type { ExamPaperUnitQuestion, AlternativeQuestion } from '../../../types/paper';

const DIFF_COLORS: Record<string, string> = { EASY: '#52c41a', MEDIUM: '#faad14', HARD: '#ff4d4f' };
const DIFF_LABELS: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
const QTYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', FILL_BLANK: '填空题', SUBJECTIVE: '解答题',
};

export default function RecommendStep() {
  const {
    paper, generateReport,
    removeQuestionFromUnit, clearAllQuestions, setDirty,
    regenerateAll, fillGaps, replaceQuestion, syncScoresFromConfig, autoSave,
  } = usePaperEditorStore();

  const hasAutoAdjusted = useRef(false);

  // 到步即自动检测缺口或自动选题
  useEffect(() => {
    if (hasAutoAdjusted.current) return;
    const units = paper?.units || [];
    const hasConfigs = units.some(u => (u.question_config || []).some(c => (c.count || 0) > 0));
    if (!hasConfigs) return;

    const hasExistingQuestions = units.some(u => (u.questions || []).length > 0);

    if (hasExistingQuestions) {
      hasAutoAdjusted.current = true;
      // 强制同步所有题目分数为 config 卷面分
      syncScoresFromConfig();
      const hasGaps = units.some(u =>
        (u.question_config || []).some(cfg => {
          const existing = (u.questions || []).filter(q => q.question_type === cfg.question_type).length;
          return cfg.count > existing;
        })
      );
      if (hasGaps) {
        setLoading(true);
        fillGaps().then(() => {
          message.info('已自动补充缺口题目');
        }).catch((e: any) => {
          const detail = e?.response?.data?.detail || e?.message || '自动补充缺口失败';
          message.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }).finally(() => setLoading(false));
      }
    } else {
      hasAutoAdjusted.current = true;
      setLoading(true);
      regenerateAll().then(() => {
        message.success('已自动生成题目');
      }).catch((e: any) => {
        const detail = e?.response?.data?.detail || e?.message || '自动选题失败';
        message.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }).finally(() => setLoading(false));
    }
    // Zustand actions 和 antd message 引用稳定，不需要加入依赖数组
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper?.units]);

  const [loading, setLoading] = useState(false);
  // loading 状态用于按钮和自动触发的加载反馈
  const [swapLoading, setSwapLoading] = useState<Record<string, boolean>>({});

  // 手工选题抽屉
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState<{ questionId: string; unitId: string; questionType: string } | null>(null);
  const [manualResults, setManualResults] = useState<any[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualKeyword, setManualKeyword] = useState('');

  const openManualSelect = (questionId: string, unitId: string, questionType: string) => {
    setManualTarget({ questionId, unitId, questionType });
    setManualKeyword('');
    setManualResults([]);
    setManualOpen(true);
    fetchManualResults(questionType, '');
  };

  const fetchManualResults = async (questionType: string, keyword: string) => {
    setManualLoading(true);
    try {
      const grades = paper?.grade_level?.grades || [];
      const params: any = {
        question_type: questionType,
        subject: paper?.subject || undefined,
        keyword: keyword || undefined,
        review_status: 'APPROVED',
        limit: 30,
      };
      if (grades.length === 1) params.grade = grades[0];
      else if (grades.length > 1) params.grade_level = grades[0]; // API 仅支持单年级过滤
      const resp = await paperApi.getQuestions(params);
      const data = Array.isArray(resp.data) ? resp.data : (resp.data?.items || resp.data?.data || []);
      // 排除已在试卷中的题
      const allQids = new Set((paper?.units || []).flatMap(u => (u.questions || []).map(q => q.question_id)));
      setManualResults(data.filter((q: any) => !allQids.has(q.id)));
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || '获取题目失败';
      message.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      setManualResults([]);
    } finally {
      setManualLoading(false);
    }
  };

  const handleManualReplace = (newQ: any) => {
    if (!manualTarget || !paper) return;
    const { questionId, unitId } = manualTarget;
    const unit = paper.units?.find(u => u.id === unitId);
    const oldQ = unit?.questions?.find(q => q.question_id === questionId);
    // 用配置的 score_per_question 而非题目默认分
    const cfg = unit?.question_config?.find(c => c.question_type === manualTarget.questionType);
    const score = cfg?.score_per_question || newQ.score || 5;
    replaceQuestion(unitId, questionId, {
      question_id: newQ.id,
      question_type: newQ.question_type,
      position: oldQ?.position || 0,
      score,
      question: {
        id: newQ.id, title: newQ.title,
        question_type: newQ.question_type,
        difficulty: newQ.difficulty,
        subject: newQ.subject || paper.subject,
      },
      recommendation_tags: ['手工选择'],
    });
    setDirty(true);
    message.success('已更换');
    setManualOpen(false);
  };

  const units = paper?.units || [];

  const handleSwap = async (questionId: string, unitId: string) => {
    setSwapLoading(prev => ({ ...prev, [questionId]: true }));
    try {
      const st = usePaperEditorStore.getState();
      const p = st.paper;
      const allQids = (p?.units || []).flatMap(u =>
        (u.questions || []).map(q => q.question_id)
      );
      const resp = await paperApi.swapQuestionPaperless(questionId, {
        subject: p?.subject,
        grade_level: p?.grade_level,
        knowledge_node_ids: p?.knowledge_node_ids,
        exclude_ids: allQids,
      });
      const alts: any[] = resp.data?.alternatives || [];
      if (alts.length === 0) { message.warning('没有可替换的题目'); return; }
      const alt = alts[0];
      const remainingAlts: AlternativeQuestion[] = alts.slice(1).map((a: any) => ({
        question_id: a.question_id,
        title: a.title || '',
        difficulty: a.difficulty || '',
        tags: a.tags || [],
      }));
      const unit = units.find(u => u.id === unitId);
      const oldQ = unit?.questions?.find(q => q.question_id === questionId);
      const cfg = unit?.question_config?.find(c => c.question_type === alt.question_type);
      const swapScore = cfg?.score_per_question || alt.score || 5;
      replaceQuestion(unitId, questionId, {
        question_id: alt.question_id,
        question_type: alt.question_type,
        position: oldQ?.position || 0,
        score: swapScore,
        question: {
          id: alt.question_id,
          title: alt.title,
          question_type: alt.question_type,
          difficulty: alt.difficulty,
          subject: p?.subject,
        },
        recommendation_tags: ['已替换'],
        alternatives: remainingAlts,
      });
      setDirty(true);
      message.success('已替换');
    } catch {
      message.error('换题失败');
    } finally {
      setSwapLoading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleRemove = (unitId: string, questionId: string) => {
    removeQuestionFromUnit(unitId, questionId);
    setDirty(true);
  };

  // Constraint dashboard
  const dashboard = generateReport?.constraint_dashboard;
  const renderDashboard = () => {
    if (!dashboard) return null;
    const scoreOk = dashboard.total_score === dashboard.requested_score;
    const shortfall = dashboard.shortfall || [];
    return (
      <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, alignItems: 'flex-start' }}>
          <div>
            <span style={{ color: '#888', marginRight: 8 }}>难度分布</span>
            {Object.entries(dashboard.difficulty || {}).map(([diff, info]: [string, any]) => (
              <Tag key={diff} color={info.matched ? 'success' : 'error'} style={{ fontSize: 11 }}>
                {DIFF_LABELS[diff]} {info.actual}/{info.target}
                {info.matched ? ' ✓' : ' ⚠'}
              </Tag>
            ))}
          </div>
          <div>
            <span style={{ color: '#888', marginRight: 8 }}>总分</span>
            <Tag color={scoreOk ? 'success' : 'error'}>
              {dashboard.total_score}/{dashboard.requested_score}
              {scoreOk ? ' ✓' : ' ⚠'}
            </Tag>
          </div>
          {shortfall.length > 0 && (
            <div style={{ color: '#ff4d4f', fontSize: 12, lineHeight: 1.6 }}>
              <span>题库不足 {shortfall.length} 题：</span>
              {shortfall.map((s, i) => (
                <span key={i}>
                  {(DIFF_LABELS[s.target_difficulty] || s.target_difficulty) + '·' + (s.question_type ? QTYPE_LABELS[s.question_type] || s.question_type : '')}
                  {i < shortfall.length - 1 ? '、' : ''}
                </span>
              ))}
              <span style={{ marginLeft: 4, color: '#999' }}>
                （已放宽难度约束，仍缺{shortfall.length}题）
              </span>
            </div>
          )}
        </div>
      </Card>
    );
  };

  // Group by question type from paper.units
  const groupedByType = useMemo(() => {
    const groups: Record<string, ExamPaperUnitQuestion[]> = {};
    (paper?.units || []).forEach(unit => {
      (unit.questions || []).forEach(q => {
        const qt = q.question_type || 'SINGLE_CHOICE';
        if (!groups[qt]) groups[qt] = [];
        groups[qt].push(q);
      });
    });
    return groups;
  }, [paper?.units]);

  const totalQCount = (paper?.units || []).reduce((s, u) => s + (u.questions?.length || 0), 0);

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          {totalQCount > 0 ? (
            <span style={{ fontSize: 13, color: '#666' }}>共 {totalQCount} 题</span>
          ) : (
            <span style={{ fontSize: 13, color: '#999' }}>点击"一键选题"自动选题</span>
          )}
        </div>
        <Button type="primary" icon={<SyncOutlined />} loading={loading}
          onClick={async () => {
            setLoading(true);
            clearAllQuestions();
            const st = usePaperEditorStore.getState();
            st.regenerateAll().catch((e: any) => {
              const detail = e?.response?.data?.detail || e?.message || '选题失败';
              message.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
            }).finally(() => setLoading(false));
          }}>
          一键选题
        </Button>
      </div>

      {renderDashboard()}

      {loading && <div style={{ textAlign: 'center', padding: 60 }}><Spin tip="正在智能选题..." /></div>}

      {!loading && totalQCount === 0 && <Empty description="尚未生成推荐" style={{ padding: 40 }} />}

      {!loading && Object.entries(groupedByType).map(([qtype, questions]) => {
        const unit = units.find(u => (u.question_config || []).some(c => c.question_type === qtype));
        const unitId = unit?.id || '';
        const typeConfig = unit?.question_config?.find(c => c.question_type === qtype);
        const configCount = typeConfig?.count || 0;
        const excessCount = configCount > 0 ? questions.length - configCount : 0;
        const isExcessType = excessCount > 0;
        return (
          <Card
            key={qtype}
            size="small"
            style={{ marginBottom: 12 }}
            title={<span>{QTYPE_LABELS[qtype] || qtype}<Tag style={{ marginLeft: 8 }}>{questions.length}题</Tag></span>}
          >
            {questions.map((q, qi) => {
              return (
                <div
                  key={q.question_id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '8px 0',
                    borderBottom: qi < questions.length - 1 ? '1px solid #f5f5f5' : 'none',
                    borderLeft: isExcessType ? '3px solid #ff4d4f' : 'none',
                    paddingLeft: isExcessType ? 8 : 0,
                  }}
                >
                  <span style={{ color: '#999', fontSize: 12, minWidth: 24 }}>{qi + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>{q.question?.title || ''}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <Tag color={DIFF_COLORS[q.question?.difficulty || '']} style={{ fontSize: 10 }}>{DIFF_LABELS[q.question?.difficulty || '']}</Tag>
                      <Tag style={{ fontSize: 10 }}>{q.score}分</Tag>
                      {isExcessType && <Tag color="error" style={{ fontSize: 10, marginRight: 4 }}>多余（共多{excessCount}题）</Tag>}
                      {(q.recommendation_tags || []).map((t, i) => (
                        <Tag key={i} color={t.includes('✓') ? 'success' : 'default'} style={{ fontSize: 10 }}>{t}</Tag>
                      ))}
                    </div>
                  </div>
                  <Space size="small" style={{ flexShrink: 0 }}>
                    <Button size="small" type="link" style={{ fontSize: 11 }}
                      onClick={() => openManualSelect(q.question_id, unitId, q.question_type)}>手工选题</Button>
                    <Tooltip title="换一题">
                      <Button size="small" icon={<SwapOutlined />} loading={swapLoading[q.question_id]}
                        onClick={() => handleSwap(q.question_id, unitId)} />
                    </Tooltip>
                    <Popconfirm title="移除此题？" onConfirm={() => handleRemove(unitId, q.question_id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              );
            })}
            {isExcessType && (
              <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 8, padding: '4px 8px', background: '#fff2f0', borderRadius: 4 }}>
                已选 {questions.length}/{configCount} 题，超出 {excessCount} 题（请手动删除多余试题）
              </div>
            )}
          </Card>
        );
      })}

      {/* 手工选题抽屉 */}
      <Drawer
        title="手工选题"
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        width={560}
      >
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索题目关键词..."
            value={manualKeyword}
            onChange={(e) => setManualKeyword(e.target.value)}
            onSearch={(v) => fetchManualResults(manualTarget?.questionType || '', v)}
            enterButton={<><SearchOutlined /> 搜索</>}
            allowClear
          />
        </div>
        <Spin spinning={manualLoading}>
          {manualResults.length === 0 && !manualLoading && (
            <Empty description="未找到匹配题目" />
          )}
          {manualResults.map((q: any) => (
            <Card
              key={q.id}
              size="small"
              hoverable
              style={{ marginBottom: 8 }}
              onClick={() => handleManualReplace(q)}
            >
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{q.title?.substring(0, 120)}</div>
              <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                <Tag color={DIFF_COLORS[q.difficulty] || 'default'} style={{ fontSize: 10 }}>
                  {DIFF_LABELS[q.difficulty] || q.difficulty}
                </Tag>
                {q.subject && <Tag style={{ fontSize: 10 }}>{q.subject}</Tag>}
                <span style={{ fontSize: 11, color: '#999' }}>点击替换</span>
              </div>
            </Card>
          ))}
        </Spin>
      </Drawer>
    </div>
  );
}
