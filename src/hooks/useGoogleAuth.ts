/**
 * Google OAuth Hook
 * 
 * Uses expo-auth-session for Google authentication.
 * Returns ID token (NOT access token) as required by the backend.
 * 
 * Supports custom redirect URI for ngrok development.
 */

import { useEffect, useCallback } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../contexts/AuthContext';

// Complete auth session on web
WebBrowser.maybeCompleteAuthSession();

// Get custom redirect URI from environment (for ngrok)
const getRedirectUri = (): string | undefined => {
    const customUri = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI;
    if (customUri) {
        console.log('🔑 Using custom OAuth redirect URI:', customUri);
        return customUri;
    }
    // Let expo-auth-session handle it automatically
    return undefined;
};

export function useGoogleAuth() {
    const { loginWithOAuth, isLoading } = useAuth();

    const redirectUri = getRedirectUri();

    // Use ID Token request (NOT access token) - this is critical!
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        // Web client ID is required - used for all platforms in Expo Go
        clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
        // These are used in standalone builds
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
        // Custom redirect URI for ngrok
        ...(redirectUri ? { redirectUri } : {}),
    });

    // Log for debugging
    useEffect(() => {
        const defaultRedirect = AuthSession.makeRedirectUri();
        console.log('🔑 Google OAuth request ready:', !!request);
        console.log('🔑 Default redirect URI:', defaultRedirect);
        console.log('🔑 Custom redirect URI:', redirectUri || '(none - using default)');
        console.log('🔑 Web Client ID:', process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB?.substring(0, 20) + '...');
    }, [request, redirectUri]);

    // Handle the OAuth response
    useEffect(() => {
        const handleResponse = async () => {
            if (response?.type === 'success') {
                const { id_token } = response.params;
                console.log('✅ Got ID token from Google');
                if (id_token) {
                    try {
                        await loginWithOAuth('google', id_token);
                    } catch (error) {
                        console.error('Google OAuth login failed:', error);
                    }
                }
            } else if (response?.type === 'error') {
                console.error('Google OAuth error:', response.error);
            } else if (response?.type === 'dismiss') {
                console.log('Google OAuth dismissed by user');
            }
        };

        if (response) {
            handleResponse();
        }
    }, [response, loginWithOAuth]);

    const signInWithGoogle = useCallback(async () => {
        if (!request) {
            console.warn('Google OAuth request not ready yet');
            return;
        }

        try {
            console.log('🚀 Starting Google OAuth...');
            await promptAsync();
        } catch (error) {
            console.error('Google OAuth prompt failed:', error);
        }
    }, [request, promptAsync]);

    return {
        signInWithGoogle,
        isReady: !!request,
        isLoading,
        response,
    };
}
