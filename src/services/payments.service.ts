import { apiClient } from '../lib/api-client';
import { API_ENDPOINTS } from '../config/api.config';

export const paymentsService = {
    /**
     * Checks if a user has purchased a specific product (course)
     */
    checkPurchaseStatus: async (userId: string, productId: string, productType: string = 'COURSE'): Promise<boolean> => {
        try {
            // Using direct full path if not in API_ENDPOINTS yet, or update API_ENDPOINTS later
            // Assuming apiClient handles base URL.
            // API_ENDPOINTS in config/api.config.ts might need update, checking usage in content.service.ts
            // content.service uses API_URL imported.

            // Let's assume standard endpoint structure
            const response = await apiClient<boolean | { purchased: boolean }>(`/payments/purchases/check?userId=${userId}&productId=${productId}&productType=${productType}`, {
                method: 'GET',
            });
            // Handle if it returns object { purchased: true } or literal true
            if (typeof response === 'boolean') return response;
            if (typeof response === 'object' && response !== null && 'purchased' in response) {
                return (response as any).purchased === true;
            }
            // Fallback: if it's a non-empty object/truthy that isn't explicit false, 
            // BUT given the bug, maybe it returns {} (truthy) when it should be false?
            // Safest: strict true check if possible, or assume truthy means yes. 
            // Re-reading user issue: "sale que estan disponibles aun cuando la persona no los ha comprado". 
            // This means it returns TRUE (or truthy) when it should be FALSE.
            // If the API returns nothing (204) -> {} -> truthy.
            // If checks fail, safer to return false.
            // So default should be false.
            return response === true;
        } catch (error) {
            console.error('Error checking purchase status:', error);
            return false;
        }
    },

    /**
     * Initiates a new payment
     */
    initiatePayment: async (data: { userId: string, email: string, amount: number, reference: string, currency?: string, paymentMethod?: string }) => {
        try {
            return await apiClient('/payments/initiate', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        } catch (error) {
            console.error('Error initiating payment:', error);
            throw error;
        }
    },

    /**
     * Gets the subscription status for a user (plan, permissions, features)
     */
    getSubscriptionStatus: async (userId: string): Promise<SubscriptionStatus> => {
        try {
            const response = await apiClient<SubscriptionStatus>(`/payments/subscriptions/status/${userId}`, {
                method: 'GET',
            });
            return response;
        } catch (error) {
            console.error('Error fetching subscription status:', error);
            // Default to free plan on error
            return { hasSubscription: false };
        }
    },
};

export interface SubscriptionStatus {
    hasSubscription: boolean;
    status?: string;
    planId?: string;
    planType?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    permissions?: string[];
    features?: Record<string, any>;
}
