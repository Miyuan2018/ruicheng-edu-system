import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Select, Tag, Spin, Button } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import Professor from '../../components/topic-board/Professor/Professor';
import Chalkboard from '../../components/topic-board/Chalkboard/Chalkboard';
import FloatingBubbleSystem from '../../components/topic-board/FloatingBubble/FloatingBubbleSystem';
import StepController from '../../components/topic-board/StepController/StepController';
import useTopicBoardStore from '../../store/useTopicBoardStore';

const AUTOPLAY_INTERVAL = 6000;

const EMOTION_LABEL: Record<string, string> = {
  thinking: '思考中',
  explaining: '讲解中',
  satisfied: '总结',
  idle: '准备',
};

export default function TopicBoardPage() {
  const [searchParams] = useSearchParams();
  const sessions = useTopicBoardStore((s) => s.sessions);
  const currentSession = useTopicBoardStore((s) => s.currentSession);
  const currentStepIndex = useTopicBoardStore((s) => s.currentStepIndex);
  const pandaEmotion = useTopicBoardStore((s) => s.pandaEmotion);
  const isLoading = useTopicBoardStore((s) => s.isLoading);
  const error = useTopicBoardStore((s) => s.error);
  const autoplay = useTopicBoardStore((s) => s.autoplay);
  const fetchSessions = useTopicBoardStore((s) => s.fetchSessions);
  const fetchSession = useTopicBoardStore((s) => s.fetchSession);
  const goToStep = useTopicBoardStore((s) => s.goToStep);
  const nextStep = useTopicBoardStore((s) => s.nextStep);
  const prevStep = useTopicBoardStore((s) => s.prevStep);
  const toggleAutoplay = useTopicBoardStore((s) => s.toggleAutoplay);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Load session list on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-select: use ?id= param or first session
  useEffect(() => {
    if (sessions.length === 0) return;
    const queryId = searchParams.get('id');
    if (queryId) {
      fetchSession(queryId);
    } else if (!currentSession) {
      fetchSession(sessions[0].id);
    }
  }, [sessions, searchParams, fetchSession, currentSession]);

  // Autoplay timer
  useEffect(() => {
    if (!autoplay || !currentSession) return;
    timerRef.current = setInterval(() => {
      const { currentStepIndex: idx, currentSession: sess } = useTopicBoardStore.getState();
      if (!sess || idx >= sess.steps.length - 1) {
        toggleAutoplay();
        return;
      }
      goToStep(idx + 1);
    }, AUTOPLAY_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [autoplay, currentSession, goToStep, toggleAutoplay]);

  // Pause autoplay on manual interaction
  const handleManualStep = (fn: () => void) => {
    if (autoplay) toggleAutoplay();
    fn();
  };

  const currentStep = currentSession?.steps[currentStepIndex];

  const selectOptions = sessions.map((s) => ({
    value: s.id,
    label: s.title,
  }));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F2EFE9' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: 'rgba(255,255,255,0.9)',
        borderBottom: '1px solid rgba(232,200,150,0.2)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🐼</span>
          <span style={{ fontSize: 16, fontWeight: 'bold', color: '#2D2D44' }}>讲题板</span>
          {sessions.length > 0 && (
            <Select
              size="small"
              style={{ width: 280 }}
              value={currentSession?.id}
              options={selectOptions}
              onChange={(val) => fetchSession(val)}
              placeholder="选择题目"
            />
          )}
        </div>
        {currentSession && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {currentSession.topic && (
              <Tag color="volcano">{currentSession.topic}</Tag>
            )}
            {currentSession.difficulty_label && (
              <Tag>{currentSession.difficulty_label}</Tag>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Panda area (left) */}
        <aside style={{
          width: 300,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom, #F2EFE9, #EDE8E0)',
          position: 'relative',
          overflow: 'visible',
        }}>
          <div style={{
            position: 'relative',
            width: 240,
            height: 320,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Professor emotion={pandaEmotion} text={currentStep?.text} />
            {currentStep && (
              <FloatingBubbleSystem
                emotion={currentStep.panda_emotion}
                stepIndex={currentStepIndex}
                text={currentStep.text}
              />
            )}
          </div>
        </aside>

        {/* Whiteboard area (right) */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, minWidth: 0 }}>
          {isLoading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin tip="熊猫教授正在准备..." />
            </div>
          )}

          {error && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#ff4d4f' }}>{error}</span>
            </div>
          )}

          {currentSession && !isLoading && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStepIndex}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {/* Chalkboard */}
                <div style={{ flex: 1, minHeight: 0 }}>
                  <Chalkboard
                    problemStatement={currentSession.problem_statement}
                    graphConfig={currentSession.graph_config}
                    steps={currentSession.steps}
                    currentStepIndex={currentStepIndex}
                  />
                </div>

                {/* Step info + autoplay + controller */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: '#999' }}>
                      第 {currentStepIndex + 1} / {currentSession.steps.length} 步
                      {currentStep && (
                        <Tag
                          style={{ marginLeft: 8, fontSize: 11 }}
                          color={currentStep.panda_emotion === 'thinking' ? 'blue' : currentStep.panda_emotion === 'explaining' ? 'orange' : currentStep.panda_emotion === 'satisfied' ? 'green' : 'default'}
                        >
                          {EMOTION_LABEL[currentStep.panda_emotion] || '准备'}
                        </Tag>
                      )}
                    </span>
                    <Button
                      size="small"
                      type={autoplay ? 'primary' : 'default'}
                      icon={autoplay ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                      onClick={toggleAutoplay}
                      style={autoplay ? { background: '#E87A5D', borderColor: '#E87A5D' } : {}}
                    >
                      {autoplay ? '自动播放中' : '自动播放'}
                    </Button>
                  </div>
                  <StepController
                    steps={currentSession.steps}
                    currentStepIndex={currentStepIndex}
                    onPrev={() => handleManualStep(prevStep)}
                    onNext={() => handleManualStep(nextStep)}
                    onGoTo={(i) => handleManualStep(() => goToStep(i))}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {!currentSession && !isLoading && !error && sessions.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              暂无讲解数据，请先添加讲题。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
