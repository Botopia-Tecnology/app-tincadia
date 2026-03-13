/**
 * Authentication Context
 * 
 * Provides global auth state and methods to the app.
 * Handles the isProfileComplete flag from response level.
 */

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useMemo,
} from 'react';
import { authService } from '../services/auth.service';
import { setOnUnauthorizedCallback } from '../lib/api-client';
import * as Sentry from '@sentry/react-native';
import type {
    User,
    LoginDto,
    RegisterDto,
    UpdateProfileDto,
} from '../types/auth.types';
import { isProfileComplete as checkProfileComplete } from '../types/auth.types';

interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    profileComplete: boolean;
    error: string | null;
    login: (credentials: LoginDto) => Promise<void>;
    register: (userData: RegisterDto) => Promise<void>;
    loginWithOAuth: (provider: string, idToken: string) => Promise<void>;
    updateProfile: (data: UpdateProfileDto) => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Set up 401 callback to trigger logout
    useEffect(() => {
        setOnUnauthorizedCallback(() => {
            setUser(null);
            setError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        });
    }, []);

    // Check for existing session on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Timeout promise
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth check timeout')), 5000));

                // Actual check
                const authCheck = async () => {
                    const hasToken = await authService.hasStoredToken();
                    if (!hasToken) {
                        return null;
                    }
                    return await authService.getCurrentUser();
                };

                // Race
                const result: any = await Promise.race([authCheck(), timeout]);

                if (result) {
                    setUser({
                        ...result.user,
                        isProfileComplete: result.isProfileComplete,
                    });
                } else {
                    // Token invalid or API unreachable - clear everything
                    console.log('Token check returned null or failed, clearing auth data');
                    // await authService.logout(); // Avoid calling if potentially stuck, just clear local state logic
                    setUser(null);
                }
            } catch (err) {
                console.error('Auth check failed:', err);
                // Clear invalid auth state - don't use cached data
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = useCallback(async (credentials: LoginDto) => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await authService.login(credentials);
            console.log('🔑 Login response:', JSON.stringify(response, null, 2));
            console.log('🔑 Response isProfileComplete:', response.isProfileComplete);
            console.log('🔑 User isProfileComplete:', response.user?.isProfileComplete);
            console.log('🔑 User fields:', {
                documentTypeId: response.user?.documentTypeId,
                documentType: response.user?.documentType,
                documentNumber: response.user?.documentNumber,
                phone: response.user?.phone,
            });

            // Merge isProfileComplete from response level
            const mergedUser = {
                ...response.user,
                isProfileComplete: response.isProfileComplete ?? response.user.isProfileComplete,
            };
            console.log('🔑 Merged user isProfileComplete:', mergedUser.isProfileComplete);
            setUser(mergedUser);
        } catch (err) {
            Sentry.captureException(err);
            const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const register = useCallback(async (userData: RegisterDto) => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await authService.register(userData);
            setUser({
                ...response.user,
                isProfileComplete: response.isProfileComplete ?? response.user.isProfileComplete,
            });
        } catch (err) {
            Sentry.captureException(err);
            const message = err instanceof Error ? err.message : 'Falla en el registro';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loginWithOAuth = useCallback(async (provider: string, idToken: string) => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await authService.loginWithOAuth(provider, idToken);
            setUser({
                ...response.user,
                isProfileComplete: response.isProfileComplete ?? response.user.isProfileComplete,
            });
        } catch (err) {
            Sentry.captureException(err);
            const message = err instanceof Error ? err.message : 'Falla en inicio de sesión con OAuth';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateProfile = useCallback(async (data: UpdateProfileDto) => {
        if (!user) throw new Error('Must be logged in');
        setError(null);
        try {
            const response = await authService.updateProfile(user.id, data);
            // Update user with new profile data and mark as complete
            setUser(prev => prev ? {
                ...prev,
                ...response.user,
                ...data,
                isProfileComplete: true,
            } : null);
        } catch (err) {
            // Don't trigger logout on profile update errors
            Sentry.captureException(err);
            const message = err instanceof Error ? err.message : 'Falla al actualizar perfil';
            setError(message);
            throw err;
        }
    }, [user]);

    const logout = useCallback(async () => {
        setIsLoading(true);
        try {
            await authService.logout();
            // Clear local chat database when logging out
            try {
                const { clearChatDatabase } = await import('../database/chatDatabase');
                clearChatDatabase();
                console.log('🗑️ Cleared local chat database');
            } catch (e) {
                console.warn('Could not clear chat database:', e);
            }
        } finally {
            setUser(null);
            setError(null);
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const refreshProfile = useCallback(async () => {
        try {
            const result = await authService.getCurrentUser(true); // force refresh
            if (result) {
                setUser({
                    ...result.user,
                    isProfileComplete: result.isProfileComplete,
                });
            }
        } catch (err) {
            console.error('Failed to refresh profile:', err);
        }
    }, []);

    const value = useMemo<AuthContextValue>(() => ({
        user,
        isLoading,
        isAuthenticated: !!user,
        profileComplete: checkProfileComplete(user),
        error,
        login,
        register,
        loginWithOAuth,
        updateProfile,
        logout,
        clearError,
        refreshProfile,
    }), [user, isLoading, error, login, register, loginWithOAuth, updateProfile, logout, clearError, refreshProfile]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
