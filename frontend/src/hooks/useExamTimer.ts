import { useState, useEffect, useRef, useCallback } from 'react';

interface TimerState {
  elapsed: number;      // seconds elapsed
  remaining: number;    // seconds remaining (0 if no limit)
  isWarning: boolean;   // <= 2min for unit, <= 5min for paper
  isExpired: boolean;   // timer reached 0
}

interface TimerConfig {
  timeLimitMinutes?: number | null;  // null/undefined = no limit
  warningThresholdMinutes?: number;  // default 2 for unit, 5 for paper
  onExpire?: () => void;
}

export function useExamTimer(config: TimerConfig) {
  const { timeLimitMinutes, warningThresholdMinutes = 2, onExpire } = config;
  const totalSeconds = (timeLimitMinutes || 0) * 60;
  const [state, setState] = useState<TimerState>({
    elapsed: 0,
    remaining: totalSeconds,
    isWarning: false,
    isExpired: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const isRunningRef = useRef(false);

  const start = useCallback(() => {
    if (isRunningRef.current || !totalSeconds) return;
    isRunningRef.current = true;
    intervalRef.current = setInterval(() => {
      setState(prev => {
        const newElapsed = prev.elapsed + 1;
        const newRemaining = totalSeconds - newElapsed;
        const warningThreshold = (warningThresholdMinutes || 2) * 60;
        const expired = newRemaining <= 0;
        if (expired) {
          clearInterval(intervalRef.current);
          isRunningRef.current = false;
          onExpireRef.current?.();
        }
        return {
          elapsed: newElapsed,
          remaining: Math.max(0, newRemaining),
          isWarning: !expired && newRemaining <= warningThreshold,
          isExpired: expired,
        };
      });
    }, 1000);
  }, [totalSeconds, warningThresholdMinutes]);

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    isRunningRef.current = false;
  }, []);

  const reset = useCallback(() => {
    pause();
    setState({
      elapsed: 0,
      remaining: totalSeconds,
      isWarning: false,
      isExpired: false,
    });
  }, [totalSeconds, pause]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return { ...state, start, pause, reset, isRunning: isRunningRef.current };
}

/** Format seconds as MM:SS */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
