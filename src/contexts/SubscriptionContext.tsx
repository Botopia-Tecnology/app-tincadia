import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { paymentsService, SubscriptionStatus } from '../services/payments.service';
import { useAuth } from './AuthContext';
import Purchases from 'react-native-purchases';
import { 
    getRevenueCatApiKey, 
    REVENUECAT_ENTITLEMENT_PREMIUM, 
    REVENUECAT_ENTITLEMENT_BASICO,
    APP_TIERS,
    BACKEND_PLAN_TYPES,
    FEATURE_KEYS
} from '../config/revenuecat.config';

const SUBSCRIPTION_CACHE_KEY = 'subscription_status_cache';
const TRANSCRIPTION_USES_PREFIX = 'transcription_uses_';
const CORRECTION_USES_PREFIX = 'correction_uses_';

export type PlanTier = typeof APP_TIERS[keyof typeof APP_TIERS];

interface SubscriptionContextValue {
    planTier: PlanTier;
    isPremium: boolean;
    isBasico: boolean;
    isGratis: boolean;
    canUseLSC: boolean;
    canUseInterpreter: boolean;
    canUseSubtitles: boolean;
    canUseTTS: boolean;
    canUseTranscription: () => boolean;
    recordTranscriptionUse: () => Promise<void>;
    canUseCorrection: () => boolean;
    recordCorrectionUse: () => Promise<void>;
    subscriptionStatus: SubscriptionStatus | null;
    isLoading: boolean;
    refreshSubscription: (forceRefresh?: boolean) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function getTodayKey(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function determineTier(status: SubscriptionStatus | null): PlanTier {
    if (!status?.hasSubscription) return APP_TIERS.GRATIS;
    if (status.status !== 'active' && status.status !== 'trialing') return APP_TIERS.GRATIS;
    const planType = status.planType || '';
    if (planType === BACKEND_PLAN_TYPES.PERSONAL_PREMIUM || planType === BACKEND_PLAN_TYPES.EMPRESA_CORPORATE) return APP_TIERS.PREMIUM;
    if (planType === BACKEND_PLAN_TYPES.PERSONAL_BASICO) return APP_TIERS.BASICO;
    return APP_TIERS.GRATIS;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const userId = user?.id;

    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [transcriptionUsesToday, setTranscriptionUsesToday] = useState(0);
    const [correctionUsesToday, setCorrectionUsesToday] = useState(0);
    
    const backgroundFetchInProgress = useRef(false);
    const mainFetchInProgress = useRef(false);
    const lastFetchTime = useRef<number>(0);

    const planTier = useMemo(() => determineTier(subscriptionStatus), [subscriptionStatus]);
    const isPremium = planTier === APP_TIERS.PREMIUM;
    const isBasico = planTier === APP_TIERS.BASICO;
    const isGratis = planTier === APP_TIERS.GRATIS;

    const fetchInBackground = useCallback(async (uid: string) => {
        if (backgroundFetchInProgress.current || mainFetchInProgress.current) return;
        
        // Don't background fetch if we just fetched in the last 30 seconds
        if (Date.now() - lastFetchTime.current < 30000) return;

        backgroundFetchInProgress.current = true;
        try {
            const status = await paymentsService.getSubscriptionStatus(uid);
            setSubscriptionStatus(status);
            lastFetchTime.current = Date.now();
            await AsyncStorage.setItem(`${SUBSCRIPTION_CACHE_KEY}_${uid}`, JSON.stringify({
                status,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Background fetch failed:', e);
        } finally {
            backgroundFetchInProgress.current = false;
        }
    }, []);

    const fetchStatus = useCallback(async (forceRefresh = false) => {
        if (!userId) {
            setIsLoading(false);
            return;
        }

        if (mainFetchInProgress.current) return;

        // Prevent rapid successive calls even if not "in progress"
        if (!forceRefresh && Date.now() - lastFetchTime.current < 5000) {
            return;
        }

        if (!forceRefresh) {
            try {
                const cached = await AsyncStorage.getItem(`${SUBSCRIPTION_CACHE_KEY}_${userId}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const isFresh = (Date.now() - parsed.timestamp) < 1000 * 60 * 60; // 1 hora
                    if (isFresh) {
                        setSubscriptionStatus(parsed.status);
                        setIsLoading(false);
                        fetchInBackground(userId);
                        return;
                    }
                }
            } catch (e) {
                console.warn('Cache read error:', e);
            }
        }

        console.log('🔄 [SubscriptionContext] Fetching status for:', userId);
        mainFetchInProgress.current = true;
        if (!subscriptionStatus) setIsLoading(true);

        try {
            const status = await paymentsService.getSubscriptionStatus(userId);
            
            // Sync with RevenueCat
            try {
                const customerInfo = await Purchases.getCustomerInfo();
                const isPremiumInRC = typeof customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_PREMIUM] !== "undefined";
                const isBasicoInRC = typeof customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_BASICO] !== "undefined";
                
                // If RevenueCat says premium but our backend doesn't, RC is the source of truth for mobile
                if (isPremiumInRC) {
                    status.hasSubscription = true;
                    status.status = 'active';
                    status.planType = BACKEND_PLAN_TYPES.PERSONAL_PREMIUM;
                } else if (isBasicoInRC) {
                    status.hasSubscription = true;
                    status.status = 'active';
                    status.planType = BACKEND_PLAN_TYPES.PERSONAL_BASICO;
                }
            } catch (rcError) {
                console.warn('⚠️ [SubscriptionContext] RevenueCat check failed:', rcError);
            }

            setSubscriptionStatus(status);
            lastFetchTime.current = Date.now();
            await AsyncStorage.setItem(`${SUBSCRIPTION_CACHE_KEY}_${userId}`, JSON.stringify({
                status,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Error fetching subscription:', error);
            // Functional update to avoid dependency
            setSubscriptionStatus(current => current || { hasSubscription: false });
        } finally {
            setIsLoading(false);
            mainFetchInProgress.current = false;
        }
    }, [userId, fetchInBackground]);

    useEffect(() => {
        // Initialize RevenueCat
        const initRevenueCat = async () => {
            try {
                const apiKey = getRevenueCatApiKey();
                if (apiKey) {
                    if (userId) {
                        await Purchases.configure({ apiKey, appUserID: userId });
                    } else {
                        await Purchases.configure({ apiKey });
                    }
                    console.log('✅ [SubscriptionContext] RevenueCat configured successfully');
                }
            } catch (error) {
                console.error('❌ [SubscriptionContext] RevenueCat config error:', error);
            }
        };
        initRevenueCat();
    }, [userId]);

    useEffect(() => {
        if (userId) {
            fetchStatus();
        } else {
            setSubscriptionStatus(null);
            setIsLoading(false);
        }
    }, [userId, fetchStatus]);

    const loadUses = useCallback(async () => {
        try {
            const key = getTodayKey();
            const storedTx = await AsyncStorage.getItem(`${TRANSCRIPTION_USES_PREFIX}${key}`);
            setTranscriptionUsesToday(storedTx ? parseInt(storedTx, 10) : 0);
            const storedCx = await AsyncStorage.getItem(`${CORRECTION_USES_PREFIX}${key}`);
            setCorrectionUsesToday(storedCx ? parseInt(storedCx, 10) : 0);
        } catch {
            setTranscriptionUsesToday(0);
            setCorrectionUsesToday(0);
        }
    }, []);

    useEffect(() => {
        loadUses();
    }, [loadUses]);

    const getLimit = useCallback((key: keyof typeof FEATURE_KEYS, defaultLimit: number): number => {
        if (!subscriptionStatus) return 0;
        const features = subscriptionStatus.features || {};
        const limit = features[FEATURE_KEYS[key]];
        if (typeof limit === 'number') return limit;
        if (isPremium) return -1;
        if (isBasico) return defaultLimit;
        return 0;
    }, [subscriptionStatus, isPremium, isBasico]);

    const isFeatureEnabled = useCallback((key: keyof typeof FEATURE_KEYS) => {
        if (!subscriptionStatus) return false;
        const features = subscriptionStatus.features || {};
        const featureKey = FEATURE_KEYS[key];
        if (features[featureKey] !== undefined) return !!features[featureKey];
        return isPremium;
    }, [subscriptionStatus, isPremium]);

    const canUseLSC = useMemo(() => isFeatureEnabled('LSC_ENABLED'), [isFeatureEnabled]);
    const canUseInterpreter = useMemo(() => isFeatureEnabled('INTERPRETER_ENABLED'), [isFeatureEnabled]);
    const canUseTTS = useMemo(() => {
        if (!subscriptionStatus) return false;
        const features = subscriptionStatus.features || {};
        return !!features[FEATURE_KEYS.TTS_ENABLED]; // strictly admin-controlled
    }, [subscriptionStatus]);
    
    // Evaluate via getLimit if it's considered unlimitted or via featureEnabled directly as boolean flag based on your backend usage.
    // If Admin dashboard turns subtitles on/off with a boolean, use isFeatureEnabled
    // If it's a limit, use getLimit > 0
    // Assuming boolean based on typical patterns or 'subtitles_limit' if numeric. We'll use getLimit if we treat it as limited.
    const canUseSubtitles = useMemo(() => {
        const limit = getLimit('SUBTITLES_LIMIT', 0);
        return limit === -1 || limit > 0;
    }, [getLimit]);


    const canUseTranscription = useCallback(() => {
        const limit = getLimit('TRANSCRIPTION_LIMIT', 1);
        if (limit === -1) return true;
        if (limit === 0) return false;
        return transcriptionUsesToday < limit;
    }, [getLimit, transcriptionUsesToday]);

    const recordTranscriptionUse = useCallback(async () => {
        const newCount = transcriptionUsesToday + 1;
        setTranscriptionUsesToday(newCount);
        try {
            const key = getTodayKey();
            await AsyncStorage.setItem(`${TRANSCRIPTION_USES_PREFIX}${key}`, String(newCount));
        } catch (e) {
            console.error('Error saving transcription use:', e);
        }
    }, [transcriptionUsesToday]);

    const canUseCorrection = useCallback(() => {
        const limit = getLimit('correction_limit', 1);
        if (limit === -1) return true;
        if (limit === 0) return false;
        return correctionUsesToday < limit;
    }, [getLimit, correctionUsesToday]);

    const recordCorrectionUse = useCallback(async () => {
        const newCount = correctionUsesToday + 1;
        setCorrectionUsesToday(newCount);
        try {
            const key = getTodayKey();
            await AsyncStorage.setItem(`${CORRECTION_USES_PREFIX}${key}`, String(newCount));
        } catch (e) {
            console.error('Error saving correction use:', e);
        }
    }, [correctionUsesToday]);

    const value = useMemo(() => ({
        planTier,
        isPremium,
        isBasico,
        isGratis,
        canUseLSC,
        canUseInterpreter,
        canUseSubtitles,
        canUseTTS,
        canUseTranscription,
        recordTranscriptionUse,
        canUseCorrection,
        recordCorrectionUse,
        subscriptionStatus,
        isLoading,
        refreshSubscription: fetchStatus,
    }), [
        planTier, isPremium, isBasico, isGratis, canUseLSC, canUseInterpreter, canUseSubtitles,
        canUseTranscription, recordTranscriptionUse, canUseCorrection,
        recordCorrectionUse, subscriptionStatus, isLoading, fetchStatus
    ]);

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription() {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription debe usarse dentro de SubscriptionProvider');
    }
    return context;
}
