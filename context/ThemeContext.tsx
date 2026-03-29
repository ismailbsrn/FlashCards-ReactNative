import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  accentSoft: string;
  accentBorder: string;
  inputBg: string;
  inputBorder: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarInactive: string;
  sectionLabel: string;
  sheetBg: string;
  divider: string;
  rowIconBg: string;
  dangerIconBg: string;
}

const dark: ThemeColors = {
  background:    '#030014',
  surface:       'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.07)',
  text:          '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted:     '#6B7280',
  accent:        '#7C3AED',
  accentLight:   '#8B5CF6',
  accentSoft:    'rgba(139,92,246,0.15)',
  accentBorder:  'rgba(139,92,246,0.4)',
  inputBg:       'rgba(255,255,255,0.05)',
  inputBorder:   'rgba(255,255,255,0.1)',
  tabBar:        '#0D0A1A',
  tabBarBorder:  'rgba(255,255,255,0.06)',
  tabBarInactive:'#4B5563',
  sectionLabel:  '#6B7280',
  sheetBg:       '#0D0A1A',
  divider:       'rgba(255,255,255,0.05)',
  rowIconBg:     'rgba(139,92,246,0.12)',
  dangerIconBg:  'rgba(220,38,38,0.12)',
};

const light: ThemeColors = {
  background:    '#F0EEFF',
  surface:       '#FFFFFF',
  surfaceBorder: 'rgba(0,0,0,0.06)',
  text:          '#0F0A1E',
  textSecondary: '#4B5563',
  textMuted:     '#9CA3AF',
  accent:        '#7C3AED',
  accentLight:   '#8B5CF6',
  accentSoft:    'rgba(139,92,246,0.1)',
  accentBorder:  'rgba(139,92,246,0.35)',
  inputBg:       'rgba(0,0,0,0.04)',
  inputBorder:   'rgba(0,0,0,0.09)',
  tabBar:        '#FFFFFF',
  tabBarBorder:  'rgba(0,0,0,0.08)',
  tabBarInactive:'#9CA3AF',
  sectionLabel:  '#9CA3AF',
  sheetBg:       '#FFFFFF',
  divider:       'rgba(0,0,0,0.05)',
  rowIconBg:     'rgba(139,92,246,0.08)',
  dangerIconBg:  'rgba(220,38,38,0.08)',
};

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_KEY = 'app_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY)
      .then(v => { if (v === 'dark' || v === 'light') setMode(v); })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    SecureStore.setItemAsync(THEME_KEY, next).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ mode, isDark: mode === 'dark', colors: mode === 'dark' ? dark : light, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
