import { create } from 'zustand';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_TYPE_KEY = 'user_type';
const USER_NAME_KEY = 'user_name';
const USER_ID_KEY = 'user_id';

// ── Helper functions for non-React contexts (axios interceptors) ──
export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
export const getUserType = () => localStorage.getItem(USER_TYPE_KEY) || 'STUDENT';
export const getUserName = () => localStorage.getItem(USER_NAME_KEY) || '用户';
export const getUserId = () => localStorage.getItem(USER_ID_KEY) || '';

interface AuthData {
  access_token: string;
  refresh_token: string;
  user_type: string;
  user_name: string;
  user_id: string;
}

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
  accessToken: string | null;
  refreshToken: string | null;
  userType: string | null;
  userName: string | null;
  userId: string | null;
  setAuth: (data: AuthData) => void;
  logout: () => void;
  updateUserName: (name: string) => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!getAccessToken(),
  accessToken: getAccessToken(),
  refreshToken: getRefreshToken(),
  userType: getUserType(),
  userName: getUserName(),
  userId: getUserId(),

  setAuth: (data) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    localStorage.setItem(USER_TYPE_KEY, data.user_type);
    localStorage.setItem(USER_NAME_KEY, data.user_name);
    localStorage.setItem(USER_ID_KEY, data.user_id);
    set({
      isAuthenticated: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userType: data.user_type,
      userName: data.user_name,
      userId: data.user_id,
    });
  },

  logout: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_TYPE_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_ID_KEY);
    set({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      userType: null,
      userName: null,
      userId: null,
    });
  },

  updateUserName: (name) => {
    localStorage.setItem(USER_NAME_KEY, name);
    set({ userName: name });
  },

  setUser: (user) => set({ user }),
}));
