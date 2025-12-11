/**
 * Message Bubble Component
 * 
 * Displays a single chat message.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MessageBubbleProps {
    content: string;
    time: string;
    isMine: boolean;
    isSynced?: boolean;
}

export function MessageBubble({ content, time, isMine, isSynced = true }: MessageBubbleProps) {
    // Format time (e.g., "14:30")
    const formatTime = (dateString: string): string => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
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
                    {isMine && !isSynced && (
                        <Text style={styles.pending}>⏳</Text>
                    )}
                    {isMine && isSynced && (
                        <Text style={styles.sent}>✓</Text>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    containerMine: {
        alignItems: 'flex-end',
    },
    containerOther: {
        alignItems: 'flex-start',
    },
    bubble: {
        maxWidth: '80%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
    },
    bubbleMine: {
        backgroundColor: '#4CAF50',
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        backgroundColor: '#E5E5EA',
        borderBottomLeftRadius: 4,
    },
    content: {
        fontSize: 16,
        lineHeight: 22,
    },
    contentMine: {
        color: '#FFFFFF',
    },
    contentOther: {
        color: '#000000',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
    },
    time: {
        fontSize: 11,
    },
    timeMine: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    timeOther: {
        color: '#999999',
    },
    pending: {
        fontSize: 10,
        marginLeft: 4,
    },
    sent: {
        fontSize: 12,
        marginLeft: 4,
        color: 'rgba(255, 255, 255, 0.9)',
    },
});
