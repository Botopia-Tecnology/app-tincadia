/**
 * API Configuration
 * 
 * Note: For Android emulator, use 10.0.2.2 instead of localhost
 * For iOS simulator & web, localhost works fine
 */

import { Platform } from 'react-native';

// Get base URL with platform-specific localhost handling
const getApiBaseUrl = (): string => {
    let configuredUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

    // Add https:// if no protocol is specified (and not localhost)
    if (!configuredUrl.startsWith('http://') && !configuredUrl.startsWith('https://')) {
        if (!configuredUrl.includes('localhost') && !configuredUrl.includes('10.0.2.2')) {
            configuredUrl = `https://${configuredUrl}`;
        } else {
            configuredUrl = `http://${configuredUrl}`;
        }
    }

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
    AVAILABLE_USERS: (userId: string) => `/auth/users/${userId}`,

    // Chat endpoints
    CONVERSATIONS: '/chat/conversations',
    USER_CONVERSATIONS: (userId: string) => `/chat/conversations/${userId}`,
    MESSAGES: '/chat/messages',
    CONVERSATION_MESSAGES: (conversationId: string) => `/chat/messages/${conversationId}`,
    MESSAGES_READ: '/chat/messages/read',
    MESSAGE: (messageId: string) => `/chat/messages/${messageId}`,
    CORRECT_TEXT: '/chat/correct-text',

    // Contact endpoints
    CONTACTS: '/chat/contacts',
    CONTACT: (contactId: string) => `/chat/contacts/${contactId}`,
    ADD_CONTACT: '/chat/contacts/add',
} as const;
