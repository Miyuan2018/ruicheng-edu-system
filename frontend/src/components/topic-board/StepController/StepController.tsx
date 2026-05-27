import { Button, Space } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import type { ExplanationStepData } from '../types';

interface StepControllerProps {
  steps: ExplanationStepData[];
  currentStepIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
}

function StepController({ steps, currentStepIndex, onPrev, onNext, onGoTo }: StepControllerProps) {
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(8px)',
      borderRadius: 12,
      padding: '8px 20px',
      border: '1px solid rgba(92,61,46,0.08)',
    }}>
      <Button
        type="text"
        icon={<LeftOutlined />}
        disabled={isFirst}
        onClick={onPrev}
        size="small"
      />

      <Space size={8}>
        {steps.map((step, i) => (
          <motion.div
            key={step.id}
            onClick={() => onGoTo(i)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              background:
                i === currentStepIndex ? '#E87A5D'
                : i < currentStepIndex ? '#5C3D2E'
                : '#e8e8e8',
              color:
                i <= currentStepIndex ? '#fff' : '#999',
              transition: 'background 0.3s, color 0.3s',
            }}
            animate={i === currentStepIndex ? { scale: [1, 1.12, 1] } : {}}
            transition={{ duration: 0.6, repeat: Infinity }}
            title={`第 ${i + 1} 步`}
          >
            {i < currentStepIndex ? '✓' : i + 1}
          </motion.div>
        ))}
      </Space>

      <Button
        type="text"
        icon={<RightOutlined />}
        disabled={isLast}
        onClick={onNext}
        size="small"
      />
    </div>
  );
}

export default StepController;
