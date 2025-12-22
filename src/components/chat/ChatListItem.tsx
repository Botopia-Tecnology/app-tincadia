/**
 * Chat List Item Component
 * 
 * Displays a single conversation in the chat list.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { chatListItemStyles as styles } from '../../styles/ChatComponents.styles';

interface ChatListItemProps {
    id: string;
    name: string;
    avatar?: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
    onPress: (conversationId: string) => void;
}

export function ChatListItem({
    id,
    name,
    avatar,
    lastMessage,
    lastMessageAt,
    unreadCount,
    onPress,
}: ChatListItemProps) {
    // Format time (e.g., "14:30" or "Ayer")
    const formatTime = (dateString: string): string => {
        if (!dateString) return '';

        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Ayer';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('es', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
        }
    };

    return (
        <TouchableOpacity style={styles.container} onPress={() => onPress(id)}>
            <Image
                source={{ uri: avatar || 'https://via.placeholder.com/50' }}
                style={styles.avatar}
            />

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.name} numberOfLines={1}>
                        {name || 'Usuario'}
                    </Text>
                    <Text style={styles.time}>{formatTime(lastMessageAt)}</Text>
                </View>

                <View style={styles.messageRow}>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                        {lastMessage || 'Sin mensajes'}
                    </Text>
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}
