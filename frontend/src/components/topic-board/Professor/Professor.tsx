import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { PandaEmotion } from '../types';
import styles from './Professor.module.css';

interface ProfessorProps {
  emotion: PandaEmotion;
  text?: string;
}

const MOOD_LABEL: Record<string, string> = {
  idle: '',
  thinking: '思考中...',
  explaining: '讲解中',
  satisfied: '讲完了!',
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function Professor({ emotion, text }: ProfessorProps) {
  const [blink, setBlink] = useState(false);
  const [nod, setNod] = useState(0);
  const blinkRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const speakingRef = useRef(false);

  const scheduleBlink = useCallback(() => {
    blinkRef.current = setTimeout(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
      scheduleBlink();
    }, rand(2000, 5000));
  }, []);

  useEffect(() => {
    scheduleBlink();
    return () => clearTimeout(blinkRef.current);
  }, [scheduleBlink]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNod(rand(-3, 3));
      setTimeout(() => setNod(0), rand(200, 500));
    }, rand(4000, 8000));
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!text || speakingRef.current) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = 0.92;
    utter.pitch = 1.0;

    const voices = synth.getVoices();
    const zhVoice =
      voices.find((v) => v.lang === 'zh-CN' && v.name.includes('Xiao')) ||
      voices.find((v) => v.lang.startsWith('zh')) ||
      voices.find((v) => v.lang === 'zh-CN') ||
      null;
    if (zhVoice) utter.voice = zhVoice;

    speakingRef.current = true;
    utter.onend = () => { speakingRef.current = false; };
    utter.onerror = () => { speakingRef.current = false; };
    synth.speak(utter);
  }, [text]);

  const isClosed = emotion === 'satisfied';
  const eyeExtraClass =
    isClosed ? styles.profEyeClosed
    : blink ? styles.profEyeBlink
    : emotion === 'thinking' ? styles.profEyeHalf
    : emotion === 'explaining' ? styles.profEyeWide
    : '';

  const browStateL =
    emotion === 'thinking' ? styles.profBrowThinkL
    : emotion === 'explaining' ? styles.profBrowRaiseL
    : emotion === 'satisfied' ? styles.profBrowRelaxL
    : '';

  const browStateR =
    emotion === 'thinking' ? styles.profBrowThinkR
    : emotion === 'explaining' ? styles.profBrowRaiseR
    : emotion === 'satisfied' ? styles.profBrowRelaxR
    : '';

  const mouthState =
    emotion === 'thinking' ? styles.profMouthO
    : emotion === 'explaining' ? styles.profMouthWide
    : emotion === 'satisfied' ? styles.profMouthBig
    : styles.profMouthSmile;

  return (
    <motion.div
      className={styles.professor}
      animate={{ rotate: nod * 0.5 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
    >
      {/* Head */}
      <motion.div
        className={styles.profHead}
        animate={{ rotate: emotion === 'thinking' ? -6 : emotion === 'explaining' ? 3 : 0 }}
        transition={{ type: 'spring', stiffness: 80, damping: 14 }}
      >
        <div className={`${styles.profEar} ${styles.profEarL}`} />
        <div className={`${styles.profEar} ${styles.profEarR}`} />
        <div className={styles.profFace} />

        {/* Eyes */}
        <div className={`${styles.profPatch} ${styles.profPatchL}`} />
        <div className={`${styles.profPatch} ${styles.profPatchR}`} />
        <div className={`${styles.profEye} ${styles.profEyeL} ${eyeExtraClass}`} />
        <div className={`${styles.profEye} ${styles.profEyeR} ${eyeExtraClass}`} />

        {/* Glasses */}
        <div className={`${styles.profGlass} ${styles.profGlassL}`} />
        <div className={`${styles.profGlass} ${styles.profGlassR}`} />
        <div className={styles.profGlassBridge} />

        {/* Brows */}
        <div className={`${styles.profBrow} ${styles.profBrowL} ${browStateL}`} />
        <div className={`${styles.profBrow} ${styles.profBrowR} ${browStateR}`} />

        {/* Nose */}
        <div className={styles.profNose} />

        {/* Mouth */}
        <motion.div
          className={`${styles.profMouth} ${mouthState}`}
          animate={emotion === 'explaining' ? { scaleY: [1, 1.25, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        />

        {/* Blush */}
        <div className={`${styles.profBlush} ${styles.profBlushL} ${emotion === 'satisfied' ? styles.profBlushOn : ''}`} />
        <div className={`${styles.profBlush} ${styles.profBlushR} ${emotion === 'satisfied' ? styles.profBlushOn : ''}`} />
      </motion.div>

      {/* Body */}
      <div className={styles.profTorso} />

      {/* Arms */}
      <motion.div
        className={`${styles.profArm} ${styles.profArmL}`}
        animate={{ rotate: emotion === 'thinking' ? -50 : emotion === 'explaining' ? -10 : 5 }}
        transition={{ type: 'spring', stiffness: 80, damping: 14 }}
      />
      <motion.div
        className={`${styles.profArm} ${styles.profArmR}`}
        animate={{ rotate: emotion === 'explaining' ? 55 : -5 }}
        transition={{ type: 'spring', stiffness: 80, damping: 14 }}
      />

      {/* Pointer */}
      {emotion === 'explaining' && (
        <motion.div
          className={styles.profPointer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}

      {/* Mood label */}
      <div className={styles.profMood}>{MOOD_LABEL[emotion]}</div>
    </motion.div>
  );
}

export default Professor;
