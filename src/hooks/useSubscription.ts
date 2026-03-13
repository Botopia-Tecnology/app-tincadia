/**
 * useSubscription Hook
 * 
 * Manages subscription state and feature gating for the current user.
 * 3-tier plan system:
 *   - Gratis (no subscription): Most features blocked entirely
 *   - Básico (basic subscription): Limited features (1/day transcription, correction)
 *   - Premium (premium subscription): All features unlocked
 * 
 * Daily usage counters are tracked via AsyncStorage.
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { paymentsService } from '../services/payments.service';
import type { SubscriptionStatus } from '../services/payments.service';

const TRANSCRIPTION_USES_PREFIX = 'transcription_uses_';
const CORRECTION_USES_PREFIX = 'correction_uses_';


export type PlanTier = 'gratis' | 'basico' | 'premium';

function getTodayKey(): string {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateStr;
}

/**
 * Determine the plan tier from the backend subscription status.
 * Uses planType field from the DB:
 *   - personal_premium / empresa_corporate → premium
 *   - personal_free (with active subscription) → basico
 *   - No subscription → gratis
 */
function determineTier(status: SubscriptionStatus | null): PlanTier {
    if (!status?.hasSubscription) return 'gratis';
    if (status.status !== 'active' && status.status !== 'trialing') return 'gratis';

    const planType = status.planType || '';
    if (planType === 'personal_premium' || planType === 'empresa_corporate') return 'premium';

    // Any other active subscription (e.g. personal_free) = básico
    return 'basico';
}

export function useSubscription(userId: string | undefined) {
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [transcriptionUsesToday, setTranscriptionUsesToday] = useState(0);
    const [correctionUsesToday, setCorrectionUsesToday] = useState(0);

    const planTier = determineTier(subscriptionStatus);
    const isPremium = planTier === 'premium';
    const isBasico = planTier === 'basico';
    const isGratis = planTier === 'gratis';



    // Fetch subscription status
    useEffect(() => {
        if (!userId) {
            setIsLoading(false);
            return;
        }

        const fetchStatus = async () => {
            try {
                const status = await paymentsService.getSubscriptionStatus(userId);
                setSubscriptionStatus(status);
            } catch (error) {
                console.error('Error fetching subscription:', error);
                setSubscriptionStatus({ hasSubscription: false });
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatus();
    }, [userId]);

    // Load today's usage counters
    useEffect(() => {
        const loadUses = async () => {
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
        };
        loadUses();
    }, []);

    /**
     * Helper to get feature limit with fallback for legacy plans
     */
    const getLimit = useCallback((key: 'transcription_limit' | 'correction_limit', defaultLimit: number) => {
        if (!subscriptionStatus) return 0;
        const features = subscriptionStatus.features || {};
        const limit = features[key];

        // If explicitly set in features, use it
        if (limit !== undefined && limit !== null) return limit;

        // Fallback based on tier if features not set
        if (isPremium) return -1; // Unlimited
        if (isBasico) return defaultLimit; // 1 per day default for basic
        return 0; // Blocked for gratis
    }, [subscriptionStatus, isPremium, isBasico]);

    /**
     * Helper to check feature enabled status
     */
    const isFeatureEnabled = useCallback((key: 'lsc_enabled' | 'interpreter_enabled') => {
        if (!subscriptionStatus) return false;
        const features = subscriptionStatus.features || {};

        if (features[key] !== undefined) return !!features[key];

        // Fallback
        if (isPremium) return true;
        return false;
    }, [subscriptionStatus, isPremium]);

    const canUseLSC = isFeatureEnabled('lsc_enabled');
    const canUseInterpreter = isFeatureEnabled('interpreter_enabled');

    /**
     * Transcription Logic
     */
    const canUseTranscription = useCallback((): boolean => {
        const limit = getLimit('transcription_limit', 1);

        if (limit === -1) return true; // Unlimited
        if (limit === 0) return false; // Blocked

        return transcriptionUsesToday < limit;
    }, [getLimit, transcriptionUsesToday]);

    const recordTranscriptionUse = useCallback(async () => {
        const newCount = transcriptionUsesToday + 1;
        setTranscriptionUsesToday(newCount);
        try {
            const key = getTodayKey();
            await AsyncStorage.setItem(`${TRANSCRIPTION_USES_PREFIX}${key}`, String(newCount));
        } catch (error) {
            console.error('Error saving transcription use:', error);
        }
    }, [transcriptionUsesToday]);

    /**
     * Correction Logic
     */
    const canUseCorrection = useCallback((): boolean => {
        const limit = getLimit('correction_limit', 1);

        if (limit === -1) return true; // Unlimited
        if (limit === 0) return false; // Blocked

        return correctionUsesToday < limit;
    }, [getLimit, correctionUsesToday]);

    const recordCorrectionUse = useCallback(async () => {
        const newCount = correctionUsesToday + 1;
        setCorrectionUsesToday(newCount);
        try {
            const key = getTodayKey();
            await AsyncStorage.setItem(`${CORRECTION_USES_PREFIX}${key}`, String(newCount));
        } catch (error) {
            console.error('Error saving correction use:', error);
        }
    }, [correctionUsesToday]);

    // DEBUG: Log subscription status changes
    useEffect(() => {
        if (subscriptionStatus) {
            console.log('🔍 [useSubscription] Status Updated:', {
                Valid: subscriptionStatus.hasSubscription,
                PlanType: subscriptionStatus.planType,
                Status: subscriptionStatus.status,
                Features: subscriptionStatus.features,
                IsPremium: isPremium,
                IsBasico: isBasico
            });
        }
    }, [subscriptionStatus, isPremium, isBasico]);

    return {
        planTier,
        isPremium,
        isBasico,
        isGratis,
        canUseLSC,
        canUseInterpreter,
        canUseTranscription,
        recordTranscriptionUse,
        canUseCorrection,
        recordCorrectionUse,
        subscriptionStatus,
        isLoading,
    };
}
