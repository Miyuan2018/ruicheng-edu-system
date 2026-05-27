import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import katex from 'katex';
import type { BubbleInstance } from '../types';
import styles from './FloatingBubble.module.css';

interface FloatingBubbleProps {
  bubble: BubbleInstance;
  index: number;
}

function FloatingBubble({ bubble, index }: FloatingBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.querySelectorAll<HTMLElement>('.math').forEach((el) => {
      const latex = el.dataset.latex;
      if (!latex) return;
      katex.render(latex, el, { throwOnError: false });
    });
  }, [bubble.text]);

  const typeClass =
    bubble.type === 'thought' ? styles.floatingBubbleThought
    : bubble.type === 'callout' ? styles.floatingBubbleCallout
    : styles.floatingBubbleSpeech;

  const sideClass =
    bubble.type === 'thought' ? styles.floatingBubbleTop
    : bubble.side === 'left' ? styles.floatingBubbleLeft
    : styles.floatingBubbleRight;

  const posStyles: React.CSSProperties = (() => {
    switch (bubble.type) {
      case 'thought':
        return { top: '-60px', left: '50%', transform: 'translateX(-50%)' };
      case 'speech':
        return bubble.side === 'left'
          ? { top: '40%', left: '-140px' }
          : { top: '40%', right: '-140px' };
      case 'callout':
        return { top: '55%', right: '-120px' };
      default:
        return { top: '40%', right: '-140px' };
    }
  })();

  return (
    <motion.div
      className={`${styles.floatingBubble} ${typeClass} ${sideClass}`}
      style={posStyles}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -3 - index, 0, 1 + index, 0],
        rotate: [0, 0.8, 0, -0.6, 0],
      }}
      exit={{ opacity: 0, scale: 0.9, y: 8 }}
      transition={{
        opacity: { duration: 0.25 },
        scale: { type: 'spring', stiffness: 180, damping: 15 },
        y: { repeat: Infinity, duration: 3.5 + index, ease: 'easeInOut' },
        rotate: { repeat: Infinity, duration: 4 + index, ease: 'easeInOut' },
      }}
    >
      <div ref={contentRef} dangerouslySetInnerHTML={{ __html: bubble.text }} />
    </motion.div>
  );
}

export default FloatingBubble;
