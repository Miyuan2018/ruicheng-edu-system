import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ChalkboardFrame from './ChalkboardFrame';
import ChalkContent from './ChalkContent';
import type { GraphConfig, ExplanationStepData } from '../types';
import styles from './Chalkboard.module.css';

interface ChalkboardProps {
  problemStatement: string | null;
  graphConfig: GraphConfig | null;
  steps: ExplanationStepData[];
  currentStepIndex: number;
}

const CHALK_CREAM = '#F5F0E8';
const CHALK_YELLOW = '#E8D44D';
const CHALK_RED = '#E87A5D';

function Chalkboard({ problemStatement, graphConfig, steps, currentStepIndex }: ChalkboardProps) {
  const graphRef = useRef<HTMLDivElement>(null);

  // function-plot (dynamic import)
  useEffect(() => {
    if (!graphRef.current || !graphConfig) return;
    const plotEl = graphRef.current;
    let cancelled = false;
    (async () => {
      const mod = await import('function-plot');
      if (cancelled) return;
      const plotFn = (mod as any).default?.default ?? (mod as any).default ?? mod;
      const fn = plotFn as (opts: Record<string, unknown>) => void;
      plotEl.innerHTML = '';
      const data: Record<string, unknown>[] = [
        { fn: graphConfig.fn, color: CHALK_RED, graphType: 'polyline' },
      ];
      if (graphConfig.fn2) data.push({ fn: graphConfig.fn2, color: CHALK_CREAM, graphType: 'polyline' });
      if (graphConfig.fn3) data.push({ fn: graphConfig.fn3, color: CHALK_YELLOW, graphType: 'polyline' });
      if (graphConfig.points) {
        try {
          data.push({
            points: JSON.parse(graphConfig.points),
            fnType: 'points',
            graphType: 'scatter',
            color: CHALK_CREAM,
          });
        } catch { /* ignore parse error */ }
      }
      fn({
        target: plotEl,
        width: plotEl.clientWidth || 260,
        height: 210,
        grid: true,
        xAxis: { domain: [graphConfig.x_min, graphConfig.x_max] },
        yAxis: { domain: [graphConfig.y_min, graphConfig.y_max] },
        data,
      });
    })();
    return () => { cancelled = true; };
  }, [graphConfig]);

  return (
    <ChalkboardFrame>
      <div style={{ padding: '3% 5%', fontSize: 'clamp(14px, 2vw, 20px)', height: '100%', overflow: 'auto' }}>
        {/* Problem statement */}
        {problemStatement && (
          <div style={{ marginBottom: 12, fontSize: 'clamp(15px, 2.2vw, 22px)' }}>
            <ChalkContent html={problemStatement} />
          </div>
        )}

        {/* Graph (if present) — floated right */}
        {graphConfig && (
          <div style={{ float: 'right', width: '35%', minWidth: 170, marginLeft: 12, marginBottom: 8 }}>
            <div ref={graphRef} style={{ minHeight: 210, width: '100%' }} />
          </div>
        )}

        {/* Header */}
        <div className={styles.chalkContent} style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 'clamp(16px, 2.2vw, 22px)' }}>
          <span className={styles.chalkAccentYellow}>解：</span>
        </div>

        {/* Steps revealed one by one */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, clear: 'both' }}>
          {steps.slice(0, currentStepIndex + 1).map((step, i) =>
            step.board_line ? (
              <motion.div
                key={step.id || i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className={`${styles.stepLine} ${i === currentStepIndex ? styles.stepLineActive : ''}`}
              >
                <ChalkContent html={step.board_line} />
              </motion.div>
            ) : null
          )}
        </div>
      </div>
    </ChalkboardFrame>
  );
}

export default Chalkboard;
