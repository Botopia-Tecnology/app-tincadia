/**
 * Google OAuth Hook
 * 
 * Uses @react-native-google-signin/google-signin for native Google authentication.
 * Returns ID token to be validated by Supabase via the backend.
 */

import { useCallback, useState, useEffect } from 'react';
import {
    GoogleSignin,
    isSuccessResponse,
    isErrorWithCode,
    statusCodes,
} from '@react-native-google-signin/google-signin';
import { useAuth } from '../contexts/AuthContext';

// Web Client ID from Google Cloud Console (also configured in Supabase)
// Web Client ID from Google Cloud Console (also configured in Supabase)
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;

// Configure Google Sign-In once
let isConfigured = false;

function configureGoogleSignIn() {
    if (isConfigured) return;

    GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        iosClientId: IOS_CLIENT_ID,
        // offlineAccess: true, // Removed to fix iOS nonce error
        scopes: ['profile', 'email'],
    });

    isConfigured = true;
    console.log('✅ Google Sign-In configured');
}

export function useGoogleAuth() {
    const { loginWithOAuth, isLoading, setError: setAuthError } = useAuth();
    const [isReady, setIsReady] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Configure on mount
    useEffect(() => {
        try {
            configureGoogleSignIn();
            setIsReady(true);
        } catch (err) {
            console.error('Failed to configure Google Sign-In:', err);
            setLocalError('Failed to initialize Google Sign-In');
        }
    }, []);

    const signInWithGoogle = useCallback(async () => {
        setAuthError(null);
        setLocalError(null);

        try {
            console.log('🚀 Starting Google Sign-In...');

            // Check if device supports Google Play Services
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Sign in and get user info
            const response = await GoogleSignin.signIn();

            if (isSuccessResponse(response)) {
                const { idToken } = response.data;

                if (!idToken) {
                    throw new Error('No ID token received from Google');
                }

                console.log('✅ Got ID token from Google');

                // Send to backend for Supabase authentication
                await loginWithOAuth('google', idToken);

                console.log('✅ Google Sign-In completed successfully');
            } else {
                // User cancelled the sign-in
                console.log('Google Sign-In was cancelled');
            }
        } catch (err: unknown) {
            console.error('Google Sign-In error:', err);
            let message = 'An unexpected error occurred';

            if (isErrorWithCode(err)) {
                switch (err.code) {
                    case statusCodes.SIGN_IN_CANCELLED:
                        // User cancelled - not an error to show
                        console.log('User cancelled Google Sign-In');
                        return;
                    case statusCodes.IN_PROGRESS:
                        message = 'Sign-in already in progress';
                        break;
                    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
                        message = 'Google Play Services not available';
                        break;
                    default:
                        message = err.message || 'Failed to sign in with Google';
                }
            } else if (err instanceof Error) {
                message = err.message || 'An unexpected error occurred';
            }

            setLocalError(message);
            setAuthError(message);
        }
    }, [loginWithOAuth, setAuthError]);

    const signOut = useCallback(async () => {
        try {
            await GoogleSignin.signOut();
            console.log('✅ Google Sign-Out completed');
        } catch (err) {
            console.error('Google Sign-Out error:', err);
        }
    }, []);

    return {
        signInWithGoogle,
        signOut,
        isReady,
        isLoading,
        error: localError,
    };
}
