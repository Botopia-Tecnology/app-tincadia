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

// Web fallback using localStorage (less secure, but SecureStore doesn't work on web)
// NOTE: This project is typed for React Native (no DOM lib), so we must not reference `window` directly.
const getWebLocalStorage = (): any | null => {
    const g: any = globalThis as any;
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

export const clearAllAuthData = async (): Promise<void> => {
    await tokenStorage.clearToken();
    await userStorage.clearUser();
};
