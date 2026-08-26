/**
 * Secure Token Storage
 * 
 * Uses expo-secure-store for secure token storage.
 * Falls back gracefully on web where SecureStore is not available.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'tincadia_accessToken';
const USER_KEY = 'tincadia_user';
const SESSION_KEY = 'tincadia_supabaseSession';
const PENDING_CALL_ACTION_KEY = 'tincadia_pendingCallAction';
const PENDING_INVITE_KEY = 'tincadia_pendingInterpreterInvite';

// Web fallback using localStorage (less secure, but SecureStore doesn't work on web)
// NOTE: This project is typed for React Native (no DOM lib), so we must not reference `window` directly.
const getWebLocalStorage = (): Storage | null => {
    const g = globalThis as unknown as { localStorage?: Storage };
    return g && g.localStorage ? g.localStorage : null;
};

const webStorage = {
    async getItem(key: string): Promise<string | null> {
        const ls = getWebLocalStorage();
        if (ls) return ls.getItem(key);
        return null;
    },
    async setItem(key: string, value: string): Promise<void> {
        const ls = getWebLocalStorage();
        if (ls) ls.setItem(key, value);
    },
    async deleteItem(key: string): Promise<void> {
        const ls = getWebLocalStorage();
        if (ls) ls.removeItem(key);
    },
};

const isWeb = Platform.OS === 'web';

export const tokenStorage = {
    async getToken(): Promise<string | null> {
        try {
            if (isWeb) {
                return await webStorage.getItem(TOKEN_KEY);
            }
            return await SecureStore.getItemAsync(TOKEN_KEY);
        } catch (error) {
            console.error('Error getting token:', error);
            return null;
        }
    },

    async setToken(token: string): Promise<void> {
        try {
            if (isWeb) {
                await webStorage.setItem(TOKEN_KEY, token);
            } else {
                await SecureStore.setItemAsync(TOKEN_KEY, token);
            }
        } catch (error) {
            console.error('Error setting token:', error);
        }
    },

    async clearToken(): Promise<void> {
        try {
            if (isWeb) {
                await webStorage.deleteItem(TOKEN_KEY);
            } else {
                await SecureStore.deleteItemAsync(TOKEN_KEY);
            }
        } catch (error) {
            console.error('Error clearing token:', error);
        }
    },
};

export const userStorage = {
    async getUser(): Promise<string | null> {
        try {
            if (isWeb) {
                return await webStorage.getItem(USER_KEY);
            }
            return await SecureStore.getItemAsync(USER_KEY);
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    },

    async setUser(user: string): Promise<void> {
        try {
            if (isWeb) {
                await webStorage.setItem(USER_KEY, user);
            } else {
                await SecureStore.setItemAsync(USER_KEY, user);
            }
        } catch (error) {
            console.error('Error setting user:', error);
        }
    },

    async clearUser(): Promise<void> {
        try {
            if (isWeb) {
                await webStorage.deleteItem(USER_KEY);
            } else {
                await SecureStore.deleteItemAsync(USER_KEY);
            }
        } catch (error) {
            console.error('Error clearing user:', error);
        }
    },
};

export interface PendingCallAction {
    type: 'answer';
    callUUID: string;
    roomName?: string;
    conversationId?: string;
    callSessionId?: string;
    senderId?: string;
    senderName?: string;
    createdAt: number;
}

export const pendingCallActionStorage = {
    async get(): Promise<PendingCallAction | null> {
        try {
            const value = isWeb
                ? await webStorage.getItem(PENDING_CALL_ACTION_KEY)
                : await SecureStore.getItemAsync(PENDING_CALL_ACTION_KEY);
            if (!value) return null;
            const parsed = JSON.parse(value) as Partial<PendingCallAction>;
            if (parsed.type !== 'answer' || !parsed.callUUID || typeof parsed.createdAt !== 'number') return null;
            if (Date.now() - parsed.createdAt > 60_000) return null;
            return parsed as PendingCallAction;
        } catch (error) {
            console.error('Error getting pending call action:', error);
            return null;
        }
    },

    async set(value: PendingCallAction): Promise<void> {
        const serialized = JSON.stringify(value);
        if (isWeb) {
            await webStorage.setItem(PENDING_CALL_ACTION_KEY, serialized);
        } else {
            await SecureStore.setItemAsync(PENDING_CALL_ACTION_KEY, serialized);
        }
    },

    async clear(): Promise<void> {
        if (isWeb) {
            await webStorage.deleteItem(PENDING_CALL_ACTION_KEY);
        } else {
            await SecureStore.deleteItemAsync(PENDING_CALL_ACTION_KEY);
        }
    },
};

/**
 * Interpreter invite captured from a notification tap that arrived before the
 * React tree (and therefore the Expo response listener) existed.
 */
export interface PendingInterpreterInvite {
    type: 'call_invite';
    roomName: string;
    senderId?: string;
    senderName?: string;
    inviteId?: string;
    createdAt: number;
}

// An invite only stays claimable while the caller is still ringing. A cold
// start that takes longer than this window would drop the interpreter into a
// room nobody is waiting in, so the entry is treated as expired instead.
const PENDING_INVITE_TTL_MS = 90_000;

export const pendingInviteStorage = {
    async get(): Promise<PendingInterpreterInvite | null> {
        try {
            const value = isWeb
                ? await webStorage.getItem(PENDING_INVITE_KEY)
                : await SecureStore.getItemAsync(PENDING_INVITE_KEY);
            if (!value) return null;
            const parsed = JSON.parse(value) as Partial<PendingInterpreterInvite>;
            if (parsed.type !== 'call_invite' || !parsed.roomName || typeof parsed.createdAt !== 'number') return null;
            if (Date.now() - parsed.createdAt > PENDING_INVITE_TTL_MS) return null;
            return parsed as PendingInterpreterInvite;
        } catch (error) {
            console.error('Error getting pending interpreter invite:', error);
            return null;
        }
    },

    async set(value: PendingInterpreterInvite): Promise<void> {
        try {
            const serialized = JSON.stringify(value);
            if (isWeb) {
                await webStorage.setItem(PENDING_INVITE_KEY, serialized);
            } else {
                await SecureStore.setItemAsync(PENDING_INVITE_KEY, serialized);
            }
        } catch (error) {
            console.error('Error setting pending interpreter invite:', error);
        }
    },

    async clear(): Promise<void> {
        try {
            if (isWeb) {
                await webStorage.deleteItem(PENDING_INVITE_KEY);
            } else {
                await SecureStore.deleteItemAsync(PENDING_INVITE_KEY);
            }
        } catch (error) {
            console.error('Error clearing pending interpreter invite:', error);
        }
    },
};

export const clearAllAuthData = async (): Promise<void> => {
    await tokenStorage.clearToken();
    await userStorage.clearUser();
};
