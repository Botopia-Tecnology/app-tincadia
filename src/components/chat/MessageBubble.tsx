/**
 * Message Bubble Component
 * 
 * Displays a single chat message with read receipts.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { messageBubbleStyles as styles } from '../../styles/ChatComponents.styles';

interface MessageBubbleProps {
    content: string;
    time: string;
    isMine: boolean;
    isSynced?: boolean;
    isRead?: boolean; // true = blue checkmarks, false = gray checkmarks
}

export function MessageBubble({ content, time, isMine, isSynced = true, isRead = false }: MessageBubbleProps) {
    // Format time (e.g., "14:30")
    const formatTime = (dateString: string): string => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    };

    // Render checkmarks for sent messages
    const renderCheckmarks = () => {
        if (!isMine) return null;

        if (!isSynced) {
            // Message not synced yet
            return <Text style={styles.pending}>⏳</Text>;
        }

        // Double checkmarks - color based on read status
        const checkmarkColor = isRead ? '#34B7F1' : 'rgba(255, 255, 255, 0.6)';
        return (
            <Text style={[styles.checkmarks, { color: checkmarkColor }]}>
                ✓✓
            </Text>
        );
    };

    return (
        <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.content, isMine ? styles.contentMine : styles.contentOther]}>
                    {content}
                </Text>
                <View style={styles.footer}>
                    <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
                        {formatTime(time)}
                    </Text>
                    {renderCheckmarks()}
                </View>
            </View>
        </View>
    );
}
