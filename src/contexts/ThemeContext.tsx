/**
 * Theme Context
 * 
 * Provides dark mode support with three modes:
 * - 'system': follows device settings (default)
 * - 'light': always light
 * - 'dark': always dark
 * 
 * Persists user preference in AsyncStorage.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@tincadia_theme_mode';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
    // Backgrounds
    background: string;
    surface: string;
    card: string;
    inputBg: string;

    // Text
    text: string;
    textSecondary: string;
    textMuted: string;

    // Borders & Dividers
    border: string;
    divider: string;

    // UI Elements
    icon: string;
    iconSecondary: string;
    navBar: string;
    navBarActive: string;
    overlay: string;

    // Status bar
    statusBar: 'light' | 'dark';

    // Shadows
    shadowColor: string;

    // Accent (stays the same in both modes)
    accent: string;
    accentHover: string;
    primary: string;

    // Status
    error: string;
    success: string;
    warning: string;
}

const lightColors: ThemeColors = {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    card: '#FFFFFF',
    inputBg: '#F3F4F6',

    text: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',

    border: '#F0F0F0',
    divider: '#F0F0F0',

    icon: '#000000',
    iconSecondary: '#4B5563',
    navBar: '#FFFFFF',
    navBarActive: '#F5F5F5',
    overlay: 'rgba(255, 255, 255, 0.9)',

    statusBar: 'dark',
    shadowColor: '#000',

    accent: '#376A3E',
    accentHover: '#2d5a34',
    primary: '#376A3E',

    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
};

const darkColors: ThemeColors = {
    background: '#121212',
    surface: '#1E1E1E',
    card: '#1E1E1E',
    inputBg: '#2A2A2A',

    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textMuted: '#808080',

    border: '#2A2A2A',
    divider: '#2A2A2A',

    icon: '#FFFFFF',
    iconSecondary: '#9CA3AF',
    navBar: '#1E1E1E',
    navBarActive: '#2A2A2A',
    overlay: 'rgba(0, 0, 0, 0.9)',

    statusBar: 'light',
    shadowColor: '#000',

    accent: '#4CAF50',
    accentHover: '#43A047',
    primary: '#4CAF50',

    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
};

interface ThemeContextValue {
    // Existing API
    isDark: boolean;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    colors: ThemeColors;

    // "Gold Standard" API
    theme: 'light' | 'dark';
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    systemTheme?: 'light' | 'dark' | null;
}

const ThemeContext = createContext<ThemeContextValue>({
    isDark: false,
    themeMode: 'system',
    setThemeMode: () => { },
    colors: lightColors,
    theme: 'light',
    mode: 'system',
    setMode: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [isLoaded, setIsLoaded] = useState(false);

    // Load saved preference on mount
    useEffect(() => {
        AsyncStorage.getItem(THEME_STORAGE_KEY)
            .then((saved) => {
                if (saved === 'light' || saved === 'dark' || saved === 'system') {
                    setThemeModeState(saved);
                }
            })
            .catch(() => { })
            .finally(() => setIsLoaded(true));
    }, []);

    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode);
        AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => { });
    }, []);

    const isDark = useMemo(() => {
        if (themeMode === 'system') {
            return systemColorScheme === 'dark';
        }
        return themeMode === 'dark';
    }, [themeMode, systemColorScheme]);

    const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

    // "Gold Standard" aliases for compatibility with the requested implementation
    const theme: 'light' | 'dark' = isDark ? 'dark' : 'light';
    const mode = themeMode;
    const setMode = setThemeMode;

    const value = useMemo(
        () => ({
            // Existing API
            isDark,
            themeMode,
            setThemeMode,
            colors,
            // "Gold Standard" API
            theme,
            mode,
            setMode,
            // Debugging
            systemTheme: systemColorScheme
        }),
        [isDark, themeMode, setThemeMode, colors, theme, mode, setMode, systemColorScheme]
    );

    // Don't render until preference is loaded to avoid flash
    // if (!isLoaded) return null; // Removed to allow SplashScreen to render with default system theme

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
