import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark';
  toggle: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('aitutor-theme') as 'light' | 'dark') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  toggle: () => set((state) => {
    const next = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('aitutor-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    return { theme: next };
  }),
  setTheme: (theme) => {
    localStorage.setItem('aitutor-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));

// Initialize theme on load
const savedTheme = localStorage.getItem('aitutor-theme') as 'light' | 'dark' | null;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.setAttribute('data-theme', savedTheme || (systemDark ? 'dark' : 'light'));
