import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Modal, Button, Radio, Checkbox, Input, Typography, message, Spin, Tag, Space, Card, Tooltip,
} from 'antd';
import { useExamTimer, formatTime } from '../../hooks/useExamTimer';
import { paperApi } from '../../api/papers';

const { Text, Title } = Typography;
const { TextArea } = Input;

// ── Types ──

interface QuestionOption {
  label: string;
  text: string;
}

interface QuestionData {
  id: string;
  title: string;
  question_type: string;
  difficulty?: string;
  options?: QuestionOption[];
  correct_answer?: string;
  explanation?: string;
  score?: number;
}

interface UnitQuestion {
  id?: string;
  question_id: string;
  question_type: string;
  position: number;
  score: number;
  question?: QuestionData;
}

interface AnswerUnit {
  id: string;
  name: string;
  description?: string;
  position: number;
  time_limit_minutes?: number | null;
  total_score?: number;
  questions: UnitQuestion[];
}

interface PaperAnswerData {
  id: string;
  title: string;
  subtitle?: string;
  instructions?: string;
  duration_minutes?: number | null;
  total_score?: number;
  units: AnswerUnit[];
}

// ── Helpers ──

const STORAGE_KEY_PREFIX = 'answers_';
const FLAG_KEY_PREFIX = 'flagged_';

function getSavedAnswers(paperId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + paperId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getSavedFlags(paperId: string): string[] {
  try {
    const raw = localStorage.getItem(FLAG_KEY_PREFIX + paperId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAnswers(paperId: string, answers: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY_PREFIX + paperId, JSON.stringify(answers));
}

function saveFlags(paperId: string, flags: string[]) {
  localStorage.setItem(FLAG_KEY_PREFIX + paperId, JSON.stringify(flags));
}

function clearSavedData(paperId: string) {
  localStorage.removeItem(STORAGE_KEY_PREFIX + paperId);
  localStorage.removeItem(FLAG_KEY_PREFIX + paperId);
}

// ── Component ──

export default function StudentAnswerPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();

  // Core state
  const [paper, setPaper] = useState<PaperAnswerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [lockedUnits, setLockedUnits] = useState<Set<string>>(new Set());
  const [startedUnits, setStartedUnits] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [fontSize, setFontSize] = useState(16);

  // Auto-save timer display
  const [autoSaved, setAutoSaved] = useState('');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const questionContainerRef = useRef<HTMLDivElement>(null);

  // ── Derived ──

  const currentUnit = useMemo(() => {
    if (!paper?.units?.length) return null;
    return paper.units[currentUnitIndex] || null;
  }, [paper, currentUnitIndex]);

  const isLastUnit = paper ? currentUnitIndex === paper.units.length - 1 : false;

  const questionList = useMemo(() => {
    return currentUnit?.questions || [];
  }, [currentUnit]);

  const answeredCount = useMemo(() => {
    return questionList.filter(q => answers[q.question_id]?.trim()).length;
  }, [questionList, answers]);

  // ── Paper Timer (overall) ──

  const paperTimer = useExamTimer({
    timeLimitMinutes: paper?.duration_minutes,
    warningThresholdMinutes: 5,
  });

  // ── Unit Timer ──

  const handleUnitExpire = useCallback(() => {
    // Auto-save current answers
    if (paperId) saveAnswers(paperId, answers);

    let countdown = 5;
    const modal = Modal.info({
      title: '本单元答题时间到',
      content: `答案已自动保存，将在 ${countdown} 秒后自动进入下一单元`,
      okText: '立即进入下一单元',
      onOk: () => {
        clearInterval(timer);
        modal.destroy();
        performSubmitUnit();
      },
    });

    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        modal.destroy();
        performSubmitUnit();
      } else {
        modal.update({
          content: `答案已自动保存，将在 ${countdown} 秒后自动进入下一单元`,
        });
      }
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, answers, currentUnit]);

  const unitTimer = useExamTimer({
    timeLimitMinutes: currentUnit?.time_limit_minutes,
    warningThresholdMinutes: 2,
    onExpire: handleUnitExpire,
  });

  // ── Load paper data ──

  useEffect(() => {
    if (!paperId) return;
    setLoading(true);
    paperApi.preview(paperId)
      .then((resp: any) => {
        const data = resp.data || resp;
        setPaper(data);
        // Restore saved answers
        const saved = getSavedAnswers(paperId);
        setAnswers(saved);
        // Restore saved flags
        const savedFlags = getSavedFlags(paperId);
        setFlaggedQuestions(new Set(savedFlags));
        // Start paper timer
        if (data.duration_minutes) {
          // Start will be triggered by a separate effect
        }
      })
      .catch(() => {
        message.error('加载试卷失败');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  // Start paper timer when paper loads
  useEffect(() => {
    if (paper?.duration_minutes) {
      paperTimer.start();
    }
    return () => paperTimer.pause();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper?.duration_minutes]);

  // ── Manage unit timer when switching units ──

  useEffect(() => {
    unitTimer.reset();
    const unit = currentUnit;
    if (unit?.time_limit_minutes && startedUnits.has(unit.id)) {
      unitTimer.start();
    }
    // Cleanup on unmount
    return () => unitTimer.pause();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUnitIndex]);

  // ── Font size CSS variable ──

  useEffect(() => {
    document.documentElement.style.setProperty('--question-font-size', `${fontSize}px`);
    return () => {
      document.documentElement.style.removeProperty('--question-font-size');
    };
  }, [fontSize]);

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle 1/2/3/4 when no input/textarea is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key;
      if (!['1', '2', '3', '4'].includes(key)) return;

      const currentQ = questionList.find(q => q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE');
      if (!currentQ) return;

      const labels = ['A', 'B', 'C', 'D'];
      const idx = parseInt(key) - 1;
      const label = labels[idx];
      if (!label) return;

      if (currentQ.question_type === 'SINGLE_CHOICE') {
        handleAnswerChange(currentQ.question_id, label);
      } else if (currentQ.question_type === 'MULTIPLE_CHOICE') {
        const current = answers[currentQ.question_id] || '';
        const selected = current ? current.split(',') : [];
        const set_ = new Set(selected);
        if (set_.has(label)) {
          set_.delete(label);
        } else {
          set_.add(label);
        }
        handleAnswerChange(currentQ.question_id, Array.from(set_).sort().join(','));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionList, answers]);

  // ── Handlers ──

  const handleAnswerChange = useCallback((qid: string, value: string) => {
    setAnswers(prev => {
      const next = { ...prev, [qid]: value };
      if (paperId) saveAnswers(paperId, next);
      return next;
    });
    // Show "已自动保存" indicator
    setAutoSaved('已自动保存');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => setAutoSaved(''), 3000);
  }, [paperId]);

  const toggleFlag = useCallback((qid: string) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(qid)) {
        next.delete(qid);
      } else {
        next.add(qid);
      }
      if (paperId) saveFlags(paperId, Array.from(next));
      return next;
    });
  }, [paperId]);

  const clearAnswer = useCallback((qid: string) => {
    handleAnswerChange(qid, '');
  }, [handleAnswerChange]);

  const scrollToQuestion = useCallback((qid: string) => {
    const el = document.getElementById('q-' + qid);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const jumpToNextUnanswered = useCallback(() => {
    if (!questionList.length) return;
    const firstUnanswered = questionList.find(q => !answers[q.question_id]?.trim());
    if (firstUnanswered) {
      scrollToQuestion(firstUnanswered.question_id);
    } else {
      message.success('本单元所有题目已作答');
    }
  }, [questionList, answers, scrollToQuestion]);

  // ── Unit Switching ──

  const switchToUnit = useCallback((index: number) => {
    if (!paper) return;
    const targetUnit = paper.units[index];
    if (!targetUnit) return;

    // Check if locked
    if (lockedUnits.has(targetUnit.id)) return;

    // If unit has time limit and not started, prompt
    if (targetUnit.time_limit_minutes && !startedUnits.has(targetUnit.id)) {
      Modal.confirm({
        title: '进入单元',
        content: `进入后将开始 ${targetUnit.time_limit_minutes} 分钟倒计时，确定吗？`,
        okText: '确定',
        cancelText: '取消',
        onOk: () => {
          setStartedUnits(prev => new Set(prev).add(targetUnit.id));
          setCurrentUnitIndex(index);
        },
      });
      return;
    }

    setCurrentUnitIndex(index);
  }, [paper, lockedUnits, startedUnits]);

  // ── Submit ──

  const performSubmitUnit = useCallback(async () => {
    if (!paperId || !currentUnit) return;
    setSubmitting(true);
    try {
      const body = {
        answers: currentUnit.questions.map(q => ({
          question_id: q.question_id,
          student_answer: answers[q.question_id] || '',
        })),
      };
      await paperApi.submitUnit(paperId, currentUnit.id, body);
      message.success(`"${currentUnit.name}" 已提交`);

      // Lock unit
      setLockedUnits(prev => new Set(prev).add(currentUnit.id));

      if (isLastUnit) {
        clearSavedData(paperId);
        navigate(`/answer/${paperId}/complete`);
      } else {
        // Move to next unit
        setCurrentUnitIndex(prev => prev + 1);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '提交失败，请重试';
      message.error(detail);
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, currentUnit, answers, isLastUnit, navigate]);

  const submitUnit = useCallback(async () => {
    if (!paperId || !currentUnit) return;

    const unanswered = currentUnit.questions.filter(q => !answers[q.question_id]?.trim());
    const flagged = currentUnit.questions.filter(q => flaggedQuestions.has(q.question_id));

    // If all answered and nothing flagged, skip confirm
    if (unanswered.length === 0 && flagged.length === 0) {
      await performSubmitUnit();
      return;
    }

    const content = (
      <div>
        {unanswered.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <Text type="danger">未答题 ({unanswered.length})：</Text>
            <Text>{unanswered.map(q => q.position).join('、')}</Text>
          </div>
        )}
        {flagged.length > 0 && (
          <div>
            <Text type="warning">标记题 ({flagged.length})：</Text>
            <Text>{flagged.map(q => q.position).join('、')}</Text>
          </div>
        )}
      </div>
    );

    const confirmed = await new Promise<boolean>(resolve => {
      Modal.confirm({
        title: isLastUnit ? '确认交卷' : `确认提交"${currentUnit.name}"`,
        content,
        okText: isLastUnit ? '确认交卷' : '确认提交',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (confirmed) {
      await performSubmitUnit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, currentUnit, answers, flaggedQuestions, isLastUnit, performSubmitUnit]);

  // ── Render helpers ──

  const getQuestionStatus = (qid: string): 'answered' | 'current' | 'unanswered' | 'flagged' => {
    if (flaggedQuestions.has(qid)) return 'flagged';
    if (answers[qid]?.trim()) return 'answered';
    return 'unanswered';
  };

  const statusColor: Record<string, string> = {
    answered: '#52c41a',
    unanswered: '#d9d9d9',
    flagged: '#fa8c16',
  };

  const statusLabel: Record<string, string> = {
    answered: '已答',
    unanswered: '未答',
    flagged: '标记',
  };

  const renderQuestionNav = () => {
    if (!questionList.length) return null;
    return (
      <div style={{
        width: 52,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
        padding: '8px 4px',
        background: '#fafafa',
        borderRadius: 6,
      }}>
        <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginBottom: 4 }}>题号</div>
        {questionList.map(q => {
          const status = getQuestionStatus(q.question_id);
          return (
            <Tooltip key={q.question_id} title={`${q.position}. ${statusLabel[status]}`} placement="left">
              <div
                onClick={() => scrollToQuestion(q.question_id)}
                style={{
                  width: 32,
                  height: 32,
                  margin: '3px auto',
                  borderRadius: '50%',
                  background: statusColor[status],
                  color: status === 'unanswered' ? '#555' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: status === 'flagged' ? 'bold' : 'normal',
                  border: status === 'unanswered' ? '2px solid #bbb' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {q.position}
              </div>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  const renderQuestion = (q: UnitQuestion, _isFirstChoice: boolean) => {
    const qid = q.question_id;
    const qData = q.question;
    const title = qData?.title || '';
    const options = qData?.options || [];
    const qType = q.question_type;
    const isFlagged = flaggedQuestions.has(qid);
    const currentAnswer = answers[qid] || '';

    let answerControl: React.ReactNode = null;

    if (qType === 'SINGLE_CHOICE' && options.length > 0) {
      answerControl = (
        <Radio.Group
          value={currentAnswer || undefined}
          onChange={e => handleAnswerChange(qid, e.target.value)}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {options.map(o => (
              <Radio key={o.label} value={o.label} style={{ fontSize: 'var(--question-font-size, 16px)' }}>
                <Text style={{ fontSize: 'var(--question-font-size, 16px)' }}>
                  {o.label}. {o.text}
                </Text>
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      );
    } else if (qType === 'MULTIPLE_CHOICE' && options.length > 0) {
      const selected = currentAnswer ? currentAnswer.split(',').filter(Boolean) : [];
      answerControl = (
        <Checkbox.Group
          value={selected}
          onChange={(vals: (string | number | boolean)[]) => {
            const strVals = vals.map(String).sort();
            handleAnswerChange(qid, strVals.join(','));
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {options.map(o => (
              <Checkbox key={o.label} value={o.label} style={{ fontSize: 'var(--question-font-size, 16px)' }}>
                <Text style={{ fontSize: 'var(--question-font-size, 16px)' }}>
                  {o.label}. {o.text}
                </Text>
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      );
    } else if (qType === 'FILL_BLANK') {
      answerControl = (
        <Input
          value={currentAnswer}
          onChange={e => handleAnswerChange(qid, e.target.value)}
          placeholder="请输入答案"
          style={{ width: 300, fontSize: 'var(--question-font-size, 16px)' }}
          allowClear
        />
      );
    } else if (qType === 'SUBJECTIVE') {
      answerControl = (
        <TextArea
          value={currentAnswer}
          onChange={e => handleAnswerChange(qid, e.target.value)}
          placeholder="请输入解答内容"
          rows={4}
          style={{ fontSize: 'var(--question-font-size, 16px)' }}
        />
      );
    }

    return (
      <div
        id={'q-' + qid}
        key={qid}
        style={{
          marginBottom: 16,
          padding: 16,
          border: '1px solid #e8e8e8',
          borderRadius: 8,
          background: '#fff',
          transition: 'box-shadow 0.2s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Text strong style={{ fontSize: 'var(--question-font-size, 16px)' }}>
              {q.position}. {title}
            </Text>
            <Tag style={{ marginLeft: 8 }} color="blue">
              {qType === 'SINGLE_CHOICE' ? '单选题' :
               qType === 'MULTIPLE_CHOICE' ? '多选题' :
               qType === 'FILL_BLANK' ? '填空题' : '解答题'}
            </Tag>
            <Text type="secondary" style={{ marginLeft: 4, fontSize: 13 }}>({q.score}分)</Text>
          </div>
          <Space>
            <Button
              size="small"
              type={isFlagged ? 'primary' : 'default'}
              danger={isFlagged}
              icon={<span>{isFlagged ? '🏴' : '🏳'}</span>}
              onClick={() => toggleFlag(qid)}
              style={{ fontSize: 12 }}
            >
              {isFlagged ? '已标记' : '标记'}
            </Button>
            {currentAnswer && (
              <Button size="small" onClick={() => clearAnswer(qid)} style={{ fontSize: 12 }}>
                清除
              </Button>
            )}
          </Space>
        </div>
        <div style={{ paddingLeft: 8 }}>{answerControl}</div>
      </div>
    );
  };

  const renderUnitTabs = () => {
    if (!paper?.units?.length) return null;
    return (
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '8px 16px',
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        overflowX: 'auto',
        position: 'sticky',
        top: 48,
        zIndex: 9,
      }}>
        {paper.units.map((unit, idx) => {
          const isLocked = lockedUnits.has(unit.id);
          const isCurrent = idx === currentUnitIndex;
          const unitStarted = startedUnits.has(unit.id);
          const unitAnswered = paper.units[idx]?.questions?.filter(q => answers[q.question_id]?.trim()).length || 0;
          const unitTotal = paper.units[idx]?.questions?.length || 0;

          return (
            <div
              key={unit.id || idx}
              onClick={() => !isLocked && switchToUnit(idx)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                background: isCurrent ? '#e6f4ff' : isLocked ? '#f5f5f5' : '#fafafa',
                border: isCurrent ? '2px solid #1677ff' : '1px solid #d9d9d9',
                opacity: isLocked ? 0.5 : 1,
                whiteSpace: 'nowrap',
                fontSize: 13,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isLocked ? ' ' : ''}
              <span>{isLocked ? ' ' : ''}{isCurrent ? '● ' : ''}{unit.name}</span>
              {isLocked && (
                <Tag color="green" style={{ margin: 0, lineHeight: '16px', fontSize: 11 }}>已提交</Tag>
              )}
              {unit.time_limit_minutes && unitStarted && !isLocked && (
                <span style={{
                  color: unitTimer.isWarning ? '#ff4d4f' : '#666',
                  fontWeight: unitTimer.isWarning ? 'bold' : 'normal',
                  fontSize: 12,
                  marginLeft: 4,
                }}>
                  {formatTime(unitTimer.remaining)}
                </span>
              )}
              {unit.time_limit_minutes && !unitStarted && !isLocked && (
                <span style={{ color: '#999', fontSize: 12, marginLeft: 4 }}>
                  {unit.time_limit_minutes}分
                </span>
              )}
              {!isLocked && (
                <span style={{ color: '#999', fontSize: 11, marginLeft: 4 }}>
                  {unitAnswered}/{unitTotal}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTopBar = () => {
    if (!paper) return null;

    const totalQuestions = paper.units.reduce((sum, u) => sum + (u.questions?.length || 0), 0);
    const totalAnswered = paper.units.reduce((sum, u) => {
      return sum + (u.questions?.filter(q => answers[q.question_id]?.trim()).length || 0);
    }, 0);
    const lockedCount = paper.units.filter(u => lockedUnits.has(u.id)).length;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: 48,
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {paper.duration_minutes && (
            <span style={{
              fontWeight: 'bold',
              color: paperTimer.isWarning ? '#ff4d4f' : '#333',
              animation: paperTimer.isWarning ? 'pulse 1s infinite' : 'none',
              fontSize: 15,
            }}>
              整卷剩余: {formatTime(paperTimer.remaining)}
            </span>
          )}
          <Text strong style={{ fontSize: 15 }} ellipsis={{ tooltip: paper.title }}>
            {paper.title}
          </Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            已答:{totalAnswered}/{totalQuestions}
          </Text>
          {lockedCount > 0 && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              已提交:{lockedCount}单元
            </Text>
          )}
          {autoSaved && (
            <Text type="secondary" style={{ fontSize: 12, color: '#52c41a' }}>{autoSaved}</Text>
          )}
          <Space size={4}>
            <Button
              size="small"
              disabled={fontSize <= 12}
              onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
              style={{ fontSize: 11, padding: '0 6px' }}
            >
              A-
            </Button>
            <Button
              size="small"
              onClick={() => setFontSize(16)}
              style={{ fontSize: 11, padding: '0 6px' }}
            >
              A
            </Button>
            <Button
              size="small"
              disabled={fontSize >= 24}
              onClick={() => setFontSize(prev => Math.min(24, prev + 2))}
              style={{ fontSize: 11, padding: '0 6px' }}
            >
              A+
            </Button>
          </Space>
        </div>
      </div>
    );
  };

  const renderBottomBar = () => {
    if (!currentUnit) return null;

    const isLocked = lockedUnits.has(currentUnit.id);
    const canGoPrev = currentUnitIndex > 0 && !lockedUnits.has(paper!.units[currentUnitIndex - 1].id);

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: '#fff',
        borderTop: '1px solid #e8e8e8',
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
      }}>
        <Space>
          <Button
            disabled={!canGoPrev}
            onClick={() => switchToUnit(currentUnitIndex - 1)}
          >
            上一单元
          </Button>
        </Space>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            本单元已答 {answeredCount}/{questionList.length}
          </Text>
          {questionList.some(q => !answers[q.question_id]?.trim()) && (
            <Button size="small" onClick={jumpToNextUnanswered} type="link">
              跳到下一未答题
            </Button>
          )}
        </div>
        <Space>
          <Button
            type="primary"
            loading={submitting}
            disabled={isLocked}
            onClick={submitUnit}
          >
            {isLastUnit ? '交卷' : `提交${currentUnit.name}`}
          </Button>
        </Space>
      </div>
    );
  };

  // ── Pulse animation ──

  const pulseStyle = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;

  // ── Main Render ──

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" tip="加载试卷中..." />
      </div>
    );
  }

  if (!paper) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Text type="danger">试卷加载失败或不存在</Text>
        <br />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/my-papers')}>
          返回我的试卷
        </Button>
      </div>
    );
  }

  if (!paper.units?.length) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Text>试卷暂无单元</Text>
        <br />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/my-papers')}>
          返回我的试卷
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh' }}>
      <style>{pulseStyle}</style>

      {/* Top Bar */}
      {renderTopBar()}

      {/* Unit Tabs */}
      {renderUnitTabs()}

      {/* Question area */}
      <div style={{ display: 'flex', gap: 12, padding: 12 }}>
        {/* Question Navigation */}
        {renderQuestionNav()}

        {/* Questions */}
        <div ref={questionContainerRef} style={{ flex: 1, minWidth: 0 }}>
          {/* Unit Header */}
          <div style={{ marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>
              {currentUnit?.name || ''}
              {currentUnit?.total_score ? ` (${currentUnit.total_score}分)` : ''}
            </Title>
            {currentUnit?.description && (
              <Text type="secondary" style={{ fontSize: 13 }}>{currentUnit.description}</Text>
            )}
          </div>

          {/* Questions */}
          {questionList.length === 0 ? (
            <Card><Text type="secondary">本单元暂无题目</Text></Card>
          ) : (
            questionList.map(q => renderQuestion(q, false))
          )}

          {/* Bottom padding for bottom bar */}
          <div style={{ height: 16 }} />
        </div>
      </div>

      {/* Bottom Bar */}
      {renderBottomBar()}
    </div>
  );
}
