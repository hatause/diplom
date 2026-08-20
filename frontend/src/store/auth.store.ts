import { create } from 'zustand';
import { api } from '@/api/client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  avatarUrl?: string;
  studentProfile?: {
    xp: number;
    streak: number;
    bestStreak: number;
    dailyGoal: number;
    group?: { id: string; name: string; code: string };
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; role?: string; groupCode?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('aitutor-token'),
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { user, accessToken } = data.data;
    localStorage.setItem('aitutor-token', accessToken);
    set({ user, accessToken, isAuthenticated: true, isLoading: false });
  },

  register: async (regData) => {
    const { data } = await api.post('/auth/register', regData);
    const { user, accessToken } = data.data;
    localStorage.setItem('aitutor-token', accessToken);
    set({ user, accessToken, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    localStorage.removeItem('aitutor-token');
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  refresh: async () => {
    try {
      const { data } = await api.post('/auth/refresh');
      const { accessToken } = data.data;
      localStorage.setItem('aitutor-token', accessToken);
      set({ accessToken });
    } catch {
      localStorage.removeItem('aitutor-token');
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    }
  },

  fetchMe: async () => {
    const token = get().accessToken;
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user }),
}));
