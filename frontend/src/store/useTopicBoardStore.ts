import { create } from 'zustand';
import apiClient from '../api/client';
import type {
  ExplanationSession,
  ExplanationSessionSummary,
  PandaEmotion,
} from '../components/topic-board/types';

interface TopicBoardState {
  sessions: ExplanationSessionSummary[];
  currentSession: ExplanationSession | null;
  currentStepIndex: number;
  pandaEmotion: PandaEmotion;
  isLoading: boolean;
  error: string | null;
  autoplay: boolean;

  fetchSessions: () => Promise<void>;
  fetchSession: (id: string) => Promise<void>;
  fetchSessionByQuestion: (questionId: string) => Promise<void>;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  toggleAutoplay: () => void;
  reset: () => void;
}

const useTopicBoardStore = create<TopicBoardState>((set, get) => ({
  sessions: [],
  currentSession: null,
  currentStepIndex: 0,
  pandaEmotion: 'idle',
  isLoading: false,
  error: null,
  autoplay: false,

  fetchSessions: async () => {
    try {
      const res = await apiClient.get('/topic-board');
      set({ sessions: res.data });
    } catch {
      // silently ignore list fetch failure
    }
  },

  fetchSession: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get(`/topic-board/${id}`);
      const session: ExplanationSession = res.data;
      set({
        currentSession: session,
        currentStepIndex: 0,
        pandaEmotion: session.steps[0]?.panda_emotion ?? 'idle',
        isLoading: false,
      });
    } catch {
      set({ error: '加载讲解失败', isLoading: false });
    }
  },

  fetchSessionByQuestion: async (questionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get(`/topic-board/by-question/${questionId}`);
      const session: ExplanationSession = res.data;
      set({
        currentSession: session,
        currentStepIndex: 0,
        pandaEmotion: session.steps[0]?.panda_emotion ?? 'idle',
        isLoading: false,
      });
    } catch {
      set({ error: '加载讲解失败', isLoading: false });
    }
  },

  nextStep: () => {
    const { currentSession, currentStepIndex } = get();
    if (!currentSession || currentStepIndex >= currentSession.steps.length - 1) return;
    const next = currentStepIndex + 1;
    set({
      currentStepIndex: next,
      pandaEmotion: currentSession.steps[next].panda_emotion,
    });
  },

  prevStep: () => {
    const { currentSession, currentStepIndex } = get();
    if (!currentSession || currentStepIndex <= 0) return;
    const prev = currentStepIndex - 1;
    set({
      currentStepIndex: prev,
      pandaEmotion: currentSession.steps[prev].panda_emotion,
    });
  },

  goToStep: (index: number) => {
    const { currentSession } = get();
    if (!currentSession || index < 0 || index >= currentSession.steps.length) return;
    set({
      currentStepIndex: index,
      pandaEmotion: currentSession.steps[index].panda_emotion,
    });
  },

  toggleAutoplay: () => set((s) => ({ autoplay: !s.autoplay })),

  reset: () => set({
    currentSession: null,
    currentStepIndex: 0,
    pandaEmotion: 'idle',
    isLoading: false,
    error: null,
    autoplay: false,
  }),
}));

export default useTopicBoardStore;
