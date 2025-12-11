/**
 * API Configuration
 * 
 * Note: For Android emulator, use 10.0.2.2 instead of localhost
 * For iOS simulator & web, localhost works fine
 */

import { Platform } from 'react-native';

// Get base URL with platform-specific localhost handling
const getApiBaseUrl = (): string => {
    const configuredUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

    // Android emulator needs special IP for localhost
    if (Platform.OS === 'android' && configuredUrl.includes('localhost')) {
        return configuredUrl.replace('localhost', '10.0.2.2');
    }

    return configuredUrl;
};

export const API_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
    // Auth endpoints
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    OAUTH_LOGIN: '/auth/oauth/login',
    LOGOUT: '/auth/logout',
    UPDATE_PROFILE: (userId: string) => `/auth/profile/${userId}`,
    ME: '/auth/me',
} as const;
