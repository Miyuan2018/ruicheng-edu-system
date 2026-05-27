import { create } from 'zustand';
import apiClient from '../api/client';

type anyObj = Record<string, any>;

interface ParentState {
  linkedStudents: anyObj[];
  selectedStudentId: string | null;
  encouragements: anyObj[];
  receivedEncouragements: anyObj[];
  templates: anyObj[];
  rewardGoals: anyObj[];
  celebrations: anyObj[];
  positiveStats: anyObj | null;
  isLoading: boolean;

  fetchLinkedStudents: () => Promise<void>;
  selectStudent: (id: string) => Promise<void>;
  fetchPositiveStats: (studentId: string) => Promise<void>;
  fetchTemplates: (category?: string) => Promise<void>;
  sendEncouragement: (data: {
    student_id: string;
    encouragement_type: string;
    title?: string;
    message: string;
    template_id?: string;
  }) => Promise<void>;
  fetchSentEncouragements: (studentId?: string) => Promise<void>;
  fetchReceivedEncouragements: (unreadOnly?: boolean) => Promise<void>;
  markEncouragementRead: (id: string) => Promise<void>;
  createRewardGoal: (data: anyObj) => Promise<void>;
  fetchRewardGoals: (studentId?: string, status?: string) => Promise<void>;
  claimReward: (goalId: string) => Promise<void>;
  fetchCelebrations: (studentId?: string) => Promise<void>;
  linkStudent: (inviteCode: string, relationship: string) => Promise<boolean>;
}

const useParentStore = create<ParentState>((set, get) => ({
  linkedStudents: [],
  selectedStudentId: null,
  encouragements: [],
  receivedEncouragements: [],
  templates: [],
  rewardGoals: [],
  celebrations: [],
  positiveStats: null,
  isLoading: false,

  fetchLinkedStudents: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get('/parent/linked-students');
      set({ linkedStudents: response.data });
    } catch (error) {
      console.error('Failed to fetch linked students:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  selectStudent: async (id: string) => {
    set({ selectedStudentId: id });
    await get().fetchPositiveStats(id);
  },

  fetchPositiveStats: async (studentId: string) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get(`/parent/positive-stats/${studentId}`);
      set({ positiveStats: response.data });
    } catch (error) {
      console.error('Failed to fetch positive stats:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTemplates: async (category?: string) => {
    set({ isLoading: true });
    try {
      const params = category ? { category } : {};
      const response = await apiClient.get('/parent/templates', { params });
      set({ templates: response.data });
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  sendEncouragement: async (data) => {
    set({ isLoading: true });
    try {
      await apiClient.post('/parent/encouragement', data);
    } catch (error) {
      console.error('Failed to send encouragement:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSentEncouragements: async (studentId?: string) => {
    set({ isLoading: true });
    try {
      const params = studentId ? { student_id: studentId } : {};
      const response = await apiClient.get('/parent/encouragement/sent', { params });
      set({ encouragements: response.data });
    } catch (error) {
      console.error('Failed to fetch sent encouragements:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchReceivedEncouragements: async (unreadOnly?: boolean) => {
    set({ isLoading: true });
    try {
      const params = unreadOnly !== undefined ? { unread_only: unreadOnly } : {};
      const response = await apiClient.get('/parent/encouragement/received', { params });
      set({ receivedEncouragements: response.data });
    } catch (error) {
      console.error('Failed to fetch received encouragements:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  markEncouragementRead: async (id: string) => {
    try {
      await apiClient.put(`/parent/encouragement/${id}/read`);
    } catch (error) {
      console.error('Failed to mark encouragement as read:', error);
    }
  },

  createRewardGoal: async (data: anyObj) => {
    set({ isLoading: true });
    try {
      await apiClient.post('/parent/reward-goals', data);
    } catch (error) {
      console.error('Failed to create reward goal:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRewardGoals: async (studentId?: string, status?: string) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string> = {};
      if (studentId) params.student_id = studentId;
      if (status) params.status = status;
      const response = await apiClient.get('/parent/reward-goals', { params });
      set({ rewardGoals: response.data });
    } catch (error) {
      console.error('Failed to fetch reward goals:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  claimReward: async (goalId: string) => {
    try {
      await apiClient.put(`/parent/reward-goals/${goalId}/claim`);
    } catch (error) {
      console.error('Failed to claim reward:', error);
    }
  },

  fetchCelebrations: async (studentId?: string) => {
    set({ isLoading: true });
    try {
      const params = studentId ? { student_id: studentId } : {};
      const response = await apiClient.get('/parent/celebrations', { params });
      set({ celebrations: response.data });
    } catch (error) {
      console.error('Failed to fetch celebrations:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  linkStudent: async (inviteCode: string, relationship: string) => {
    try {
      await apiClient.post('/parent/link-student', { invite_code: inviteCode, relationship });
      await get().fetchLinkedStudents();
      return true;
    } catch (error: any) {
      const msg = error?.response?.data?.detail || '关联失败';
      console.error('Failed to link student:', msg);
      throw new Error(msg, { cause: error });
    }
  },
}));

export default useParentStore;
