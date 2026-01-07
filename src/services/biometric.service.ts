import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_EMAIL = 'biometric_email';
const KEY_PASSWORD = 'biometric_password';

export interface BiometricCredentials {
    email: string;
    password: string;
}

export const biometricService = {
    /**
     * Check if hardware supports biometrics and is enrolled
     */
    async isAvailable(): Promise<{ available: boolean; biometricType?: string }> {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                return { available: false };
            }

            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            let biometricType = 'Huella / Face ID';
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                biometricType = 'Face ID';
            } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                biometricType = 'Huella Dactilar';
            }

            return { available: true, biometricType };
        } catch (error) {
            console.error('Biometric check failed', error);
            return { available: false };
        }
    },

    /**
     * Trigger the OS biometric prompt
     */
    async authenticate(): Promise<boolean> {
        try {
            // Check availability again just in case
            const { available } = await this.isAvailable();
            if (!available) return false;

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Inicia sesión con Tincadia',
                cancelLabel: 'Cancelar',
                disableDeviceFallback: false, // Allow PIN fallback if needed
                fallbackLabel: 'Usar PIN',
            });

            return result.success;
        } catch (error) {
            console.error('Authentication failed', error);
            return false;
        }
    },

    /**
     * Save credentials securely for future auto-login
     */
    async saveCredentials(credentials: BiometricCredentials): Promise<void> {
        try {
            await SecureStore.setItemAsync(KEY_EMAIL, credentials.email);
            await SecureStore.setItemAsync(KEY_PASSWORD, credentials.password);
        } catch (error) {
            console.error('Failed to save credentials', error);
            throw error;
        }
    },

    /**
     * Retrieve stored credentials if they exist
     */
    async getCredentials(): Promise<BiometricCredentials | null> {
        try {
            const email = await SecureStore.getItemAsync(KEY_EMAIL);
            const password = await SecureStore.getItemAsync(KEY_PASSWORD);

            if (email && password) {
                return { email, password };
            }
            return null;
        } catch (error) {
            console.error('Failed to get credentials', error);
            return null;
        }
    },

    /**
     * Clear credentials (e.g., on logout or disable)
     */
    async clearCredentials(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(KEY_EMAIL);
            await SecureStore.deleteItemAsync(KEY_PASSWORD);
        } catch (error) {
            console.error('Failed to clear credentials', error);
        }
    }
};
