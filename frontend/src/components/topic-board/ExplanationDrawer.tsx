import { useEffect, useRef } from 'react';
import { Drawer, Tag, Spin, Button } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import Professor from './Professor/Professor';
import Chalkboard from './Chalkboard/Chalkboard';
import FloatingBubbleSystem from './FloatingBubble/FloatingBubbleSystem';
import StepController from './StepController/StepController';
import useTopicBoardStore from '../../store/useTopicBoardStore';

const AUTOPLAY_INTERVAL = 6000;

const EMOTION_LABEL: Record<string, string> = {
  thinking: '思考中',
  explaining: '讲解中',
  satisfied: '总结',
  idle: '准备',
};

interface ExplanationDrawerProps {
  open: boolean;
  onClose: () => void;
  questionId: string | null;
}

export default function ExplanationDrawer({ open, onClose, questionId }: ExplanationDrawerProps) {
  const currentSession = useTopicBoardStore((s) => s.currentSession);
  const currentStepIndex = useTopicBoardStore((s) => s.currentStepIndex);
  const pandaEmotion = useTopicBoardStore((s) => s.pandaEmotion);
  const isLoading = useTopicBoardStore((s) => s.isLoading);
  const error = useTopicBoardStore((s) => s.error);
  const autoplay = useTopicBoardStore((s) => s.autoplay);
  const fetchSessionByQuestion = useTopicBoardStore((s) => s.fetchSessionByQuestion);
  const goToStep = useTopicBoardStore((s) => s.goToStep);
  const nextStep = useTopicBoardStore((s) => s.nextStep);
  const prevStep = useTopicBoardStore((s) => s.prevStep);
  const toggleAutoplay = useTopicBoardStore((s) => s.toggleAutoplay);
  const reset = useTopicBoardStore((s) => s.reset);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Fetch session when drawer opens
  useEffect(() => {
    if (open && questionId) {
      fetchSessionByQuestion(questionId);
    }
    if (!open) {
      if (timerRef.current) clearInterval(timerRef.current);
      reset();
    }
  }, [open, questionId, fetchSessionByQuestion, reset]);

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

  const handleManualStep = (fn: () => void) => {
    if (autoplay) toggleAutoplay();
    fn();
  };

  const currentStep = currentSession?.steps[currentStepIndex];

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    reset();
    onClose();
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🐼</span>
          <span>试题讲解</span>
          {currentSession && currentSession.title && (
            <span style={{ fontSize: 13, color: '#888', fontWeight: 'normal' }}>
              — {currentSession.title}
            </span>
          )}
        </div>
      }
      placement="right"
      width="80vw"
      open={open}
      onClose={handleClose}
      styles={{
        body: { padding: 0, background: '#F2EFE9' },
      }}
      destroyOnClose
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Tags bar */}
        {currentSession && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.9)',
            borderBottom: '1px solid rgba(232,200,150,0.2)',
            flexShrink: 0,
          }}>
            {currentSession.topic && <Tag color="volcano">{currentSession.topic}</Tag>}
            {currentSession.difficulty_label && <Tag>{currentSession.difficulty_label}</Tag>}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Panda area */}
          <aside style={{
            width: 260,
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
              width: 220,
              height: 280,
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

          {/* Chalkboard area */}
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, minWidth: 0 }}>
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
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: '#999' }}>
                        第 {currentStepIndex + 1} / {currentSession.steps.length} 步
                        {currentStep && (
                          <Tag
                            style={{ marginLeft: 6, fontSize: 11 }}
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

            {!currentSession && !isLoading && !error && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无讲解数据。
              </div>
            )}
          </section>
        </div>
      </div>
    </Drawer>
  );
}
