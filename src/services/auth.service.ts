/**
 * Authentication Service
 * 
 * Handles all auth API calls to the backend.
 */

import { apiClient } from '../lib/api-client';
import { tokenStorage, userStorage } from '../lib/secure-storage';
import { API_ENDPOINTS } from '../config/api.config';
import type {
    LoginDto,
    RegisterDto,
    AuthResponse,
    UpdateProfileDto,
    User,
} from '../types/auth.types';

export const authService = {
    /**
     * Login with email and password
     */
    async login(credentials: LoginDto): Promise<AuthResponse> {
        const response = await apiClient<AuthResponse>(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            body: JSON.stringify(credentials),
            skipAuth: true,
        });

        // Store token and user
        await tokenStorage.setToken(response.token);
        await userStorage.setUser(JSON.stringify(response.user));

        return response;
    },

    /**
     * Register a new user
     */
    async register(userData: RegisterDto): Promise<AuthResponse> {
        const response = await apiClient<AuthResponse>(API_ENDPOINTS.REGISTER, {
            method: 'POST',
            body: JSON.stringify(userData),
            skipAuth: true,
        });

        // Store token and user
        await tokenStorage.setToken(response.token);
        await userStorage.setUser(JSON.stringify(response.user));

        return response;
    },

    /**
     * Login/Register with OAuth provider
     * 
     * IMPORTANT: Backend requires idToken, not accessToken.
     * We send idToken as both idToken and accessToken as a workaround
     * for backend validation that expects accessToken field.
     */
    async loginWithOAuth(provider: string, idToken: string): Promise<AuthResponse> {
        const response = await apiClient<AuthResponse>(API_ENDPOINTS.OAUTH_LOGIN, {
            method: 'POST',
            body: JSON.stringify({
                provider,
                idToken,
                accessToken: idToken, // Workaround: backend may expect this field
            }),
            skipAuth: true,
        });

        // Store token and user
        await tokenStorage.setToken(response.token);
        await userStorage.setUser(JSON.stringify(response.user));

        return response;
    },

    /**
     * Update user profile (for completing profile after OAuth)
     */
    async updateProfile(userId: string, data: UpdateProfileDto): Promise<AuthResponse> {
        const response = await apiClient<AuthResponse>(
            API_ENDPOINTS.UPDATE_PROFILE(userId),
            {
                method: 'PUT',
                body: JSON.stringify(data),
            }
        );

        // Update stored user data
        if (response.user) {
            await userStorage.setUser(JSON.stringify(response.user));
        }

        return response;
    },

    /**
     * Get current user from /auth/me endpoint
     */
    async getCurrentUser(): Promise<{ user: User; isProfileComplete: boolean } | null> {
        try {
            const response = await apiClient<AuthResponse>(API_ENDPOINTS.ME, {
                method: 'GET',
            });
            return {
                user: response.user,
                isProfileComplete: response.isProfileComplete ?? false,
            };
        } catch {
            return null;
        }
    },

    /**
     * Logout - clear tokens and notify backend
     */
    async logout(): Promise<void> {
        try {
            await apiClient(API_ENDPOINTS.LOGOUT, { method: 'POST' });
        } catch (error) {
            // Ignore logout errors - we'll clear tokens anyway
            console.warn('Logout API error:', error);
        } finally {
            await tokenStorage.clearToken();
            await userStorage.clearUser();
        }
    },

    /**
     * Check if user has a stored token
     */
    async hasStoredToken(): Promise<boolean> {
        const token = await tokenStorage.getToken();
        return !!token;
    },

    /**
     * Get stored user (for initial load)
     */
    async getStoredUser(): Promise<User | null> {
        const userData = await userStorage.getUser();
        if (userData) {
            try {
                return JSON.parse(userData);
            } catch {
                return null;
            }
        }
        return null;
    },
};
