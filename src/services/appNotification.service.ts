/**
 * App Notifications Service
 * 
 * Service for managing in-app notifications (news, updates, promotions)
 */

import { apiClient } from '../lib/api-client';
import { API_ENDPOINTS } from '../config/api.config';

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
    async getNotifications(userId: string): Promise<AppNotification[]> {
        return apiClient(`${API_ENDPOINTS.NOTIFICATIONS}?userId=${userId}`, {
            method: 'GET',
        });
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
};
