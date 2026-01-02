/**
 * Apple OAuth Hook
 * 
 * Uses expo-apple-authentication for native Apple authentication.
 * Returns identityToken to be validated by Supabase via the backend.
 */

import { useCallback, useState, useEffect } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../contexts/AuthContext';
import { Alert, Platform } from 'react-native';

export function useAppleAuth() {
    const { loginWithOAuth, isLoading } = useAuth();
    const [isAvailable, setIsAvailable] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check availability on mount
    useEffect(() => {
        const checkAvailability = async () => {
            if (Platform.OS === 'ios') {
                const available = await AppleAuthentication.isAvailableAsync();
                setIsAvailable(available);
            } else {
                setIsAvailable(false);
            }
        };
        checkAvailability();
    }, []);

    const signInWithApple = useCallback(async () => {
        setError(null);

        try {
            console.log('🍎 Starting Apple Sign-In...');

            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            console.log('✅ Apple Sign-In successful', credential);

            const { identityToken } = credential;

            if (!identityToken) {
                throw new Error('No identity token received from Apple');
            }

            // Send to backend for validation
            // Note: Apple only returns full name on the FIRST sign in.
            // If the backend needs it, it should be extracted here, but typically
            // the backend decodes the ID token or the client sends the name separately.
            // For now, we follow the pattern of sending just the token.
            await loginWithOAuth('apple', identityToken);

            console.log('✅ Apple Backend Auth completed');

        } catch (err: any) {
            console.error('Apple Sign-In error:', err);
            if (err.code === 'ERR_CANCELED') {
                console.log('User cancelled Apple Sign-In');
            } else {
                setError(err.message || 'Failed to sign in with Apple');
                Alert.alert('Error', 'No se pudo iniciar sesión con Apple.');
            }
        }
    }, [loginWithOAuth]);

    return {
        signInWithApple,
        isAvailable,
        isLoading,
        error,
    };
}
