/**
 * Authentication Service
 * 
 * Handles all auth API calls to the backend.
 */

import { apiClient, ApiError } from '../lib/api-client';
import {
    tokenStorage,
    userStorage,
    deviceIdStorage,
    deviceRegistrationStorage,
} from '../lib/secure-storage';
import { API_ENDPOINTS, API_URL } from '../config/api.config';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type {
    LoginDto,
    RegisterDto,
    AuthResponse,
    UpdateProfileDto,
    User,
} from '../types/auth.types';

type DevicePlatform = 'ios' | 'android';

export interface DeviceTokenUpdate {
    pushToken?: string;
    fcmToken?: string;
    voipToken?: string;
}

interface DeviceRegistrationResponse {
    success: boolean;
    registrationId?: string;
    active?: boolean;
    stale?: boolean;
}

const getDevicePlatform = (): DevicePlatform | null => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
    return null;
};

const cleanToken = (token?: string): string | undefined => {
    const cleaned = token?.trim();
    return cleaned || undefined;
};

const cleanDeviceTokens = (tokens: DeviceTokenUpdate = {}): DeviceTokenUpdate => ({
    ...(cleanToken(tokens.pushToken) ? { pushToken: cleanToken(tokens.pushToken) } : {}),
    ...(cleanToken(tokens.fcmToken) ? { fcmToken: cleanToken(tokens.fcmToken) } : {}),
    ...(cleanToken(tokens.voipToken) ? { voipToken: cleanToken(tokens.voipToken) } : {}),
});

const hasDeviceTokens = (tokens: DeviceTokenUpdate): boolean => Object.keys(tokens).length > 0;

// Serializes activation/rotation/revocation so login and notification startup
// cannot race and leave an older registrationId in SecureStore.
let deviceRegistrationQueue: Promise<unknown> = Promise.resolve();
let deviceRegistrationLogoutInProgress = false;
const withDeviceRegistrationLock = <T>(task: () => Promise<T>): Promise<T> => {
    const next = deviceRegistrationQueue.then(task, task);
    deviceRegistrationQueue = next.then(() => undefined, () => undefined);
    return next;
};

const postDeviceRegistration = async (
    userId: string,
    deviceId: string,
    platform: DevicePlatform,
    tokens: DeviceTokenUpdate,
    registrationId?: string,
): Promise<DeviceRegistrationResponse> => {
    const response = await apiClient<DeviceRegistrationResponse>(API_ENDPOINTS.DEVICE_REGISTRATION, {
        method: 'POST',
        body: JSON.stringify({
            userId,
            deviceId,
            platform,
            ...tokens,
            ...(registrationId ? { registrationId } : {}),
        }),
        suppressUnauthorizedHandling: true,
    });

    if (response.registrationId) {
        await deviceRegistrationStorage.set({ userId, registrationId: response.registrationId });
    }
    return response;
};

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
        void authService.activateNewDevice(response.user.id).catch((error) => {
            console.warn('[DEVICE_REGISTRATION] Login activation failed:', error);
        });

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
        void authService.activateNewDevice(response.user.id).catch((error) => {
            console.warn('[DEVICE_REGISTRATION] Registration activation failed:', error);
        });

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
        void authService.activateNewDevice(response.user.id).catch((error) => {
            console.warn('[DEVICE_REGISTRATION] OAuth activation failed:', error);
        });

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
            const PROFILE_ETAG_KEY = 'tincadia_profile_etag';
            let cachedUserStr: string | null = null;
            let cachedUser: User | null = null;
            let etag: string | null = null;

            // 1. Get cached data and ETag
            if (!forceRefresh) {
                [cachedUserStr, etag] = await Promise.all([
                    userStorage.getUser(),
                    AsyncStorage.getItem(PROFILE_ETAG_KEY)
                ]);

                if (cachedUserStr) {
                    try {
                        cachedUser = JSON.parse(cachedUserStr);
                        // If we have cached user, we can optimistically return it while validating?
                        // But logic below handles validation.
                        // Let's rely on 304 check.
                    } catch (e) {
                        console.warn('Failed to parse cached user');
                    }
                }
            }

            // 2. Prepare headers
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            const token = await tokenStorage.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            if (etag && cachedUser && !forceRefresh) {
                headers['If-None-Match'] = etag;
            }

            // 3. Fetch
            const url = `${API_URL}${API_ENDPOINTS.ME}`;
            console.log('🔍 Fetching /auth/me with ETag:', etag);

            const response = await fetch(url, {
                method: 'GET',
                headers
            });

            // 4. Handle 304 Not Modified
            if (response.status === 304) {
                console.log('📦 304 Not Modified: Using cached profile');
                if (cachedUser) {
                    let isComplete = cachedUser.isProfileComplete;
                    // Ensure boolean
                    if (typeof isComplete !== 'boolean') {
                        isComplete = !!(
                            (cachedUser.documentTypeId || cachedUser.documentType) &&
                            cachedUser.documentNumber &&
                            cachedUser.phone
                        );
                    }
                    return { user: cachedUser, isProfileComplete: isComplete };
                }
            }

            // 5. Handle Errors
            if (!response.ok) {
                // If 401, handle logout? internal apiClient does. 
                // We should manually trigger same logic if needed or throw.
                if (response.status === 401) {
                    await tokenStorage.clearToken();
                    await userStorage.clearUser();
                    // Maybe notify listener
                }
                throw new Error(`Profile fetch failed: ${response.status}`);
            }

            // 6. Handle 200 OK
            const data: AuthResponse = await response.json();
            console.log('🔍 /auth/me 200 OK response received');

            // Save new ETag
            const newEtag = response.headers.get('etag');
            if (newEtag) {
                await AsyncStorage.setItem(PROFILE_ETAG_KEY, newEtag);
            }

            // Calculate status
            let isComplete = data.isProfileComplete;
            if (typeof isComplete !== 'boolean') {
                isComplete = data.user?.isProfileComplete;
            }
            if (typeof isComplete !== 'boolean') {
                isComplete = !!(
                    (data.user?.documentTypeId || data.user?.documentType) &&
                    data.user?.documentNumber &&
                    data.user?.phone
                );
            }

            // Save user
            if (data.user) {
                await userStorage.setUser(JSON.stringify({
                    ...data.user,
                    isProfileComplete: isComplete,
                }));
            }

            return {
                user: data.user,
                isProfileComplete: isComplete,
            };

        } catch (error) {
            console.error('🔍 /auth/me error:', error);
            // If network fails (e.g. offline) and we have cache, return it?
            // "Offline First" - yes.
            try {
                const cached = await userStorage.getUser();
                if (cached) {
                    const u = JSON.parse(cached);
                    console.log('⚠️ Network error, using fallback cache');
                    return { user: u, isProfileComplete: !!u.isProfileComplete };
                }
            } catch (e) { }

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
        deviceRegistrationLogoutInProgress = true;
        let registration: Awaited<ReturnType<typeof deviceRegistrationStorage.get>> = null;
        try {
            registration = await deviceRegistrationStorage.get();
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

            if (userId && registration?.userId === userId) {
                await authService.revokeDeviceRegistration(userId);
            }

            if (token && userId) {
                await apiClient(API_ENDPOINTS.LOGOUT, {
                    method: 'POST',
                    body: JSON.stringify({
                        userId,
                        token,
                        ...(registration?.userId === userId ? {
                            deviceId: await deviceIdStorage.getOrCreate(),
                            registrationId: registration.registrationId,
                        } : {}),
                    }),
                    suppressUnauthorizedHandling: true,
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
            deviceRegistrationLogoutInProgress = false;
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

    /** Start a new single-active-device activation after a successful login. */
    async activateNewDevice(userId: string, tokens: DeviceTokenUpdate = {}): Promise<string | null> {
        const platform = getDevicePlatform();
        if (!platform || !userId || deviceRegistrationLogoutInProgress) return null;

        return withDeviceRegistrationLock(async () => {
            const deviceId = await deviceIdStorage.getOrCreate();
            const response = await postDeviceRegistration(
                userId,
                deviceId,
                platform,
                cleanDeviceTokens(tokens),
            );
            return response.registrationId || null;
        });
    },

    /** Reconcile the stored registration when the app starts or a user becomes active. */
    async ensureDeviceRegistration(userId: string, tokens: DeviceTokenUpdate = {}): Promise<string | null> {
        const platform = getDevicePlatform();
        if (!platform || !userId || deviceRegistrationLogoutInProgress) return null;

        return withDeviceRegistrationLock(async () => {
            const deviceId = await deviceIdStorage.getOrCreate();
            const stored = await deviceRegistrationStorage.get();
            const cleanTokens = cleanDeviceTokens(tokens);

            if (stored?.userId === userId && stored.registrationId) {
                try {
                    const response = await postDeviceRegistration(
                        userId,
                        deviceId,
                        platform,
                        cleanTokens,
                        stored.registrationId,
                    );

                    if (!response.stale) return response.registrationId || stored.registrationId;
                } catch (error) {
                    // The previous phone may have activated the same account and
                    // revoked this registration. Re-activate only for that
                    // deterministic stale-registration response; network/auth
                    // failures must not create a second activation attempt.
                    if (!(error instanceof ApiError) || error.status !== 400) throw error;
                }
            }

            const response = await postDeviceRegistration(userId, deviceId, platform, cleanTokens);
            return response.registrationId || null;
        });
    },

    /** Rotate only non-empty native tokens for the current active registration. */
    async updateDeviceTokens(userId: string, tokens: DeviceTokenUpdate): Promise<string | null> {
        const platform = getDevicePlatform();
        const cleanTokens = cleanDeviceTokens(tokens);
        if (!platform || !userId || !hasDeviceTokens(cleanTokens) || deviceRegistrationLogoutInProgress) return null;

        return withDeviceRegistrationLock(async () => {
            const deviceId = await deviceIdStorage.getOrCreate();
            const stored = await deviceRegistrationStorage.get();

            if (!stored || stored.userId !== userId) {
                const response = await postDeviceRegistration(userId, deviceId, platform, cleanTokens);
                return response.registrationId || null;
            }

            const response = await apiClient<DeviceRegistrationResponse>(API_ENDPOINTS.DEVICE_REGISTRATION_TOKENS, {
                method: 'POST',
                body: JSON.stringify({
                    userId,
                    deviceId,
                    registrationId: stored.registrationId,
                    platform,
                    ...cleanTokens,
                }),
                suppressUnauthorizedHandling: true,
            });

            if (response.stale) {
                const replacement = await postDeviceRegistration(userId, deviceId, platform, cleanTokens);
                return replacement.registrationId || null;
            }

            return stored.registrationId;
        });
    },

    /** Revoke only the exact registration belonging to the currently logged-in user. */
    async revokeDeviceRegistration(userId: string): Promise<boolean> {
        const platform = getDevicePlatform();
        if (!platform || !userId) return false;

        return withDeviceRegistrationLock(async () => {
            const deviceId = await deviceIdStorage.getOrCreate();
            const stored = await deviceRegistrationStorage.get();
            if (!stored || stored.userId !== userId) return false;

            try {
                const response = await apiClient<{ success: boolean; revoked?: boolean }>(API_ENDPOINTS.DEVICE_REGISTRATION_REVOKE, {
                    method: 'POST',
                    body: JSON.stringify({ userId, deviceId, registrationId: stored.registrationId }),
                    suppressUnauthorizedHandling: true,
                });
                return response.revoked ?? response.success;
            } finally {
                // Never reuse this registrationId for another account after logout.
                const current = await deviceRegistrationStorage.get();
                if (current?.userId === userId && current.registrationId === stored.registrationId) {
                    await deviceRegistrationStorage.clear();
                }
            }
        });
    },

    async updatePushToken(userId: string, pushToken: string): Promise<void> {
        // Legacy compatibility only. New notification flows use updateDeviceTokens.
        await apiClient(API_ENDPOINTS.UPDATE_PUSH_TOKEN, {
            method: 'POST',
            body: JSON.stringify({ userId, pushToken }),
        });
    },

    /**
     * Update/Register VoIP Push token (iOS only)
     */
    async updateVoipToken(userId: string, voipToken: string): Promise<void> {
        await apiClient('/auth/update-voip-token', {
            method: 'POST',
            body: JSON.stringify({ userId, voipToken }),
        });
    },

    /**
     * Update/Register FCM token for Android Data Messages
     */
    async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
        await apiClient('/auth/update-fcm-token', {
            method: 'POST',
            body: JSON.stringify({ userId, fcmToken }),
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
    async signInWithPhoneNumber(phoneNumber: string): Promise<FirebaseAuthTypes.ConfirmationResult> {
        const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
        return confirmation;
    },

    /**
     * Verify the OTP code
     */
    async confirmCode(confirmResult: FirebaseAuthTypes.ConfirmationResult, code: string): Promise<FirebaseAuthTypes.User | null> {
        try {
            const result = await confirmResult.confirm(code);
            // The result.user contains the Firebase user.
            // We usually want to link this to our backend user or return it.
            // For now, we return the firebase user or handle backend syncing if needed.
            return result?.user || null;
        } catch (error) {
            console.error('Invalid code', error);
            throw error;
        }
    }
};
