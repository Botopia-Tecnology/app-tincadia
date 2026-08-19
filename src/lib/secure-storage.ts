/**
 * Secure Token Storage
 * 
 * Uses expo-secure-store for secure token storage.
 * Falls back gracefully on web where SecureStore is not available.
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const TOKEN_KEY = 'tincadia_accessToken';
const USER_KEY = 'tincadia_user';
const SESSION_KEY = 'tincadia_supabaseSession';
const INSTALLATION_ID_KEY = 'tincadia_installationId';
const DEVICE_REGISTRATION_KEY = 'tincadia_deviceRegistration';

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

export interface StoredDeviceRegistration {
    userId: string;
    registrationId: string;
}

export const deviceIdStorage = {
    async getOrCreate(): Promise<string> {
        try {
            const existing = isWeb
                ? await webStorage.getItem(INSTALLATION_ID_KEY)
                : await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
            if (existing) return existing;

            const installationId = Crypto.randomUUID();
            if (isWeb) {
                await webStorage.setItem(INSTALLATION_ID_KEY, installationId);
            } else {
                await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);
            }
            return installationId;
        } catch (error) {
            console.error('Error getting/creating installation id:', error);
            throw error;
        }
    },
};

export const deviceRegistrationStorage = {
    async get(): Promise<StoredDeviceRegistration | null> {
        try {
            const value = isWeb
                ? await webStorage.getItem(DEVICE_REGISTRATION_KEY)
                : await SecureStore.getItemAsync(DEVICE_REGISTRATION_KEY);
            if (!value) return null;

            const parsed = JSON.parse(value) as Partial<StoredDeviceRegistration>;
            if (!parsed.userId || !parsed.registrationId) return null;
            return { userId: parsed.userId, registrationId: parsed.registrationId };
        } catch (error) {
            console.error('Error getting device registration:', error);
            return null;
        }
    },

    async set(value: StoredDeviceRegistration): Promise<void> {
        const serialized = JSON.stringify(value);
        if (isWeb) {
            await webStorage.setItem(DEVICE_REGISTRATION_KEY, serialized);
        } else {
            await SecureStore.setItemAsync(DEVICE_REGISTRATION_KEY, serialized);
        }
    },

    async clear(): Promise<void> {
        if (isWeb) {
            await webStorage.deleteItem(DEVICE_REGISTRATION_KEY);
        } else {
            await SecureStore.deleteItemAsync(DEVICE_REGISTRATION_KEY);
        }
    },
};

export const clearAllAuthData = async (): Promise<void> => {
    await tokenStorage.clearToken();
    await userStorage.clearUser();
};
