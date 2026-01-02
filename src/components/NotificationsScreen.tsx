/**
 * Notifications Screen Component
 * 
 * Displays app notifications like news, updates, and promotions.
 * Accessible via the bell icon in the Chats header.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appNotificationService, AppNotification, NotificationType } from '../services/appNotification.service';
import { notificationsStyles as styles } from '../styles/Notifications.styles';
import { BackArrowIcon } from './icons/NavigationIcons';

interface NotificationsScreenProps {
    userId: string;
    onBack: () => void;
}

// Icon components for notification types
const NewsIcon = ({ size = 20, color = '#3B82F6' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
            fill={color}
        />
    </Svg>
);

const UpdateIcon = ({ size = 20, color = '#10B981' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
            fill={color}
        />
    </Svg>
);

const PromoIcon = ({ size = 20, color = '#F59E0B' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"
            fill={color}
        />
    </Svg>
);

const EmptyBellIcon = ({ size = 48, color = '#9CA3AF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"
            fill={color}
        />
    </Svg>
);

// Get icon component for notification type
const getTypeIcon = (type: NotificationType) => {
    switch (type) {
        case 'news':
            return <NewsIcon />;
        case 'update':
            return <UpdateIcon />;
        case 'promotion':
            return <PromoIcon />;
        default:
            return <NewsIcon />;
    }
};

// Get style for notification type
const getTypeStyle = (type: NotificationType) => {
    switch (type) {
        case 'news':
            return styles.typeNews;
        case 'update':
            return styles.typeUpdate;
        case 'promotion':
            return styles.typePromotion;
        default:
            return styles.typeNews;
    }
};

// Format time ago
// Format time ago
const formatTimeAgo = (dateString: string): string => {
    if (!dateString) return '';

    // Fix potential format issues for cross-platform compatibility
    // e.g., "2023-01-01 12:00:00" -> "2023-01-01T12:00:00"
    const safeDateString = dateString.replace(' ', 'T');

    const date = new Date(safeDateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return '';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

export function NotificationsScreen({ userId, onBack }: NotificationsScreenProps) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadNotifications = useCallback(async () => {
        try {
            const data = await appNotificationService.getNotifications(userId);
            setNotifications(data);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [userId]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadNotifications();
    };

    const handleNotificationPress = async (notification: AppNotification) => {
        // Mark as read if not already
        if (!notification.isRead) {
            try {
                await appNotificationService.markAsRead(userId, notification.id);
                // Update local state
                setNotifications(prev =>
                    prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
                );
            } catch (error) {
                console.error('Error marking as read:', error);
            }
        }

        // If has link, could open it (future: use Linking.openURL)
        if (notification.linkUrl) {
            console.log('Open link:', notification.linkUrl);
        }
    };

    const renderNotification = ({ item }: { item: AppNotification }) => (
        <TouchableOpacity
            style={[
                styles.notificationItem,
                !item.isRead && styles.notificationItemUnread,
            ]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
        >
            <View style={[styles.typeIndicator, getTypeStyle(item.type)]}>
                {getTypeIcon(item.type)}
            </View>
            <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                    <Text
                        style={[
                            styles.notificationTitle,
                            !item.isRead && styles.notificationTitleUnread,
                        ]}
                        numberOfLines={1}
                    >
                        {item.title}
                    </Text>
                    <Text style={styles.notificationTime}>
                        {formatTimeAgo(item.createdAt)}
                    </Text>
                </View>
                <Text style={styles.notificationMessage} numberOfLines={2}>
                    {item.message}
                </Text>
            </View>
            {!item.isRead && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <EmptyBellIcon size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No hay notificaciones</Text>
            <Text style={styles.emptySubtext}>
                Las novedades y promociones de Tincadia aparecerán aquí
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <BackArrowIcon size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notificaciones</Text>
            </View>

            {/* Loading State */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#7FA889" />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderNotification}
                    contentContainerStyle={[
                        styles.listContent,
                        notifications.length === 0 && { flex: 1 },
                    ]}
                    ListEmptyComponent={renderEmptyState}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            colors={['#7FA889']}
                            tintColor="#7FA889"
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
}
