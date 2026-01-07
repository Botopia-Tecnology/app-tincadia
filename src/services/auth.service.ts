/**
 * Authentication Service
 * 
 * Handles all auth API calls to the backend.
 */

import { apiClient } from '../lib/api-client';
import { tokenStorage, userStorage } from '../lib/secure-storage';
import { API_ENDPOINTS } from '../config/api.config';
import auth from '@react-native-firebase/auth';
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
     * Get current user - tries cache first, then validates with backend
     * @param forceRefresh - If true, skips cache and fetches from backend
     */
    async getCurrentUser(forceRefresh = false): Promise<{ user: User; isProfileComplete: boolean } | null> {
        try {
            // Try to get from cache first (unless forcing refresh)
            if (!forceRefresh) {
                const cachedUser = await userStorage.getUser();
                if (cachedUser) {
                    try {
                        const user = JSON.parse(cachedUser) as User;
                        console.log('📦 Using cached user profile');

                        // Determine isProfileComplete from cached data
                        let isComplete = user.isProfileComplete;
                        if (typeof isComplete !== 'boolean') {
                            isComplete = !!(
                                (user.documentTypeId || user.documentType) &&
                                user.documentNumber &&
                                user.phone
                            );
                        }

                        // Return cached data immediately, validate in background
                        this.validateAndRefreshInBackground();

                        return { user, isProfileComplete: isComplete };
                    } catch (parseError) {
                        console.warn('Failed to parse cached user, fetching from server');
                    }
                }
            }

            // Fetch from backend
            const response = await apiClient<AuthResponse>(API_ENDPOINTS.ME, {
                method: 'GET',
            });

            console.log('🔍 /auth/me response received');

            // Use isProfileComplete from response, fallback to user object, then check fields
            let isComplete = response.isProfileComplete;
            if (typeof isComplete !== 'boolean') {
                isComplete = response.user?.isProfileComplete;
            }
            if (typeof isComplete !== 'boolean') {
                // Fallback: check if required fields exist
                isComplete = !!(
                    (response.user?.documentTypeId || response.user?.documentType) &&
                    response.user?.documentNumber &&
                    response.user?.phone
                );
            }

            // Update cache with fresh data
            if (response.user) {
                await userStorage.setUser(JSON.stringify({
                    ...response.user,
                    isProfileComplete: isComplete,
                }));
            }

            return {
                user: response.user,
                isProfileComplete: isComplete,
            };
        } catch (error) {
            console.error('🔍 /auth/me error:', error);
            return null;
        }
    },

    /**
     * Validate token with backend in background and update cache
     */
    async validateAndRefreshInBackground(): Promise<void> {
        try {
            const response = await apiClient<AuthResponse>(API_ENDPOINTS.ME, {
                method: 'GET',
            });

            if (response.user) {
                let isComplete = response.isProfileComplete ?? response.user?.isProfileComplete;
                if (typeof isComplete !== 'boolean') {
                    isComplete = !!(
                        (response.user?.documentTypeId || response.user?.documentType) &&
                        response.user?.documentNumber &&
                        response.user?.phone
                    );
                }

                await userStorage.setUser(JSON.stringify({
                    ...response.user,
                    isProfileComplete: isComplete,
                }));
                console.log('🔄 Background refresh: cache updated');
            }
        } catch (error) {
            console.warn('🔄 Background validation failed:', error);
            // If token is invalid, the 401 handler will trigger logout
        }
    },

    /**
     * Logout - clear tokens and notify backend
     */
    async logout(): Promise<void> {
        try {
            // Retrieve data before clearing (to satisfy backend DTO)
            const token = await tokenStorage.getToken();
            const userData = await userStorage.getUser();
            let userId = '';

            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    userId = user.id;
                } catch (e) { }
            }

            if (token && userId) {
                await apiClient(API_ENDPOINTS.LOGOUT, {
                    method: 'POST',
                    body: JSON.stringify({ userId, token })
                });
            } else {
                // If we don't have enough info, just skip the API call or send what we have
                // But backend requires both, so if missing, maybe just skip API call entirely?
                // The backend logout logic is empty anyway.
                await apiClient(API_ENDPOINTS.LOGOUT, {
                    method: 'POST',
                    body: JSON.stringify({ userId: userId || 'unknown', token: token || 'unknown' })
                });
            }
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
    /**
     * Update/Register push notification token
     */
    async updatePushToken(userId: string, pushToken: string): Promise<void> {
        await apiClient(API_ENDPOINTS.UPDATE_PUSH_TOKEN, {
            method: 'POST',
            body: JSON.stringify({ userId, pushToken }),
        });
    },

    /**
     * Request password reset - sends recovery email
     */
    async requestPasswordReset(email: string): Promise<{ message: string }> {
        return await apiClient<{ message: string }>(API_ENDPOINTS.RESET_PASSWORD, {
            method: 'POST',
            body: JSON.stringify({ email }),
            skipAuth: true,
        });
    },

    /**
     * Get the current access token
     */
    async getToken(): Promise<string | null> {
        return await tokenStorage.getToken();
    },

    /**
     * Delete profile picture
     */
    async deleteProfilePicture(userId: string): Promise<void> {
        await apiClient(API_ENDPOINTS.DELETE_AVATAR(userId), {
            method: 'DELETE',
        });

        // Update stored user
        const userData = await userStorage.getUser();
        if (userData) {
            const user = JSON.parse(userData);
            user.avatarUrl = null;
            await userStorage.setUser(JSON.stringify(user));
        }
    },

    /**
     * Send OTP to phone number
     * Returns the confirmation object to be used for verification
     */
    async signInWithPhoneNumber(phoneNumber: string): Promise<any> {
        const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
        return confirmation;
    },

    /**
     * Verify the OTP code
     */
    async confirmCode(confirmResult: any, code: string): Promise<User | null> {
        try {
            const result = await confirmResult.confirm(code);
            // The result.user contains the Firebase user.
            // We usually want to link this to our backend user or return it.
            // For now, we return the firebase user or handle backend syncing if needed.
            return result.user;
        } catch (error) {
            console.error('Invalid code', error);
            throw error;
        }
    }
};
