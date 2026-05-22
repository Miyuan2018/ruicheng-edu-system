import { create } from 'zustand';
import axios from 'axios';
import apiClient from '../api/client';

interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  username: string;
  password: string;
  full_name: string;
  role: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  loading: false,

  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    const { data } = await axios.post('/api/v1/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    set({ isAuthenticated: true });
  },

  register: async (userData) => {
    const { data } = await apiClient.post('/auth/register', userData);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    set({ isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    set({ loading: true });
    try {
      const { data } = await apiClient.get('/users/me');
      set({ user: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
