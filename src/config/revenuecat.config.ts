import { Platform } from 'react-native';

// Estas son claves PÚBLICAS. Es seguro tenerlas en el código del cliente.
const REVENUECAT_API_KEYS = {
    apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || '',
    google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || '',
};

export const REVENUECAT_ENTITLEMENT_PREMIUM = 'Premium';
export const REVENUECAT_ENTITLEMENT_BASICO = 'Básico';

// Identificadores que vienen de la base de datos (Supabase / Backend)
export const BACKEND_PLAN_TYPES = {
    PERSONAL_PREMIUM: 'personal_premium',
    PERSONAL_BASICO: 'personal_basico',
    EMPRESA_CORPORATE: 'empresa_corporate',
} as const;

// Tiers internos de la aplicación
export const APP_TIERS = {
    PREMIUM: 'premium',
    BASICO: 'basico',
    GRATIS: 'gratis',
} as const;

// Claves de funcionalidades configuradas en el Admin Dashboard / Backend
export const FEATURE_KEYS = {
    TRANSCRIPTION_LIMIT: 'transcription_limit',
    CORRECTION_LIMIT: 'correction_limit',
    SUBTITLES_LIMIT: 'subtitles_limit',
    LSC_ENABLED: 'lsc_enabled',
    INTERPRETER_ENABLED: 'interpreter_enabled',
    SUBTITLES_ENABLED: 'subtitles_enabled',
    TTS_ENABLED: 'tts_enabled',
} as const;

export const getRevenueCatApiKey = () => {
    if (Platform.OS === 'ios') {
        return REVENUECAT_API_KEYS.apple;
    } else if (Platform.OS === 'android') {
        return REVENUECAT_API_KEYS.google;
    }
    return '';
};
