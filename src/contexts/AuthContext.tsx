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
            setError('Session expired. Please login again.');
        });
    }, []);

    // Check for existing session on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const hasToken = await authService.hasStoredToken();
                if (!hasToken) {
                    setIsLoading(false);
                    return;
                }

                // Try to get current user from API to validate token
                const result = await authService.getCurrentUser();
                if (result) {
                    setUser({
                        ...result.user,
                        isProfileComplete: result.isProfileComplete,
                    });
                } else {
                    // Token invalid or API unreachable - clear everything
                    console.log('Token validation failed, clearing auth data');
                    await authService.logout();
                    setUser(null);
                }
            } catch (err) {
                console.error('Auth check failed:', err);
                // Clear invalid auth state - don't use cached data
                await authService.logout();
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
            // Merge isProfileComplete from response level
            setUser({
                ...response.user,
                isProfileComplete: response.isProfileComplete ?? response.user.isProfileComplete,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed';
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
            const message = err instanceof Error ? err.message : 'Registration failed';
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
            const message = err instanceof Error ? err.message : 'OAuth login failed';
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
            const message = err instanceof Error ? err.message : 'Profile update failed';
            setError(message);
            throw err;
        }
    }, [user]);

    const logout = useCallback(async () => {
        setIsLoading(true);
        try {
            await authService.logout();
        } finally {
            setUser(null);
            setError(null);
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
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
    }), [user, isLoading, error, login, register, loginWithOAuth, updateProfile, logout, clearError]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
