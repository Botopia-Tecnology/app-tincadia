/**
 * NotificationBell Component
 * 
 * Reusable notification bell icon with badge and navigation to NotificationsScreen.
 * Can be used in any screen header.
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, DeviceEventEmitter } from 'react-native';
import { appNotificationService } from '../services/appNotification.service';
import { NotificationIcon } from './icons/NavigationIcons';

interface NotificationBellProps {
    userId: string;
    onPress: () => void;
    color?: string;
    size?: number;
    refreshTrigger?: number; // Increment this to force refresh
}

export function NotificationBell({
    userId,
    onPress,
    color = '#333333',
    size = 24,
    refreshTrigger = 0
}: NotificationBellProps) {
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const loadUnreadCount = async () => {
            if (!userId) return;
            try {
                const { count } = await appNotificationService.getUnreadCount(userId);
                setUnreadCount(count);
            } catch (err) {
                console.error('Error loading unread count:', err);
            }
        };
        loadUnreadCount();

        // Listen for optimistic read marks from NotificationsScreen
        const subscription = DeviceEventEmitter.addListener('notifications_read', () => {
            setUnreadCount(0);
        });

        return () => {
            subscription.remove();
        };
    }, [userId, refreshTrigger]);

    return (
        <TouchableOpacity style={styles.container} onPress={onPress}>
            <NotificationIcon size={size} color={color} />
            {unreadCount > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        padding: 8,
    },
    badge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
    },
});
