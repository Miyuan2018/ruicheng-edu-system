import { AnimatePresence } from 'framer-motion';
import type { PandaEmotion } from '../types';
import { getBubbleConfig } from '../types';
import FloatingBubble from './FloatingBubble';

interface FloatingBubbleSystemProps {
  emotion: PandaEmotion;
  stepIndex: number;
  text: string;
}

function FloatingBubbleSystem({ emotion, stepIndex, text }: FloatingBubbleSystemProps) {
  const bubbles = getBubbleConfig(emotion, stepIndex, text);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      <AnimatePresence>
        {bubbles.map((bubble, i) => (
          <FloatingBubble key={bubble.id} bubble={bubble} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default FloatingBubbleSystem;
