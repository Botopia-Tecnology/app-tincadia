/**
 * useSubscription Hook
 * 
 * Now acts as a wrapper for SubscriptionContext to provide a global state.
 */

import { useSubscription as useSubscriptionGlobal } from '../contexts/SubscriptionContext';

export function useSubscription(_userId?: string) {
    // We ignore userId parameter because the context handles it automatically via useAuth
    return useSubscriptionGlobal();
}

export type { PlanTier } from '../contexts/SubscriptionContext';
