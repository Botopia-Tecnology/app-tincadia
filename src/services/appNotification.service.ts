/**
 * App Notifications Service
 * 
 * Service for managing in-app notifications (news, updates, promotions)
 */

import { apiClient } from '../lib/api-client';
import { API_ENDPOINTS } from '../config/api.config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_CACHE_KEY = 'tincadia_notifications_cache';

export type NotificationType = 'news' | 'update' | 'promotion';

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    imageUrl?: string;
    linkUrl?: string;
    isActive: boolean;
    priority: number;
    createdAt: string;
    expiresAt?: string;
    isRead?: boolean;
}

export const appNotificationService = {
    /**
     * Get all active notifications for a user
     */
    /**
     * Get all active notifications for a user
     * Strategy: Network First (for freshness) with Offline Fallback
     * To achieve "Offline First" UI, use getCachedNotifications() before calling this.
     */
    async getNotifications(userId: string): Promise<AppNotification[]> {
        try {
            const data: AppNotification[] = await apiClient(`${API_ENDPOINTS.NOTIFICATIONS}?userId=${userId}`, {
                method: 'GET',
            });
            // Update cache
            await AsyncStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(data));
            return data;
        } catch (error) {
            console.warn('Error fetching notifications, checking cache...', error);
            // Fallback to cache
            const cached = await AsyncStorage.getItem(NOTIFICATIONS_CACHE_KEY);
            if (cached) {
                return JSON.parse(cached);
            }
            throw error;
        }
    },

    /**
     * Get cached notifications immediately (for optimistic UI)
     */
    async getCachedNotifications(): Promise<AppNotification[]> {
        try {
            const cached = await AsyncStorage.getItem(NOTIFICATIONS_CACHE_KEY);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    },

    /**
     * Get unread notification count
     */
    async getUnreadCount(userId: string): Promise<{ count: number }> {
        return apiClient(API_ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT(userId), {
            method: 'GET',
        });
    },

    /**
     * Mark a notification as read
     */
    async markAsRead(userId: string, notificationId: string): Promise<{ success: boolean }> {
        return apiClient(API_ENDPOINTS.NOTIFICATION_MARK_READ(notificationId), {
            method: 'POST',
            body: JSON.stringify({ userId }),
        });
    },

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string): Promise<{ success: boolean }> {
        return apiClient(API_ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ(userId), {
            method: 'POST',
        });
    },

    /**
     * Send a test push notification to the current device
     */
    async sendTestPush(userId: string, token: string): Promise<{ success: boolean; message?: string }> {
        return apiClient(API_ENDPOINTS.PUSH_TEST, {
            method: 'POST',
            body: JSON.stringify({ userId, token }),
        });
    },
};
